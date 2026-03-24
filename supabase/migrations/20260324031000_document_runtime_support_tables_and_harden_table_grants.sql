-- Clarify the role of retained runtime tables so the dashboard no longer
-- looks like it contains duplicate business tables, and tighten obviously
-- unnecessary client table grants without removing active runtime surfaces.

COMMENT ON TABLE public.admin_credit_models IS
  'Runtime provider/model configuration store used by the admin console. Secrets must stay behind admin-only RPCs or server-side routes.';

COMMENT ON TABLE public.credit_exchange_rates IS
  'Canonical recharge exchange-rate table for supported currencies, credits-per-unit, and min/max recharge limits.';

COMMENT ON TABLE public.external_identities IS
  'Provider identity bridge for WeChat/OAuth bindings and raw provider profiles. Canonical user metadata still lives in public.profiles.';

COMMENT ON TABLE public.generation_tasks IS
  'Async generation task snapshot store used to restore job status after page refresh. This is separate from billing and payment ledgers.';

COMMENT ON TABLE public.provider_pricing_cache IS
  'Runtime cache of provider pricing payloads used by the pricing UI. This is not a canonical billing ledger or credit balance table.';

COMMENT ON TABLE public.temp_users IS
  'Temporary guest identity store with a 24-hour TTL. Canonical registered users are still represented by auth.users and public.profiles.';

REVOKE ALL ON TABLE public.external_identities FROM PUBLIC;
REVOKE ALL ON TABLE public.external_identities FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.external_identities
  FROM authenticated;
GRANT SELECT ON TABLE public.external_identities TO authenticated;

REVOKE ALL ON TABLE public.generation_tasks FROM PUBLIC;
REVOKE ALL ON TABLE public.generation_tasks FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.generation_tasks
  FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.generation_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.generation_tasks TO service_role;

REVOKE ALL ON TABLE public.provider_pricing_cache FROM PUBLIC;
REVOKE ALL ON TABLE public.provider_pricing_cache FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.provider_pricing_cache
  FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.provider_pricing_cache TO authenticated;
