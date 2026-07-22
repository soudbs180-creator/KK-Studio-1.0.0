BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS session_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_sessions_id_user_unique'
      AND conrelid = 'public.agent_sessions'::regclass
  ) THEN
    ALTER TABLE public.agent_sessions
      ADD CONSTRAINT agent_sessions_id_user_unique UNIQUE (id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_runs_session_owner_fkey'
      AND conrelid = 'public.agent_runs'::regclass
  ) THEN
    ALTER TABLE public.agent_runs
      ADD CONSTRAINT agent_runs_session_owner_fkey
      FOREIGN KEY (session_id, user_id)
      REFERENCES public.agent_sessions (id, user_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_runs_session_updated_idx
  ON public.agent_runs(session_id, updated_at DESC)
  WHERE session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_agent_run_event_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.event_sequence := 1;
  ELSIF ROW(NEW.status, NEW.plan, NEW.step_results, NEW.session_id, NEW.updated_at)
    IS DISTINCT FROM ROW(OLD.status, OLD.plan, OLD.step_results, OLD.session_id, OLD.updated_at) THEN
    NEW.event_sequence := OLD.event_sequence + 1;
  ELSE
    NEW.event_sequence := OLD.event_sequence;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
