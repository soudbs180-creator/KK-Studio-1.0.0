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
  if (!hostname) return false;
  const lower = hostname.trim().toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.sslip.io') ||
    lower.endsWith('.nip.io') ||
    /^192\.168\.\d+\.\d+$/.test(lower) ||
    /^10\.\d+\.\d+\.\d+$/.test(lower) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(lower)
  );
}

export const TURNSTILE_LOCAL_BYPASS = readRuntimeBooleanEnv('VITE_TURNSTILE_LOCAL_BYPASS', false);
export const TURNSTILE_LOCAL_BYPASS_HOST = getRuntimeHostname();
const TURNSTILE_LOCAL_HOST = isLocalTurnstileBypassHost(TURNSTILE_LOCAL_BYPASS_HOST);
export const TURNSTILE_LOCAL_BYPASS_ENABLED = readRuntimeBooleanEnv(
  'VITE_TURNSTILE_LOCAL_BYPASS',
  false,
);
export const TURNSTILE_LOCAL_BYPASS_ACTIVE =
  TURNSTILE_LOCAL_BYPASS_ENABLED && TURNSTILE_LOCAL_HOST;

export const TURNSTILE_ENABLED =
  readRuntimeBooleanEnv('VITE_TURNSTILE_ENABLED', true) && !TURNSTILE_LOCAL_BYPASS_ACTIVE;
export const TURNSTILE_ENV_SITE_KEY = ENV_TURNSTILE_SITE_KEY;
export const TURNSTILE_HAS_ENV_SITE_KEY = Boolean(TURNSTILE_ENV_SITE_KEY);
export const TURNSTILE_SITE_KEY = TURNSTILE_ENV_SITE_KEY;
export const TURNSTILE_HAS_SITE_KEY = TURNSTILE_HAS_ENV_SITE_KEY;
