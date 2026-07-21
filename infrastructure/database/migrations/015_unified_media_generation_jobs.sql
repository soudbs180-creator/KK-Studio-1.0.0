-- 简体中文：将 generation_jobs 升级为统一图片/视频/音频批量任务与恢复控制面。
BEGIN;

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS model_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS progress_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS outputs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS output_group_json jsonb,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

UPDATE public.generation_jobs
SET status = CASE status
  WHEN 'pending' THEN 'queued'
  WHEN 'success' THEN 'completed'
  WHEN 'retrying' THEN 'queued'
  ELSE status
END;

ALTER TABLE public.generation_jobs DROP CONSTRAINT IF EXISTS generation_jobs_status_check;
ALTER TABLE public.generation_jobs
  ADD CONSTRAINT generation_jobs_status_check CHECK (
    status IN ('queued', 'running', 'paused', 'completed', 'completed_with_errors', 'failed', 'cancelled')
  );

CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_user_idempotency_idx
  ON public.generation_jobs(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS generation_jobs_lease_idx
  ON public.generation_jobs(user_id, lease_expires_at)
  WHERE lease_expires_at IS NOT NULL;

-- Agent audit rows are user scoped so a guessed run id cannot overwrite another user's record.
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS user_id text;
UPDATE public.agent_runs SET user_id = 'legacy' WHERE user_id IS NULL;
ALTER TABLE public.agent_runs ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS agent_runs_user_updated_idx
  ON public.agent_runs(user_id, updated_at DESC);

COMMIT;
