-- Remove expired temp-user sessions that never promoted into canonical runtime tables.
-- Keep live temp_users support, but delete historical rows that are already past TTL
-- and have no corresponding profile, credit account, or credit ledger activity.

WITH deletable_temp_users AS (
  SELECT tu.id
  FROM public.temp_users AS tu
  WHERE tu.expires_at < now()
    AND NOT (
      tu.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = tu.id::uuid
      )
    )
    AND NOT (
      tu.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1
        FROM public.user_credits AS uc
        WHERE uc.user_id = tu.id::uuid
      )
    )
    AND NOT (
      tu.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1
        FROM public.credit_transactions AS ct
        WHERE ct.user_id = tu.id::uuid
      )
    )
)
DELETE FROM public.temp_users AS tu
USING deletable_temp_users AS d
WHERE tu.id = d.id;
