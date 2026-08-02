-- Provider Connection 的 owner 级稳定排序与乐观并发 revision。
-- Quote 仍冻结具体 Connection/Binding 版本；排序本身不改写 updated_at。

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.provider_connections
  ADD COLUMN IF NOT EXISTS routing_priority integer;

-- 018 对该表启用了 FORCE RLS。迁移必须按 owner 全量初始化，不能依赖
-- app.current_user_id 或仅更新当前租户；事务回滚会自动恢复原状态。
ALTER TABLE public.provider_connections NO FORCE ROW LEVEL SECURITY;

WITH ranked AS (
  SELECT connection_id,
         row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC, connection_id) - 1 AS priority
  FROM public.provider_connections
  WHERE revoked_at IS NULL
)
UPDATE public.provider_connections AS connection
SET routing_priority = ranked.priority
FROM ranked
WHERE connection.connection_id = ranked.connection_id
  AND connection.routing_priority IS NULL;

UPDATE public.provider_connections
SET routing_priority = 0
WHERE routing_priority IS NULL;

ALTER TABLE public.provider_connections
  ALTER COLUMN routing_priority SET DEFAULT 0,
  ALTER COLUMN routing_priority SET NOT NULL;

CREATE INDEX IF NOT EXISTS provider_connections_owner_routing_priority_idx
  ON public.provider_connections (user_id, routing_priority, connection_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.provider_connection_order_revisions (
  user_id text PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 重复演练时该表已处于 FORCE RLS；初始化仍必须覆盖所有 owner。
ALTER TABLE public.provider_connection_order_revisions NO FORCE ROW LEVEL SECURITY;

INSERT INTO public.provider_connection_order_revisions (user_id, revision)
SELECT DISTINCT user_id, 0
FROM public.provider_connections
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.provider_connections FORCE ROW LEVEL SECURITY;

ALTER TABLE public.provider_connection_order_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_connection_order_revisions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_connection_order_revisions'
      AND policyname = 'provider_connection_order_revisions_user_policy'
  ) THEN
    CREATE POLICY provider_connection_order_revisions_user_policy
      ON public.provider_connection_order_revisions
      FOR ALL
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;

COMMENT ON COLUMN public.provider_connections.routing_priority IS
  'Owner-scoped Provider route priority; smaller values are selected first.';

COMMIT;
