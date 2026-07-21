BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

-- KK Studio v1.6.0
-- 为 AI 知识、技能与画布快照增加明确的所有权边界。
-- 旧数据只标记为 legacy，不推断用户归属，也不进入普通用户查询。

-- 011 使用了 timestamp without time zone。历史值按当时约定视为 UTC，
-- 只转换仍是无时区类型的列，避免对已升级库重复执行 AT TIME ZONE。
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('agent_runs', 'created_at'),
      ('agent_runs', 'updated_at'),
      ('agent_tool_calls', 'started_at'),
      ('agent_tool_calls', 'completed_at'),
      ('agent_memory', 'created_at'),
      ('agent_memory', 'updated_at'),
      ('knowledge_documents', 'created_at'),
      ('knowledge_documents', 'updated_at'),
      ('knowledge_chunks', 'created_at'),
      ('canvas_runtime_snapshots', 'created_at'),
      ('canvas_runtime_snapshots', 'updated_at'),
      ('agent_skills', 'created_at'),
      ('agent_skills', 'updated_at')
    ) AS columns_to_upgrade(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target.table_name
        AND column_name = target.column_name
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
        target.table_name,
        target.column_name,
        target.column_name
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS step_results jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.agent_runs SET user_id = 'legacy' WHERE user_id IS NULL;
UPDATE public.agent_runs SET step_results = '[]'::jsonb WHERE step_results IS NULL;

ALTER TABLE public.agent_runs
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN step_results SET DEFAULT '[]'::jsonb,
  ALTER COLUMN step_results SET NOT NULL;

CREATE INDEX IF NOT EXISTS agent_runs_user_updated_idx
  ON public.agent_runs (user_id, updated_at DESC);

ALTER TABLE public.agent_tool_calls
  ADD COLUMN IF NOT EXISTS step_id text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS failure_class text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS retryable boolean;

ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS owner_scope text NOT NULL DEFAULT 'legacy';

ALTER TABLE public.agent_skills
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS owner_scope text NOT NULL DEFAULT 'legacy';

ALTER TABLE public.canvas_runtime_snapshots
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS owner_scope text NOT NULL DEFAULT 'legacy';

CREATE TABLE IF NOT EXISTS public.agent_skill_versions (
  user_id text NOT NULL,
  skill_key text NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, skill_key)
);

CREATE INDEX IF NOT EXISTS agent_skill_versions_user_updated_idx
  ON public.agent_skill_versions (user_id, updated_at DESC);

INSERT INTO public.agent_skill_versions (user_id, skill_key, updated_at, deleted)
SELECT user_id, name, updated_at, false
FROM public.agent_skills
WHERE owner_scope = 'user' AND user_id IS NOT NULL
ON CONFLICT (user_id, skill_key)
DO UPDATE SET
  updated_at = EXCLUDED.updated_at,
  deleted = false
WHERE public.agent_skill_versions.updated_at < EXCLUDED.updated_at
   OR (
     public.agent_skill_versions.updated_at = EXCLUDED.updated_at
     AND public.agent_skill_versions.deleted = false
   );

UPDATE public.knowledge_documents
SET owner_scope = 'legacy', user_id = NULL
WHERE owner_scope IS NULL
   OR owner_scope NOT IN ('system', 'user', 'legacy')
   OR (owner_scope = 'user' AND user_id IS NULL)
   OR (owner_scope IN ('system', 'legacy') AND user_id IS NOT NULL);

UPDATE public.agent_skills
SET owner_scope = 'legacy', user_id = NULL
WHERE owner_scope IS NULL
   OR owner_scope NOT IN ('system', 'user', 'legacy')
   OR (owner_scope = 'user' AND user_id IS NULL)
   OR (owner_scope IN ('system', 'legacy') AND user_id IS NOT NULL);

