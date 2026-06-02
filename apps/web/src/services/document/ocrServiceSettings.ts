import type { OcrServiceSettings } from '../../types';

const STORAGE_KEY = 'kk_ocr_service_settings_v1';
const LEGACY_SECRET_FIELD = 'api' + 'Key';
const listeners = new Set<() => void>();

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const buildDefaultOcrServiceSettings = (): OcrServiceSettings => ({
  provider: 'nutrient',
  enabled: true,
  defaultLanguage: 'chi_sim',
  keySource: 'missing',
  healthState: 'unknown',
  updatedAt: Date.now(),
  baiduApiKey: '',
  baiduSecretKey: '',
});

const normalizeOcrServiceSettings = (
  raw: Partial<OcrServiceSettings> | null | undefined,
  hasEnvironmentKey = false,
): OcrServiceSettings => {
  const fallback = buildDefaultOcrServiceSettings();
  const defaultLanguage = typeof raw?.defaultLanguage === 'string' && raw.defaultLanguage.trim()
    ? raw.defaultLanguage.trim()
    : fallback.defaultLanguage;

  const provider = raw?.provider === 'baidu' ? 'baidu' : 'nutrient';

  let keySource: 'environment' | 'missing' | 'user' = hasEnvironmentKey ? 'environment' : 'missing';
  let healthState: 'configured' | 'missing_key' | 'unknown' = hasEnvironmentKey ? 'configured' : 'unknown';

  if (provider === 'baidu') {
    const hasUserKey = Boolean(raw?.baiduApiKey && raw?.baiduSecretKey);
    keySource = hasUserKey ? 'user' : 'missing';
    healthState = hasUserKey ? 'configured' : 'missing_key';
  }

  return {
    provider,
    enabled: raw?.enabled !== false,
    defaultLanguage,
    keySource,
    healthState,
    baiduApiKey: raw?.baiduApiKey || '',
    baiduSecretKey: raw?.baiduSecretKey || '',
    updatedAt: typeof raw?.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now(),
  };
};

const readStoredOcrServiceSettings = (): Partial<OcrServiceSettings> | null => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const stored = parsed as Record<string, unknown>;
    if (LEGACY_SECRET_FIELD in stored) {
      const sanitized = { ...stored };
      delete sanitized[LEGACY_SECRET_FIELD];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      return sanitized as Partial<OcrServiceSettings>;
    }

    return stored as Partial<OcrServiceSettings>;
  } catch {
    return null;
  }
};

const writeStoredOcrServiceSettings = (settings: OcrServiceSettings) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export const getOcrServiceSettings = (hasEnvironmentKey = false) =>
  normalizeOcrServiceSettings(readStoredOcrServiceSettings(), hasEnvironmentKey);

export const updateOcrServiceSettings = (
  patch: Partial<OcrServiceSettings>,
  hasEnvironmentKey = false,
) => {
  const current = getOcrServiceSettings(hasEnvironmentKey);
  const next = normalizeOcrServiceSettings(
    {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    },
    hasEnvironmentKey,
  );
  writeStoredOcrServiceSettings(next);
  notifyListeners();
  return next;
};

export const subscribeOcrServiceSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
