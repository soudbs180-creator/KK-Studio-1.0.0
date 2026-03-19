DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions"
ON public.credit_transactions
FOR SELECT
TO public
USING (
  user_id = (SELECT auth.uid())
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Users read own transactions" ON public.credit_transactions;
CREATE POLICY "Users read own transactions"
ON public.credit_transactions
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  COALESCE((SELECT public.is_admin()), FALSE)
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO public
USING (
  id = (SELECT auth.uid())
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = id
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = id
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = id
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
)
WITH CHECK (
  (SELECT auth.uid()) = id
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits"
ON public.user_credits
FOR SELECT
TO public
USING (
  user_id = (SELECT auth.uid())
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Users view own balance" ON public.user_credits;
CREATE POLICY "Users view own balance"
ON public.user_credits
FOR SELECT
TO public
USING (
  (SELECT auth.uid()) = user_id
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "user_credits_select_own" ON public.user_credits;
CREATE POLICY "user_credits_select_own"
ON public.user_credits
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Users view own usage records" ON public.usage_records;
CREATE POLICY "Users view own usage records"
ON public.usage_records
FOR SELECT
TO public
USING (
  (SELECT auth.uid()) = user_id
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Allow read pricing cache" ON public.provider_pricing_cache;
CREATE POLICY "Allow read pricing cache"
ON public.provider_pricing_cache
FOR SELECT
TO authenticated
USING (
  COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);
