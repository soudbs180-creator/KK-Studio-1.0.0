export const ADMIN_SESSION_CHANGE_EVENT = "kk-admin-session-changed";

const ADMIN_SESSION_STORAGE_KEY = "kk_admin_session";

interface StoredAdminSession {
  token: string;
  expiresAt?: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitAdminSessionChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_SESSION_CHANGE_EVENT));
}

function normalizeStoredAdminSession(value: unknown): StoredAdminSession | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Partial<StoredAdminSession>;
  const token = String(candidate.token || "").trim();
  if (!token) {
    return undefined;
  }

  const expiresAt = String(candidate.expiresAt || "").trim();
  return {
    token,
    expiresAt: expiresAt || undefined,
  };
}

function hasSessionExpired(expiresAt?: string): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= Date.now();
}

function readStoredAdminSession(): StoredAdminSession | undefined {
  if (!canUseStorage()) {
    return undefined;
  }

  const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = normalizeStoredAdminSession(JSON.parse(raw));
    if (!parsed || hasSessionExpired(parsed.expiresAt)) {
      window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      return undefined;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return undefined;
  }
}

export function getStoredAdminSessionToken(): string | undefined {
  return readStoredAdminSession()?.token;
}

export function getStoredAdminSessionExpiresAt(): string | undefined {
  return readStoredAdminSession()?.expiresAt;
}

export function setStoredAdminSession(token?: string, expiresAt?: string) {
  if (!canUseStorage()) {
    return;
  }

  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    clearStoredAdminSession();
    return;
  }

  const nextValue = JSON.stringify({
    token: normalizedToken,
    expiresAt: String(expiresAt || "").trim() || undefined,
  });
  const previousValue = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  if (previousValue === nextValue) {
    return;
  }

  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, nextValue);
  emitAdminSessionChange();
}

export function clearStoredAdminSession() {
  if (!canUseStorage()) {
    return;
  }

  if (!window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)) {
    return;
  }

  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  emitAdminSessionChange();
}
