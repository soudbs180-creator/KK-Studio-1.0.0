const ENV_TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

// Turnstile must use an explicit site key from the current deployment
// environment. Falling back to a stale hard-coded key can break auth entirely.
export const DEFAULT_TURNSTILE_SITE_KEY = "";
export const TURNSTILE_ENABLED =
  String(import.meta.env.VITE_TURNSTILE_ENABLED ?? "true").trim().toLowerCase() !== "false";
export const TURNSTILE_ENV_SITE_KEY = ENV_TURNSTILE_SITE_KEY;
export const TURNSTILE_HAS_ENV_SITE_KEY = Boolean(TURNSTILE_ENV_SITE_KEY);
export const TURNSTILE_SITE_KEY = TURNSTILE_ENV_SITE_KEY || DEFAULT_TURNSTILE_SITE_KEY;
export const TURNSTILE_HAS_SITE_KEY = Boolean(TURNSTILE_SITE_KEY);
export const TURNSTILE_USING_FALLBACK_SITE_KEY =
  TURNSTILE_ENABLED && !TURNSTILE_HAS_ENV_SITE_KEY && TURNSTILE_HAS_SITE_KEY;