UPDATE public.canvas_runtime_snapshots
SET owner_scope = 'legacy', user_id = NULL
WHERE owner_scope IS NULL
   OR owner_scope NOT IN ('system', 'user', 'legacy')
   OR (owner_scope = 'user' AND user_id IS NULL)
   OR (owner_scope IN ('system', 'legacy') AND user_id IS NOT NULL);

-- ADD COLUMN IF NOT EXISTS 不会修复部分部署中已经存在但仍可空/缺省值错误的列。
-- 在数据归一化后显式收紧列定义，保证重复迁移也恢复 canonical schema。
ALTER TABLE public.knowledge_documents
  ALTER COLUMN owner_scope SET DEFAULT 'legacy',
  ALTER COLUMN owner_scope SET NOT NULL;

ALTER TABLE public.agent_skills
  ALTER COLUMN owner_scope SET DEFAULT 'legacy',
  ALTER COLUMN owner_scope SET NOT NULL;

ALTER TABLE public.canvas_runtime_snapshots
  ALTER COLUMN owner_scope SET DEFAULT 'legacy',
  ALTER COLUMN owner_scope SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'knowledge_documents_owner_scope_check'
      AND conrelid = 'public.knowledge_documents'::regclass
  ) THEN
    ALTER TABLE public.knowledge_documents
      ADD CONSTRAINT knowledge_documents_owner_scope_check
      CHECK (
        (owner_scope = 'user' AND user_id IS NOT NULL)
        OR (owner_scope IN ('system', 'legacy') AND user_id IS NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_skills_owner_scope_check'
      AND conrelid = 'public.agent_skills'::regclass
  ) THEN
    ALTER TABLE public.agent_skills
      ADD CONSTRAINT agent_skills_owner_scope_check
      CHECK (
        (owner_scope = 'user' AND user_id IS NOT NULL)
        OR (owner_scope IN ('system', 'legacy') AND user_id IS NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'canvas_runtime_snapshots_owner_scope_check'
      AND conrelid = 'public.canvas_runtime_snapshots'::regclass
  ) THEN
    ALTER TABLE public.canvas_runtime_snapshots
      ADD CONSTRAINT canvas_runtime_snapshots_owner_scope_check
      CHECK (
        (owner_scope = 'user' AND user_id IS NOT NULL)
        OR (owner_scope IN ('system', 'legacy') AND user_id IS NULL)
      );
  END IF;
END $$;

ALTER TABLE public.agent_skills
  DROP CONSTRAINT IF EXISTS agent_skills_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS agent_skills_user_name_idx
  ON public.agent_skills (user_id, name)
  WHERE owner_scope = 'user';

CREATE INDEX IF NOT EXISTS agent_skills_user_updated_idx
  ON public.agent_skills (user_id, updated_at DESC)
  WHERE owner_scope = 'user';

CREATE INDEX IF NOT EXISTS knowledge_documents_user_updated_idx
  ON public.knowledge_documents (user_id, updated_at DESC)
  WHERE owner_scope = 'user';

CREATE INDEX IF NOT EXISTS knowledge_documents_system_updated_idx
  ON public.knowledge_documents (updated_at DESC)
  WHERE owner_scope = 'system';

CREATE INDEX IF NOT EXISTS canvas_runtime_snapshots_user_canvas_idx
  ON public.canvas_runtime_snapshots (user_id, canvas_id, created_at DESC)
  WHERE owner_scope = 'user';

COMMENT ON COLUMN public.knowledge_documents.owner_scope IS
  'system=全局只读知识，user=用户私有知识，legacy=未确认归属的历史数据';

COMMENT ON COLUMN public.agent_skills.owner_scope IS
  'system=系统技能，user=用户私有技能，legacy=未确认归属的历史数据';

COMMENT ON COLUMN public.canvas_runtime_snapshots.owner_scope IS
  'user=用户私有快照，legacy=未确认归属的历史数据';

COMMENT ON TABLE public.agent_skill_versions IS
  '按用户和 Skill 名称建立单调版本闸门；deleted=true 阻止不同客户端 ID 的旧 upsert 在删除后复活记录';

COMMIT;
