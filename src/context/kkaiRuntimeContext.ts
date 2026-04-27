import { KKAI_FEATURE_FLAGS } from '../app/kkaiFeatureFlags.ts';
import { getStoredKkApiAccessToken } from '../services/api/authAccessToken.ts';
import {
  createDefaultRuntimeAuthState,
  createFixedLocalRuntimeAuthState,
  getLatestRuntimeAuthState,
} from '../services/auth/runtimeAuthState.ts';
import type { RuntimeAuthSession, RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';

export interface KkaiRuntimeAuthSnapshot {
  session: RuntimeAuthSession | null;
  user: RuntimeAuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAsTempUser: () => Promise<void>;
  isTempUser: boolean;
  tempUserExpiry: number | null;
  sessionRecoveryWarning: string | null;
}

function createRuntimeSession(user: RuntimeAuthUser, accessToken?: string): RuntimeAuthSession | null {
  const normalizedAccessToken = String(accessToken || '').trim();
  if (!normalizedAccessToken) {
    return null;
  }

  return {
    access_token: normalizedAccessToken,
    refresh_token: '',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
}

function shouldUseFixedLocalRuntimeUser(): boolean {
  return !KKAI_FEATURE_FLAGS.admin
    && !KKAI_FEATURE_FLAGS.workspaceCloudSync
    && !KKAI_FEATURE_FLAGS.cloudProfileFallback;
}

export function createKkaiRuntimeAuthSnapshot(): KkaiRuntimeAuthSnapshot {
  const runtimeState = getLatestRuntimeAuthState() || createDefaultRuntimeAuthState();
  const effectiveRuntimeState = !runtimeState.user && !runtimeState.isTempUser && shouldUseFixedLocalRuntimeUser()
    ? createFixedLocalRuntimeAuthState()
    : runtimeState;
  const accessToken = effectiveRuntimeState.isTempUser ? undefined : getStoredKkApiAccessToken();

  return {
    session: effectiveRuntimeState.user ? createRuntimeSession(effectiveRuntimeState.user, accessToken) : null,
    user: effectiveRuntimeState.user,
    loading: false,
    signOut: async () => {},
    loginAsTempUser: async () => {},
    isTempUser: effectiveRuntimeState.isTempUser,
    tempUserExpiry: effectiveRuntimeState.tempUserExpiry,
    sessionRecoveryWarning: null,
  };
}

export type KkaiAppRootMode = 'workspace' | 'settings';

export function createAppRootMode(input: { pathname: string }): KkaiAppRootMode {
  const normalizedPathname = String(input.pathname || '').trim().toLowerCase();

  if (normalizedPathname === '/settings' || normalizedPathname.startsWith('/settings/')) {
    return 'settings';
  }

  return 'workspace';
}
