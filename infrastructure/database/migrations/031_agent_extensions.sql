-- Agent 扩展统一管理 Skill、MCP 与 Plugin；secret 仅保存加密引用，不落明文。
CREATE TABLE IF NOT EXISTS public.agent_extensions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  extension_type varchar(16) NOT NULL,
  manifest_key varchar(200) NOT NULL,
  display_name varchar(200) NOT NULL,
  manifest jsonb NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  secret_ref varchar(500),
  enabled boolean NOT NULL DEFAULT true,
  import_source varchar(32) NOT NULL DEFAULT 'user',
  legacy_readonly_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_extensions_type_check CHECK (extension_type IN ('skill', 'mcp', 'plugin')),
  CONSTRAINT agent_extensions_permissions_check CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT agent_extensions_manifest_check CHECK (jsonb_typeof(manifest) = 'object'),
  CONSTRAINT agent_extensions_import_source_check CHECK (import_source IN ('user', 'local-import', 'system')),
  UNIQUE (user_id, extension_type, manifest_key)
);

CREATE INDEX IF NOT EXISTS agent_extensions_owner_type_updated_idx
  ON public.agent_extensions (user_id, extension_type, updated_at DESC);

ALTER TABLE public.agent_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_extensions_owner_policy ON public.agent_extensions;
CREATE POLICY agent_extensions_owner_policy ON public.agent_extensions
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- 首轮登录可按 manifest_key 幂等导入旧 Skill；旧源只读窗口由应用写入 legacy_readonly_until。
INSERT INTO public.agent_extensions (
  id,
  user_id,
  extension_type,
  manifest_key,
  display_name,
  manifest,
  permissions,
  import_source,
  legacy_readonly_until,
  created_at,
  updated_at
)
SELECT
  md5(skill.user_id || ':skill:' || skill.name)::uuid,
  skill.user_id,
  'skill',
  skill.name,
  skill.name,
  jsonb_build_object(
    'schemaVersion', 1,
    'trigger', skill.trigger_text,
    'tools', to_jsonb(COALESCE(skill.tools, ARRAY[]::text[])),
    'steps', to_jsonb(COALESCE(skill.steps, ARRAY[]::text[]))
  ),
  to_jsonb(COALESCE(skill.safety, ARRAY[]::text[])),
  'local-import',
  now() + interval '90 days',
  COALESCE(skill.created_at, now()),
  COALESCE(skill.updated_at, now())
FROM public.agent_skills AS skill
WHERE skill.user_id IS NOT NULL
ON CONFLICT (user_id, extension_type, manifest_key) DO NOTHING;
