import { readRuntimeBooleanEnv, readRuntimeEnv } from '../utils/runtimeEnv.ts';

const ENV_TURNSTILE_SITE_KEY = readRuntimeEnv('VITE_TURNSTILE_SITE_KEY') || '';

function getRuntimeHostname(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname.trim().toLowerCase();
  }

  const locationLike = (globalThis as { location?: { hostname?: string | null } }).location;
  return String(locationLike?.hostname || '').trim().toLowerCase();
}

function isLocalTurnstileBypassHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');
}

export const TURNSTILE_LOCAL_BYPASS = readRuntimeBooleanEnv('VITE_TURNSTILE_LOCAL_BYPASS', false);
export const TURNSTILE_LOCAL_BYPASS_HOST = getRuntimeHostname();
const TURNSTILE_LOCAL_HOST = isLocalTurnstileBypassHost(TURNSTILE_LOCAL_BYPASS_HOST);
export const TURNSTILE_LOCAL_BYPASS_ENABLED = readRuntimeBooleanEnv(
  'VITE_TURNSTILE_LOCAL_BYPASS',
  TURNSTILE_LOCAL_HOST,
);
export const TURNSTILE_LOCAL_BYPASS_ACTIVE =
  TURNSTILE_LOCAL_BYPASS_ENABLED && TURNSTILE_LOCAL_HOST;

// Cloudflare Turnstile site keys are public by design. We keep the current
// kkai.plus widget key here so deployments still work if build-time env vars
// are temporarily missing.
export const DEFAULT_TURNSTILE_SITE_KEY = "0x4AAAAAACsemsOXCYwfwDll";
export const TURNSTILE_ENABLED =
  readRuntimeBooleanEnv('VITE_TURNSTILE_ENABLED', true) && !TURNSTILE_LOCAL_BYPASS_ACTIVE;
export const TURNSTILE_ENV_SITE_KEY = ENV_TURNSTILE_SITE_KEY;
export const TURNSTILE_HAS_ENV_SITE_KEY = Boolean(TURNSTILE_ENV_SITE_KEY);
export const TURNSTILE_SITE_KEY = TURNSTILE_ENV_SITE_KEY || DEFAULT_TURNSTILE_SITE_KEY;
export const TURNSTILE_HAS_SITE_KEY = Boolean(TURNSTILE_SITE_KEY);
export const TURNSTILE_USING_FALLBACK_SITE_KEY =
  TURNSTILE_ENABLED && !TURNSTILE_HAS_ENV_SITE_KEY && TURNSTILE_HAS_SITE_KEY;
