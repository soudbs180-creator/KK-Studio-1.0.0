-- Exclude Supabase anonymous-auth sessions from credit model metadata policies.
-- This keeps public model metadata available to real signed-in users while removing
-- a remaining advisor warning on admin_credit_models.

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view public model metadata" ON public.admin_credit_models;
DROP POLICY IF EXISTS "Admins full access to credit models" ON public.admin_credit_models;

CREATE POLICY "Authenticated users can view public model metadata"
ON public.admin_credit_models
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND is_active = TRUE
  AND COALESCE(visibility, 'public') = 'public'
);

CREATE POLICY "Admins full access to credit models"
ON public.admin_credit_models
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

COMMIT;
