const ENV_TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

// Cloudflare Turnstile site keys are public by design. We keep the current
// kkai.plus widget key here so deployments still work if build-time env vars
// are temporarily missing.
export const DEFAULT_TURNSTILE_SITE_KEY = "0x4AAAAAACsemsOXCYwfwDll";
export const TURNSTILE_ENABLED =
  String(import.meta.env.VITE_TURNSTILE_ENABLED ?? "true").trim().toLowerCase() !== "false";
export const TURNSTILE_ENV_SITE_KEY = ENV_TURNSTILE_SITE_KEY;
export const TURNSTILE_HAS_ENV_SITE_KEY = Boolean(TURNSTILE_ENV_SITE_KEY);
export const TURNSTILE_SITE_KEY = TURNSTILE_ENV_SITE_KEY || DEFAULT_TURNSTILE_SITE_KEY;
export const TURNSTILE_HAS_SITE_KEY = Boolean(TURNSTILE_SITE_KEY);
export const TURNSTILE_USING_FALLBACK_SITE_KEY =
  TURNSTILE_ENABLED && !TURNSTILE_HAS_ENV_SITE_KEY && TURNSTILE_HAS_SITE_KEY;
