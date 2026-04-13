import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { clearStoredAdminSession } from "../services/api/adminSession";
import { getStoredKkApiAccessToken, setStoredKkApiAccessToken } from "../services/api/authAccessToken";
import {
  emitAuthSessionChange,
  subscribeAuthSessionInvalidationRequest,
} from "../services/auth/authSessionEvents";
import { keyManager } from "../services/auth/keyManager";
import {
  clearPersistedRuntimeAuthState,
  createDefaultRuntimeAuthState,
  persistRuntimeAuthState,
  readPersistedRuntimeAuthState,
  subscribeRuntimeAuthState,
  type RuntimeAuthState,
} from "../services/auth/runtimeAuthState";
import type { RuntimeAuthSession, RuntimeAuthUser } from "../services/auth/runtimeAuthTypes.ts";
import { tempUserService } from "../services/auth/tempUserService";
import { setTaskPersistenceStorageUserId } from "../services/persistence/taskPersistence";
import { createKkaiRuntimeAuthSnapshot } from "./kkaiRuntimeContext";

interface AuthContextType {
  session: RuntimeAuthSession | null;
  user: RuntimeAuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAsTempUser: () => Promise<void>;
  isTempUser: boolean;
  tempUserExpiry: number | null;
}

const DEFAULT_AUTH_CONTEXT = createKkaiRuntimeAuthSnapshot();

const AuthContext = createContext<AuthContextType>(DEFAULT_AUTH_CONTEXT);

function createSession(user: RuntimeAuthUser | null, accessToken?: string): RuntimeAuthSession | null {
  const normalizedAccessToken = String(accessToken || "").trim();
  if (!user || !normalizedAccessToken) {
    return null;
  }

  return {
    access_token: normalizedAccessToken,
    refresh_token: "",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
}

function resolveInitialRuntimeState(): RuntimeAuthState {
  const cachedTempUser = tempUserService.getCachedTempUser();
  if (cachedTempUser) {
    return {
      user: cachedTempUser.user,
      isTempUser: true,
      tempUserExpiry: cachedTempUser.expiresAt,
    };
  }

  return readPersistedRuntimeAuthState();
}

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [runtimeState, setRuntimeState] = useState<RuntimeAuthState>(() => resolveInitialRuntimeState());
  const [loading, setLoading] = useState(false);
  const runtimeUserId = runtimeState.user?.id || null;
  const sessionAccessToken = runtimeState.isTempUser ? undefined : getStoredKkApiAccessToken();

  useLayoutEffect(() => {
    const keyManagerUserId = runtimeState.isTempUser ? null : runtimeUserId;
    setTaskPersistenceStorageUserId(runtimeUserId);
    void keyManager.setUserId(keyManagerUserId).catch((error) => {
      console.warn("[AuthContext] Failed to sync local KKAI runtime user scope:", error);
    });
  }, [runtimeState.isTempUser, runtimeUserId]);

  useEffect(() => {
    emitAuthSessionChange({
      hasSession: Boolean(sessionAccessToken) && !runtimeState.isTempUser,
      userId: runtimeState.isTempUser ? runtimeUserId : runtimeUserId,
      accessToken: runtimeState.isTempUser ? undefined : sessionAccessToken,
      refreshToken: undefined,
      isTempUser: runtimeState.isTempUser,
    });
  }, [runtimeState.isTempUser, runtimeUserId, sessionAccessToken]);

  useEffect(() => {
    return subscribeRuntimeAuthState((nextState) => {
      setRuntimeState(nextState);
    });
  }, []);

  useEffect(() => {
    return subscribeAuthSessionInvalidationRequest(() => {
      tempUserService.clearCachedTempUser();
      setStoredKkApiAccessToken(undefined);
      clearStoredAdminSession();
      setRuntimeState(clearPersistedRuntimeAuthState());
    });
  }, []);

  const value = useMemo<AuthContextType>(() => {
    return {
      session: createSession(runtimeState.user, sessionAccessToken),
      user: runtimeState.user,
      loading,
      signOut: async () => {
        tempUserService.clearCachedTempUser();
        setStoredKkApiAccessToken(undefined);
        clearStoredAdminSession();
        setRuntimeState(clearPersistedRuntimeAuthState());
      },
      loginAsTempUser: async () => {
        setLoading(true);

        try {
          setStoredKkApiAccessToken(undefined);
          clearStoredAdminSession();
          const tempSession = await tempUserService.getOrCreateTempUser();
          const nextState = persistRuntimeAuthState({
            user: tempSession.user,
            isTempUser: true,
            tempUserExpiry: tempSession.expiresAt,
          });
          setRuntimeState(nextState);
        } finally {
          setLoading(false);
        }
      },
      isTempUser: runtimeState.isTempUser,
      tempUserExpiry: runtimeState.tempUserExpiry,
    };
  }, [loading, runtimeState, sessionAccessToken]);

  useEffect(() => {
    if (runtimeState.user) {
      return;
    }

    const nextState = createDefaultRuntimeAuthState();
    setRuntimeState(nextState);
  }, [runtimeState.user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
