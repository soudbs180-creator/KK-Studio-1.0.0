import type { Session, User } from '@supabase/supabase-js';

import { getStoredKkApiAccessToken } from '../services/api/authAccessToken.ts';
import {
  createDefaultRuntimeAuthState,
  getLatestRuntimeAuthState,
} from '../services/auth/runtimeAuthState.ts';

export interface KkaiRuntimeAuthSnapshot {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAsTempUser: () => Promise<void>;
  isTempUser: boolean;
  tempUserExpiry: number | null;
}

function createRuntimeSession(user: User, accessToken?: string): Session | null {
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
  } as Session;
}

export function createKkaiRuntimeAuthSnapshot(): KkaiRuntimeAuthSnapshot {
  const runtimeState = getLatestRuntimeAuthState() || createDefaultRuntimeAuthState();
  const accessToken = runtimeState.isTempUser ? undefined : getStoredKkApiAccessToken();

  return {
    session: runtimeState.user ? createRuntimeSession(runtimeState.user, accessToken) : null,
    user: runtimeState.user,
    loading: false,
    signOut: async () => {},
    loginAsTempUser: async () => {},
    isTempUser: runtimeState.isTempUser,
    tempUserExpiry: runtimeState.tempUserExpiry,
  };
}

export function createAppRootMode(_input: { pathname: string }): 'workspace' {
  return 'workspace';
}
