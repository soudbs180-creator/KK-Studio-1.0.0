import type { ProfileDto } from "../../../packages/contracts/src/index.ts";
import type { RuntimeAuthUser } from "./runtimeAuthTypes.ts";

import { KKAI_LOCAL_USER_ID } from "../../app/kkaiLocalRuntime.ts";

export interface RuntimeAuthState {
  user: RuntimeAuthUser | null;
  isTempUser: boolean;
  tempUserExpiry: number | null;
}

export interface RuntimeUserMetadataPatch {
  email?: string;
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  authProvider?: string;
  providers?: string[];
  addProvider?: string;
}

const RUNTIME_USER_STATE_STORAGE_KEY = "kkai.runtime.user-state.v1";
const LEGACY_RUNTIME_AUTH_STORAGE_KEY = "kkai.runtime.auth.state.v1";
const RUNTIME_AUTH_CHANGE_EVENT = "kkai-runtime-auth-state-changed";
const DEFAULT_LOCAL_EMAIL = "local-user@kkai.local";
const DEFAULT_LOCAL_NAME = "本地工作区";
const DEFAULT_AVATAR_TOKEN = "preset-default-local";

let latestRuntimeAuthState: RuntimeAuthState | null = null;

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function canDispatchRuntimeEvent(): boolean {
  return canUseWindow() && typeof window.dispatchEvent === "function";
}

function canObserveRuntimeEvent(): boolean {
  return canUseWindow()
    && typeof window.addEventListener === "function"
    && typeof window.removeEventListener === "function";
}

function normalizeProviders(values: unknown[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean),
  ));
}

function buildUser(input?: RuntimeUserMetadataPatch & { id?: string }): RuntimeAuthUser {
  const providers = normalizeProviders([
    input?.authProvider || "local",
    ...(input?.providers || []),
    input?.addProvider,
  ]);
  const fullName = String(input?.fullName || input?.displayName || DEFAULT_LOCAL_NAME).trim() || DEFAULT_LOCAL_NAME;
  const email = String(input?.email || DEFAULT_LOCAL_EMAIL).trim() || DEFAULT_LOCAL_EMAIL;
  const avatarUrl = String(input?.avatarUrl || DEFAULT_AVATAR_TOKEN).trim() || DEFAULT_AVATAR_TOKEN;
  const userId = String(input?.id || KKAI_LOCAL_USER_ID).trim() || KKAI_LOCAL_USER_ID;

  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
    phone: "",
    created_at: "1970-01-01T00:00:00.000Z",
    updated_at: "1970-01-01T00:00:00.000Z",
    confirmed_at: "1970-01-01T00:00:00.000Z",
    last_sign_in_at: "1970-01-01T00:00:00.000Z",
    app_metadata: {
      provider: providers[0] || "local",
      providers,
    },
    user_metadata: {
      provider: providers[0] || "local",
      auth_provider: providers[0] || "local",
      providers,
      name: fullName,
      full_name: fullName,
      display_name: fullName,
      avatar_url: avatarUrl,
    },
  };
}

export function createDefaultRuntimeAuthState(): RuntimeAuthState {
  return {
    user: null,
    isTempUser: false,
    tempUserExpiry: null,
  };
}

export function createFixedLocalRuntimeAuthState(): RuntimeAuthState {
  return {
    user: buildUser({
      id: KKAI_LOCAL_USER_ID,
    }),
    isTempUser: false,
    tempUserExpiry: null,
  };
}

function sanitizePersistedState(raw: unknown): RuntimeAuthState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as {
    user?: { id?: unknown; email?: unknown; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> };
    isTempUser?: unknown;
    tempUserExpiry?: unknown;
  };
  const userRecord = record.user;
  if (!userRecord || typeof userRecord !== "object") {
    return null;
  }

  const appMetadata = userRecord.app_metadata || {};
  const userMetadata = userRecord.user_metadata || {};
  return {
    user: buildUser({
      id: String(userRecord.id || KKAI_LOCAL_USER_ID),
      email: String(userRecord.email || DEFAULT_LOCAL_EMAIL),
      fullName: String(userMetadata.full_name || userMetadata.display_name || DEFAULT_LOCAL_NAME),
      displayName: String(userMetadata.display_name || userMetadata.full_name || DEFAULT_LOCAL_NAME),
      avatarUrl: String(userMetadata.avatar_url || ""),
      authProvider: String(userMetadata.auth_provider || userMetadata.provider || appMetadata.provider || "local"),
      providers: [
        ...(Array.isArray(userMetadata.providers) ? userMetadata.providers : []),
        ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
      ].map((value) => String(value || "")),
    }),
    isTempUser: record.isTempUser === true,
    tempUserExpiry: Number.isFinite(Number(record.tempUserExpiry))
      ? Number(record.tempUserExpiry)
      : null,
  };
}

