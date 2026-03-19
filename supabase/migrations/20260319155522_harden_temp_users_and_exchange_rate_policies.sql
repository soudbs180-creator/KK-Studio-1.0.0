REVOKE ALL ON TABLE public.temp_users FROM PUBLIC;
REVOKE ALL ON TABLE public.temp_users FROM anon;
REVOKE ALL ON TABLE public.temp_users FROM authenticated;
GRANT INSERT ON TABLE public.temp_users TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.temp_users TO authenticated;
GRANT ALL ON TABLE public.temp_users TO service_role;

DROP POLICY IF EXISTS "Allow public to create temp users" ON public.temp_users;
DROP POLICY IF EXISTS "Allow public to read own temp user" ON public.temp_users;
DROP POLICY IF EXISTS "Allow public to update own temp user" ON public.temp_users;
DROP POLICY IF EXISTS "Admins can view temp users" ON public.temp_users;
DROP POLICY IF EXISTS "Admins can update temp users" ON public.temp_users;

CREATE POLICY "Allow public to create temp users"
ON public.temp_users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  is_active = TRUE
  AND expires_at > NOW()
  AND expires_at <= NOW() + INTERVAL '24 hours'
  AND created_at >= NOW() - INTERVAL '5 minutes'
  AND created_at <= NOW() + INTERVAL '5 minutes'
  AND id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
);

CREATE POLICY "Admins can view temp users"
ON public.temp_users
FOR SELECT
TO authenticated
USING (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

CREATE POLICY "Admins can update temp users"
ON public.temp_users
FOR UPDATE
TO authenticated
USING (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
)
WITH CHECK (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Authenticated users can read active exchange rates" ON public.credit_exchange_rates;
CREATE POLICY "Authenticated users can read active exchange rates"
ON public.credit_exchange_rates
FOR SELECT
TO authenticated
USING (
  is_active = TRUE
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Admins can read all exchange rates" ON public.credit_exchange_rates;
CREATE POLICY "Admins can read all exchange rates"
ON public.credit_exchange_rates
FOR SELECT
TO authenticated
USING (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Admins can insert exchange rates" ON public.credit_exchange_rates;
CREATE POLICY "Admins can insert exchange rates"
ON public.credit_exchange_rates
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Admins can update exchange rates" ON public.credit_exchange_rates;
CREATE POLICY "Admins can update exchange rates"
ON public.credit_exchange_rates
FOR UPDATE
TO authenticated
USING (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
)
WITH CHECK (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Admins can delete exchange rates" ON public.credit_exchange_rates;
CREATE POLICY "Admins can delete exchange rates"
ON public.credit_exchange_rates
FOR DELETE
TO authenticated
USING (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

CREATE OR REPLACE FUNCTION public.touch_credit_exchange_rates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$;
