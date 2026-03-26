type RuntimeEnv = Record<string, string | boolean | undefined>;

type LocationLike = {
  origin?: string | null;
};

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function readImportMetaEnv(): RuntimeEnv | undefined {
  const meta = import.meta as ImportMeta & { env?: RuntimeEnv };
  return meta.env;
}

export function readRuntimeEnv(name: string): string | undefined {
  const importMetaValue = normalizeString(readImportMetaEnv()?.[name]);
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
