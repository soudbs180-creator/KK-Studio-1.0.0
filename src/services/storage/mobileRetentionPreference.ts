import {
  MOBILE_RETENTION_MODES,
  type MobileRetentionMode,
} from './mobileRetentionPolicy.ts';

export const MOBILE_RETENTION_PREFERENCE_KEY = 'kk_mobile_retention_mode';
export const DEFAULT_MOBILE_RETENTION_MODE: MobileRetentionMode = '7d';

export interface MobileRetentionPreferenceStorage {
  get?(key: string): string | undefined;
  getItem?(key: string): string | null;
  set?(key: string, value: string): unknown;
  setItem?(key: string, value: string): void;
}

const MOBILE_RETENTION_MODE_SET = new Set<string>(MOBILE_RETENTION_MODES);

function resolveMobileRetentionPreferenceStorage(
  storage?: MobileRetentionPreferenceStorage | null,
): MobileRetentionPreferenceStorage | null {
  if (storage) {
    return storage;
  }

  const globalStorage = globalThis as typeof globalThis & {
    localStorage?: Storage;
  };

  return globalStorage.localStorage ?? null;
}

function isMobileRetentionMode(value: string | null | undefined): value is MobileRetentionMode {
  return typeof value === 'string' && MOBILE_RETENTION_MODE_SET.has(value);
}

function readStoredMode(storage: MobileRetentionPreferenceStorage | null): string | null {
  if (!storage) {
    return null;
  }

  try {
    if (typeof storage.getItem === 'function') {
      return storage.getItem(MOBILE_RETENTION_PREFERENCE_KEY);
    }

    if (typeof storage.get === 'function') {
      return storage.get(MOBILE_RETENTION_PREFERENCE_KEY) ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

function writeStoredMode(
  storage: MobileRetentionPreferenceStorage | null,
  mode: MobileRetentionMode,
): void {
  if (!storage) {
    return;
  }

  try {
    if (typeof storage.setItem === 'function') {
      storage.setItem(MOBILE_RETENTION_PREFERENCE_KEY, mode);
      return;
    }

    if (typeof storage.set === 'function') {
      storage.set(MOBILE_RETENTION_PREFERENCE_KEY, mode);
    }
  } catch {
    // Ignore storage write errors and keep the in-memory return contract stable.
  }
}

export function getMobileRetentionPreference(
  storage?: MobileRetentionPreferenceStorage | null,
): MobileRetentionMode | null {
  const storedMode = readStoredMode(resolveMobileRetentionPreferenceStorage(storage));
  return isMobileRetentionMode(storedMode) ? storedMode : null;
}

export function setMobileRetentionPreference(
  storage: MobileRetentionPreferenceStorage | null | undefined,
  mode: MobileRetentionMode,
): MobileRetentionMode {
  writeStoredMode(resolveMobileRetentionPreferenceStorage(storage), mode);
  return mode;
}

export function ensureMobileRetentionPreference(
  storage?: MobileRetentionPreferenceStorage | null,
): MobileRetentionMode {
  const storedMode = getMobileRetentionPreference(storage);
  if (storedMode) {
    return storedMode;
  }

  return setMobileRetentionPreference(storage, DEFAULT_MOBILE_RETENTION_MODE);
}
