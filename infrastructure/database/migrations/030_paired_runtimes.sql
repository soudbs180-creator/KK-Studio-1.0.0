-- 配对运行时：手机端只提交 owner-scoped Agent Run，桌面端通过主动出站领取命令。
CREATE TABLE IF NOT EXISTS public.paired_runtimes (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  display_name varchar(120) NOT NULL,
  credential_hash char(64) NOT NULL,
  credential_expires_at timestamptz NOT NULL,
  capability_manifest jsonb NOT NULL DEFAULT '{"schemaVersion":1,"tools":[],"siteAdapters":[]}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'offline',
  last_heartbeat_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paired_runtimes_status_check CHECK (status IN ('online', 'offline', 'revoked')),
  CONSTRAINT paired_runtimes_credential_expiry_check CHECK (credential_expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS paired_runtimes_owner_updated_idx
  ON public.paired_runtimes (user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS paired_runtimes_owner_name_active_idx
  ON public.paired_runtimes (user_id, lower(display_name))
  WHERE revoked_at IS NULL;

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS execution_target varchar(32) NOT NULL DEFAULT 'local-desktop',
  ADD COLUMN IF NOT EXISTS paired_runtime_id uuid;

ALTER TABLE public.agent_runs
  DROP CONSTRAINT IF EXISTS agent_runs_execution_target_check,
  DROP CONSTRAINT IF EXISTS agent_runs_paired_runtime_target_check,
  DROP CONSTRAINT IF EXISTS agent_runs_paired_runtime_id_fkey;

ALTER TABLE public.agent_runs
  ADD CONSTRAINT agent_runs_execution_target_check
    CHECK (execution_target IN ('local-desktop', 'paired-desktop', 'cloud')),
  ADD CONSTRAINT agent_runs_paired_runtime_target_check
    CHECK (
      (execution_target = 'paired-desktop' AND paired_runtime_id IS NOT NULL)
      OR (execution_target <> 'paired-desktop' AND paired_runtime_id IS NULL)
    ),
  ADD CONSTRAINT agent_runs_paired_runtime_id_fkey
    FOREIGN KEY (paired_runtime_id) REFERENCES public.paired_runtimes(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.paired_runtime_commands (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  runtime_id uuid NOT NULL REFERENCES public.paired_runtimes(id) ON DELETE CASCADE,
  run_id varchar(255) NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  idempotency_key varchar(255) NOT NULL,
  command_envelope jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'queued',
  lease_token_hash char(64),
  leased_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  result_summary varchar(1000),
  error_code varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT paired_runtime_commands_status_check
    CHECK (status IN ('queued', 'leased', 'completed', 'failed', 'cancelled')),
  CONSTRAINT paired_runtime_commands_attempt_check CHECK (attempt_count BETWEEN 0 AND 20),
  CONSTRAINT paired_runtime_commands_envelope_check CHECK (
    jsonb_typeof(command_envelope) = 'object'
    AND command_envelope->>'kind' = 'agent_run'
    AND command_envelope->>'runId' = run_id
    AND command_envelope->>'schemaVersion' = '1'
    AND jsonb_typeof(command_envelope->'commands') = 'array'
    AND jsonb_array_length(command_envelope->'commands') BETWEEN 1 AND 20
  ),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS paired_runtime_commands_claim_idx
  ON public.paired_runtime_commands (runtime_id, status, created_at ASC);

ALTER TABLE public.paired_runtimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paired_runtime_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paired_runtimes_owner_policy ON public.paired_runtimes;
CREATE POLICY paired_runtimes_owner_policy ON public.paired_runtimes
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS paired_runtime_commands_owner_policy ON public.paired_runtime_commands;
CREATE POLICY paired_runtime_commands_owner_policy ON public.paired_runtime_commands
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