function readPersistedState(): RuntimeAuthState | null {
  if (!canUseWindow()) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(RUNTIME_USER_STATE_STORAGE_KEY)
      || window.localStorage.getItem(LEGACY_RUNTIME_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return sanitizePersistedState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writePersistedState(state: RuntimeAuthState): void {
  if (!canUseWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(RUNTIME_USER_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors and keep the in-memory snapshot.
  }
}

function emitRuntimeAuthState(state: RuntimeAuthState): void {
  latestRuntimeAuthState = state;

  if (!canDispatchRuntimeEvent()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<RuntimeAuthState>(RUNTIME_AUTH_CHANGE_EVENT, {
      detail: state,
    }),
  );
}

export function getLatestRuntimeAuthState(): RuntimeAuthState {
  if (latestRuntimeAuthState) {
    return latestRuntimeAuthState;
  }

  latestRuntimeAuthState = readPersistedRuntimeAuthState();
  return latestRuntimeAuthState;
}

export function readPersistedRuntimeAuthState(): RuntimeAuthState {
  return readPersistedState() || createDefaultRuntimeAuthState();
}

export function persistRuntimeAuthState(state: RuntimeAuthState): RuntimeAuthState {
  writePersistedState(state);
  emitRuntimeAuthState(state);
  return state;
}

export function clearPersistedRuntimeAuthState(): RuntimeAuthState {
  if (canUseWindow()) {
    try {
      window.localStorage.removeItem(RUNTIME_USER_STATE_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_RUNTIME_AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage errors and still emit the default state.
    }
  }

  const nextState = createDefaultRuntimeAuthState();
  emitRuntimeAuthState(nextState);
  return nextState;
}

export function updateRuntimeAuthStateFromProfile(profile: ProfileDto): RuntimeAuthState {
  const currentState = getLatestRuntimeAuthState();
  const currentMetadata = currentState.user?.user_metadata || {};
  const currentAppMetadata = currentState.user?.app_metadata || {};
  const providers = normalizeProviders([
    currentMetadata.auth_provider,
    currentMetadata.provider,
    ...(Array.isArray(currentMetadata.providers) ? currentMetadata.providers : []),
    currentAppMetadata.provider,
    ...(Array.isArray(currentAppMetadata.providers) ? currentAppMetadata.providers : []),
  ]);

  return persistRuntimeAuthState({
    ...currentState,
    isTempUser: false,
    tempUserExpiry: null,
    user: buildUser({
      id: profile.id,
      email: profile.email,
      fullName: profile.nickname || String(currentMetadata.full_name || currentMetadata.display_name || DEFAULT_LOCAL_NAME),
      displayName: profile.nickname || String(currentMetadata.display_name || currentMetadata.full_name || DEFAULT_LOCAL_NAME),
      avatarUrl: profile.avatarUrl || String(currentMetadata.avatar_url || ""),
      authProvider: providers[0] || "password",
      providers: providers.length > 0 ? providers : ["password"],
    }),
  });
}

export function updateRuntimeUserMetadata(patch: RuntimeUserMetadataPatch): RuntimeAuthState {
  const currentState = getLatestRuntimeAuthState();
  const currentMetadata = currentState.user?.user_metadata || {};
  const currentAppMetadata = currentState.user?.app_metadata || {};
  const providers = normalizeProviders([
    patch.authProvider,
    ...(patch.providers || []),
    patch.addProvider,
    currentMetadata.auth_provider,
    currentMetadata.provider,
    ...(Array.isArray(currentMetadata.providers) ? currentMetadata.providers : []),
    currentAppMetadata.provider,
    ...(Array.isArray(currentAppMetadata.providers) ? currentAppMetadata.providers : []),
  ]);

  return persistRuntimeAuthState({
    ...currentState,
    user: buildUser({
      id: currentState.user?.id || KKAI_LOCAL_USER_ID,
      email: patch.email || currentState.user?.email || DEFAULT_LOCAL_EMAIL,
      fullName: patch.fullName || patch.displayName || String(currentMetadata.full_name || currentMetadata.display_name || DEFAULT_LOCAL_NAME),
      displayName: patch.displayName || patch.fullName || String(currentMetadata.display_name || currentMetadata.full_name || DEFAULT_LOCAL_NAME),
      avatarUrl: patch.avatarUrl ?? String(currentMetadata.avatar_url || ""),
      authProvider: providers[0] || "local",
      providers,
    }),
  });
}

export function subscribeRuntimeAuthState(
  listener: (state: RuntimeAuthState) => void,
): () => void {
  if (!canObserveRuntimeEvent()) {
    return () => {};
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<RuntimeAuthState>).detail;
    if (!detail) {
      return;
    }

    listener(detail);
  };

  window.addEventListener(RUNTIME_AUTH_CHANGE_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(RUNTIME_AUTH_CHANGE_EVENT, handler as EventListener);
  };
}
