BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS event_sequence integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.agent_run_events (
  run_id text NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type = 'run_snapshot'),
  status text NOT NULL CHECK (status IN (
    'planning',
    'waiting_confirmation',
    'waiting_execution',
    'running',
    'completed',
    'completed_with_errors',
    'failed',
    'cancelled'
  )),
  run_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, sequence)
);

DROP TRIGGER IF EXISTS prepare_agent_run_event_sequence ON public.agent_runs;
DROP TRIGGER IF EXISTS append_agent_run_snapshot_event ON public.agent_runs;

UPDATE public.agent_runs
   SET event_sequence = 1
 WHERE event_sequence = 0;

INSERT INTO public.agent_run_events (
  run_id,
  sequence,
  event_type,
  status,
  run_updated_at,
  created_at
)
SELECT
  id,
  event_sequence,
  'run_snapshot',
  status,
  updated_at,
  now()
FROM public.agent_runs
ON CONFLICT (run_id, sequence) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prepare_agent_run_event_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.event_sequence := 1;
  ELSIF ROW(NEW.status, NEW.plan, NEW.step_results, NEW.updated_at)
    IS DISTINCT FROM ROW(OLD.status, OLD.plan, OLD.step_results, OLD.updated_at) THEN
    NEW.event_sequence := OLD.event_sequence + 1;
  ELSE
    NEW.event_sequence := OLD.event_sequence;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_agent_run_snapshot_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  should_append boolean;
BEGIN
  should_append := TG_OP = 'INSERT';
  IF TG_OP <> 'INSERT' THEN
    should_append := NEW.event_sequence > OLD.event_sequence;
  END IF;
  IF should_append THEN
    INSERT INTO public.agent_run_events (
      run_id,
      sequence,
      event_type,
      status,
      run_updated_at
    ) VALUES (
      NEW.id,
      NEW.event_sequence,
      'run_snapshot',
      NEW.status,
      NEW.updated_at
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prepare_agent_run_event_sequence
BEFORE INSERT OR UPDATE ON public.agent_runs
FOR EACH ROW EXECUTE FUNCTION public.prepare_agent_run_event_sequence();

CREATE TRIGGER append_agent_run_snapshot_event
AFTER INSERT OR UPDATE ON public.agent_runs
FOR EACH ROW EXECUTE FUNCTION public.append_agent_run_snapshot_event();

COMMIT;
