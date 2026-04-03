type RuntimeEnv = Record<string, string | boolean | undefined>;

type LocationLike = {
  origin?: string | null;
};

type SupportedPublicEnvName =
  | 'VITE_AUTH_REDIRECT_ORIGIN'
  | 'VITE_ENABLE_LEGACY_WEB_API_FALLBACK'
  | 'VITE_KK_API_BASE_URL'
  | 'VITE_PAYMENT_GATEWAY_URL'
  | 'VITE_SUPABASE_ANON_KEY'
  | 'VITE_SUPABASE_URL'
  | 'VITE_TURNSTILE_ENABLED'
  | 'VITE_TURNSTILE_LOCAL_BYPASS'
  | 'VITE_TURNSTILE_SITE_KEY';

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function readImportMetaEnv(): RuntimeEnv | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  // Vite only injects env values for direct `import.meta.env.FOO` access.
  // Avoid dynamic `import.meta.env[name]` lookups here or the browser bundle
  // will lose the public env values entirely.
  return {
    VITE_AUTH_REDIRECT_ORIGIN: import.meta.env.VITE_AUTH_REDIRECT_ORIGIN,
    VITE_ENABLE_LEGACY_WEB_API_FALLBACK: import.meta.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK,
    VITE_KK_API_BASE_URL: import.meta.env.VITE_KK_API_BASE_URL,
    VITE_PAYMENT_GATEWAY_URL: import.meta.env.VITE_PAYMENT_GATEWAY_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_TURNSTILE_ENABLED: import.meta.env.VITE_TURNSTILE_ENABLED,
    VITE_TURNSTILE_LOCAL_BYPASS: import.meta.env.VITE_TURNSTILE_LOCAL_BYPASS,
    VITE_TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY,
  };
}

export function readRuntimeEnv(name: string): string | undefined {
  const importMetaEnv = readImportMetaEnv();
  const importMetaValue = normalizeString(importMetaEnv?.[name as SupportedPublicEnvName]);
  if (importMetaValue) {
    return importMetaValue;
  }

  if (typeof process !== 'undefined' && process.env) {
    const processValue = normalizeString(process.env[name]);
    if (processValue) {
      return processValue;
    }
  }

  return undefined;
}

export function readRuntimeBooleanEnv(name: string, fallback: boolean): boolean {
  const value = readRuntimeEnv(name);
  if (!value) {
    return fallback;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  return fallback;
}

export function readRuntimeOrigin(): string | undefined {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeString(window.location.origin);
  }

  const locationLike = (globalThis as { location?: LocationLike }).location;
  return normalizeString(locationLike?.origin);
}
