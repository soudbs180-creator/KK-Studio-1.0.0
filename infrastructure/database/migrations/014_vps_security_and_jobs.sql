-- infrastructure/database/migrations/014_vps_security_and_jobs.sql
BEGIN;

-- 1. 新增用户凭据安全加密表
CREATE TABLE IF NOT EXISTS user_provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  auth_type text NOT NULL CHECK (auth_type IN ('api_key', 'oauth', 'platform')),
  encrypted_secret text NOT NULL, -- 经 AES-GCM 加密后的密钥密文
  encrypted_refresh_token text,   -- 加密后的 OAuth 刷新 token
  expires_at timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. 新增画布节点结构化存储表
CREATE TABLE IF NOT EXISTS canvas_nodes (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('prompt', 'image', 'workflow')),
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  last_modified timestamptz NOT NULL DEFAULT now()
);

-- 3. 新增任务异步队列追踪表
CREATE TABLE IF NOT EXISTS generation_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('image', 'video', 'ppt', 'audio', 'browser')),
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'retrying')),
  progress integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. 补齐性能优化索引
CREATE INDEX IF NOT EXISTS user_provider_credentials_user_idx ON user_provider_credentials(user_id);
CREATE INDEX IF NOT EXISTS canvas_nodes_workspace_idx ON canvas_nodes(workspace_id);
CREATE INDEX IF NOT EXISTS generation_jobs_user_status_idx ON generation_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS generation_jobs_created_idx ON generation_jobs(created_at DESC);

COMMIT;
