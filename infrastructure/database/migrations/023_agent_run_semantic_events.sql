BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.agent_run_events
  ADD COLUMN IF NOT EXISTS step_id text,
  ADD COLUMN IF NOT EXISTS tool_name text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS verification_rule text,
  ADD COLUMN IF NOT EXISTS retryable boolean,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.agent_run_events
  DROP CONSTRAINT IF EXISTS agent_run_events_event_type_check,
  DROP CONSTRAINT IF EXISTS agent_run_events_event_shape_check;

ALTER TABLE public.agent_run_events
  ADD CONSTRAINT agent_run_events_event_type_check
    CHECK (event_type IN ('run_snapshot', 'step_outcome')),
  ADD CONSTRAINT agent_run_events_event_shape_check CHECK (
    (
      event_type = 'run_snapshot'
      AND step_id IS NULL
      AND tool_name IS NULL
      AND outcome IS NULL
      AND verification_rule IS NULL
      AND retryable IS NULL
      AND verified_at IS NULL
    ) OR (
      event_type = 'step_outcome'
      AND step_id IS NOT NULL
      AND char_length(step_id) BETWEEN 1 AND 200
      AND tool_name IS NOT NULL
      AND char_length(tool_name) BETWEEN 1 AND 200
      AND outcome IS NOT NULL
      AND outcome IN (
        'success', 'partial_success', 'retryable_failure',
        'rolled_back_failure', 'cancelled'
      )
      AND verification_rule IS NOT NULL
      AND verification_rule IN (
        'tool', 'queue_job', 'canvas_state', 'asset_manifest', 'none'
      )
      AND retryable IS NOT NULL
      AND verified_at IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.project_agent_run_step_outcomes(
  new_step_results jsonb, old_step_results jsonb
)
RETURNS TABLE (
  step_ordinal bigint, step_id text, tool_name text, outcome text,
  verification_rule text, retryable boolean, verified_at timestamptz
)
LANGUAGE sql
IMMUTABLE
AS $$
  WITH new_steps AS (
    SELECT DISTINCT ON (entry.step ->> 'stepId') entry.step, entry.ordinal
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(new_step_results) = 'array'
        THEN new_step_results ELSE '[]'::jsonb END
    )
      WITH ORDINALITY AS entry(step, ordinal)
    WHERE jsonb_typeof(entry.step) = 'object'
      AND NULLIF(entry.step ->> 'stepId', '') IS NOT NULL
    ORDER BY entry.step ->> 'stepId', entry.ordinal DESC
  )
  SELECT
    current_step.ordinal,
    current_step.step ->> 'stepId',
    current_step.step ->> 'toolName',
    current_step.step ->> 'outcome',
    current_step.step ->> 'verificationRule',
    (current_step.step ->> 'retryable')::boolean,
    (current_step.step ->> 'verifiedAt')::timestamptz
  FROM new_steps AS current_step
  LEFT JOIN LATERAL (
    SELECT entry.step
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(old_step_results) = 'array'
        THEN old_step_results ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS entry(step, ordinal)
    WHERE entry.step ->> 'stepId' = current_step.step ->> 'stepId'
    ORDER BY entry.ordinal DESC
    LIMIT 1
  ) AS previous_step ON true
  WHERE ROW(current_step.step ->> 'toolName', current_step.step ->> 'outcome',
    current_step.step ->> 'verificationRule', current_step.step ->> 'retryable',
    current_step.step ->> 'verifiedAt') IS DISTINCT FROM ROW(
    previous_step.step ->> 'toolName', previous_step.step ->> 'outcome',
    previous_step.step ->> 'verificationRule', previous_step.step ->> 'retryable',
    previous_step.step ->> 'verifiedAt'
  )
  ORDER BY current_step.ordinal
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.prepare_agent_run_event_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_sequence integer;
  previous_step_results jsonb;
  semantic_event_count integer;
  should_append boolean;
BEGIN
  should_append := TG_OP = 'INSERT';
  IF TG_OP = 'INSERT' THEN
    base_sequence := 0;
    previous_step_results := '[]'::jsonb;
  ELSE
    base_sequence := OLD.event_sequence;
    previous_step_results := OLD.step_results;
    should_append := ROW(NEW.status, NEW.plan, NEW.step_results, NEW.session_id, NEW.updated_at)
      IS DISTINCT FROM ROW(OLD.status, OLD.plan, OLD.step_results, OLD.session_id, OLD.updated_at);
  END IF;
  IF NOT should_append THEN
    NEW.event_sequence := base_sequence;
    RETURN NEW;
  END IF;
  SELECT count(*) INTO semantic_event_count
  FROM public.project_agent_run_step_outcomes(NEW.step_results, previous_step_results);
  NEW.event_sequence := base_sequence + 1 + semantic_event_count;
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
  should_append boolean;
BEGIN
  should_append := TG_OP = 'INSERT';
  IF TG_OP = 'INSERT' THEN
    base_sequence := 0;
    previous_step_results := '[]'::jsonb;
  ELSE
    base_sequence := OLD.event_sequence;
    previous_step_results := OLD.step_results;
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
    'step_outcome',
    NEW.status,
    NEW.updated_at,
    step_id,
    tool_name,
    outcome,
    verification_rule,
    retryable,
    verified_at
  FROM public.project_agent_run_step_outcomes(NEW.step_results, previous_step_results);
  RETURN NEW;
END;
$$;

COMMIT;
