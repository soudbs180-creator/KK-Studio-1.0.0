BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_admin_user_id_expires_at_idx
  ON public.admin_sessions(admin_user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS admin_sessions_active_lookup_idx
  ON public.admin_sessions(admin_user_id, session_token_hash, expires_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.admin_sessions TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_sessions'
      AND policyname = 'admin_sessions_select_own'
  ) THEN
    CREATE POLICY admin_sessions_select_own
      ON public.admin_sessions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = admin_user_id);
  END IF;
END
$$;

COMMENT ON TABLE public.admin_sessions IS
  'Server-validated admin elevation sessions. The browser only receives the opaque token; the database stores a sha256 hash.';

COMMENT ON COLUMN public.admin_sessions.revoked_at IS
  'Explicit revocation timestamp used when admin password rotation or manual lock invalidates existing elevated sessions.';

COMMIT;
