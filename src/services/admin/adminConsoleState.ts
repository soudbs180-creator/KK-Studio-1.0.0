export type AdminSystemTab = 'credit-models' | 'exchange-rates' | 'admin-console';

export const ADMIN_CONSOLE_DRAFT_SCOPE = 'admin-console-draft';
export const CREDIT_MODEL_DRAFT_SCOPE = 'credit-model-draft';
export const EXCHANGE_RATE_DRAFT_SCOPE = 'exchange-rate-draft';

const ADMIN_CONSOLE_STATE_STORAGE_PREFIX = 'kk.admin.console.state.v1';
const ADMIN_SYSTEM_TAB_SCOPE = 'admin-system-tab';
const VALID_ADMIN_SYSTEM_TABS = new Set<AdminSystemTab>([
  'credit-models',
  'exchange-rates',
  'admin-console',
]);

type StoredAdminConsoleEnvelope<T> = {
  version: 1;
  savedAt: string;
  value: T;
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStorage(): Storage | undefined {
  if (!canUseStorage()) {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeUserScope(userId?: string): string | null {
  const normalized = String(userId || '').trim();
  return normalized || null;
}

function buildScopedAdminConsoleKey(scope: string, userId?: string): string | null {
  const normalizedUserId = normalizeUserScope(userId);
  if (!normalizedUserId) {
    return null;
  }

  return `${ADMIN_CONSOLE_STATE_STORAGE_PREFIX}:${scope}:${normalizedUserId}`;
}

export function loadScopedAdminConsoleState<T>(scope: string, userId?: string): T | undefined {
  const storage = getStorage();
  const key = buildScopedAdminConsoleKey(scope, userId);
  if (!storage || !key) {
    return undefined;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as Partial<StoredAdminConsoleEnvelope<T>>;
    return parsed.value as T | undefined;
  } catch {
    storage.removeItem(key);
    return undefined;
  }
}

export function saveScopedAdminConsoleState<T>(
  scope: string,
  userId: string | undefined,
  value: T,
): void {
  const storage = getStorage();
  const key = buildScopedAdminConsoleKey(scope, userId);
  if (!storage || !key) {
    return;
  }

  try {
    const payload: StoredAdminConsoleEnvelope<T> = {
      version: 1,
      savedAt: new Date().toISOString(),
      value,
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Best-effort persistence only.
  }
}

export function clearScopedAdminConsoleState(scope: string, userId?: string): void {
  const storage = getStorage();
  const key = buildScopedAdminConsoleKey(scope, userId);
  if (!storage || !key) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function loadStoredAdminSystemTab(
  userId: string | undefined,
  fallback: AdminSystemTab = 'credit-models',
): AdminSystemTab {
  const storedValue = loadScopedAdminConsoleState<string>(ADMIN_SYSTEM_TAB_SCOPE, userId);
  return storedValue && VALID_ADMIN_SYSTEM_TABS.has(storedValue as AdminSystemTab)
    ? (storedValue as AdminSystemTab)
    : fallback;
}

export function saveStoredAdminSystemTab(
  userId: string | undefined,
  tab: AdminSystemTab,
): void {
  if (!VALID_ADMIN_SYSTEM_TABS.has(tab)) {
    return;
  }

  saveScopedAdminConsoleState(ADMIN_SYSTEM_TAB_SCOPE, userId, tab);
}
