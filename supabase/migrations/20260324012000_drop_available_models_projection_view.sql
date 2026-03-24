BEGIN;

-- Runtime model reads now go through get_active_credit_models(), which reads
-- public.admin_credit_models directly. Remove the legacy projection view so the
-- schema has a single visible source of truth for model catalog data.
DROP VIEW IF EXISTS public.available_models_for_users;

COMMIT;
