import { readRuntimeEnv, readRuntimeOrigin } from '../utils/runtimeEnv.ts';

const rawAuthRedirectOrigin = readRuntimeEnv('VITE_AUTH_REDIRECT_ORIGIN') || '';

export function normalizeAuthRedirectOrigin(origin: string): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).origin;
  } catch {
    console.warn(
      `[Auth] Ignoring invalid VITE_AUTH_REDIRECT_ORIGIN: "${origin}". Falling back to the current browser origin.`
    );
    return null;
  }
}

const explicitAuthRedirectOrigin = normalizeAuthRedirectOrigin(rawAuthRedirectOrigin);

export function resolveAuthRedirectOrigin(): string {
  if (explicitAuthRedirectOrigin) {
    return explicitAuthRedirectOrigin;
  }

  const runtimeOrigin = readRuntimeOrigin();
  if (!runtimeOrigin) {
    throw new Error(
      'Auth redirect origin is unavailable outside the browser. Set VITE_AUTH_REDIRECT_ORIGIN to use auth redirects in this environment.'
    );
  }

  return runtimeOrigin;
}

export function buildAuthRedirectUrl(path = '/auth/callback'): string {
  return new URL(path, `${resolveAuthRedirectOrigin()}/`).toString();
}
