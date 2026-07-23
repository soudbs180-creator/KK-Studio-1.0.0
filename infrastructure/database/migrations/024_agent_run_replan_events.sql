BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS replan_count integer NOT NULL DEFAULT 0,
  DROP CONSTRAINT IF EXISTS agent_runs_replan_count_check;

ALTER TABLE public.agent_runs
  ADD CONSTRAINT agent_runs_replan_count_check
    CHECK (replan_count BETWEEN 0 AND 3);

ALTER TABLE public.agent_run_events
  ADD COLUMN IF NOT EXISTS replan_count integer,
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS trigger_code text,
  DROP CONSTRAINT IF EXISTS agent_run_events_event_type_check,
  DROP CONSTRAINT IF EXISTS agent_run_events_event_shape_check;

ALTER TABLE public.agent_run_events
  ADD CONSTRAINT agent_run_events_event_type_check
    CHECK (event_type IN ('run_snapshot', 'step_outcome', 'replan')),
  ADD CONSTRAINT agent_run_events_event_shape_check CHECK (
    (
      event_type = 'run_snapshot'
      AND step_id IS NULL AND tool_name IS NULL AND outcome IS NULL
      AND verification_rule IS NULL AND retryable IS NULL AND verified_at IS NULL
      AND replan_count IS NULL AND reason_code IS NULL AND trigger_code IS NULL
    ) OR (
      event_type = 'step_outcome'
      AND step_id IS NOT NULL AND char_length(step_id) BETWEEN 1 AND 200
      AND tool_name IS NOT NULL AND char_length(tool_name) BETWEEN 1 AND 200
      AND outcome IN (
        'success', 'partial_success', 'retryable_failure',
        'rolled_back_failure', 'cancelled'
      )
      AND verification_rule IN (
        'tool', 'queue_job', 'canvas_state', 'asset_manifest', 'none'
      )
      AND retryable IS NOT NULL AND verified_at IS NOT NULL
      AND replan_count IS NULL AND reason_code IS NULL AND trigger_code IS NULL
    ) OR (
      event_type = 'replan'
      AND step_id IS NULL AND tool_name IS NULL AND outcome IS NULL
      AND verification_rule IS NULL AND retryable IS NULL AND verified_at IS NULL
      AND replan_count BETWEEN 1 AND 3
      AND reason_code = 'plan_replaced'
      AND trigger_code = 'accepted_plan_change'
    )
  );

CREATE OR REPLACE FUNCTION public.prepare_agent_run_event_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_sequence integer;
  previous_step_results jsonb;
  semantic_event_count integer;
  replan_event_count integer := 0;
  should_append boolean;
BEGIN
  should_append := TG_OP = 'INSERT';
  IF TG_OP = 'INSERT' THEN
    base_sequence := 0;
    previous_step_results := '[]'::jsonb;
    NEW.replan_count := 0;
  ELSE
    base_sequence := OLD.event_sequence;
    previous_step_results := OLD.step_results;
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      IF OLD.replan_count >= 3 THEN
        RAISE EXCEPTION 'Agent Run % has reached the three-replan limit.', NEW.id
          USING ERRCODE = '23514', CONSTRAINT = 'agent_runs_replan_count_check';
      END IF;
      NEW.replan_count := OLD.replan_count + 1;
      replan_event_count := 1;
    ELSE
      NEW.replan_count := OLD.replan_count;
    END IF;
    should_append := ROW(NEW.status, NEW.plan, NEW.step_results, NEW.session_id, NEW.updated_at)
      IS DISTINCT FROM ROW(OLD.status, OLD.plan, OLD.step_results, OLD.session_id, OLD.updated_at);
  END IF;
  IF NOT should_append THEN
    NEW.event_sequence := base_sequence;
    RETURN NEW;
  END IF;
  SELECT count(*) INTO semantic_event_count
  FROM public.project_agent_run_step_outcomes(NEW.step_results, previous_step_results);
  NEW.event_sequence := base_sequence + 1 + semantic_event_count + replan_event_count;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_agent_run_snapshot_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_sequence integer;
  previous_step_results jsonb;
  semantic_event_count integer;
  is_replan boolean := false;
  should_append boolean;
BEGIN
  should_append := TG_OP = 'INSERT';
  IF TG_OP = 'INSERT' THEN
    base_sequence := 0;
    previous_step_results := '[]'::jsonb;
  ELSE
    base_sequence := OLD.event_sequence;
    previous_step_results := OLD.step_results;
    is_replan := NEW.plan IS DISTINCT FROM OLD.plan;
    should_append := NEW.event_sequence > OLD.event_sequence;
  END IF;
  IF NOT should_append THEN RETURN NEW; END IF;
  INSERT INTO public.agent_run_events (
    run_id, sequence, event_type, status, run_updated_at
  ) VALUES (
    NEW.id, base_sequence + 1, 'run_snapshot', NEW.status, NEW.updated_at
  );
  INSERT INTO public.agent_run_events (
    run_id, sequence, event_type, status, run_updated_at,
    step_id, tool_name, outcome, verification_rule, retryable, verified_at
  )
  SELECT
    NEW.id,
    (base_sequence + 1 + row_number() OVER (ORDER BY step_ordinal))::integer,
    'step_outcome', NEW.status, NEW.updated_at,
    step_id, tool_name, outcome, verification_rule, retryable, verified_at
  FROM public.project_agent_run_step_outcomes(NEW.step_results, previous_step_results);
  IF is_replan THEN
    SELECT count(*) INTO semantic_event_count
    FROM public.project_agent_run_step_outcomes(NEW.step_results, previous_step_results);
    INSERT INTO public.agent_run_events (
      run_id, sequence, event_type, status, run_updated_at,
      replan_count, reason_code, trigger_code
    ) VALUES (
      NEW.id, base_sequence + 2 + semantic_event_count, 'replan', NEW.status, NEW.updated_at,
      NEW.replan_count, 'plan_replaced', 'accepted_plan_change'
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
