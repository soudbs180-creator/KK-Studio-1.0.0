import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { KKAI_FEATURE_FLAGS } from "../app/kkaiFeatureFlags.ts";
import { clearStoredAdminSession } from "../services/api/adminSession";
import { getStoredKkApiAccessToken, setStoredKkApiAccessToken } from "../services/api/authAccessToken";
import { isHostedRuntime, kkWebApiClient, shouldUseLegacyWebApiFallback } from "../services/api/kkApiClient";
import {
  emitAuthSessionChange,
  subscribeAuthSessionInvalidationRequest,
} from "../services/auth/authSessionEvents";
import { keyManager } from "../services/auth/keyManager";
import {
  applyHostedSessionToRuntime,
  clearHostedSessionRuntime,
  fetchHostedSessionFromServer,
  logoutHostedSessionFromServer,
} from "../services/auth/kkApiSessionBootstrap.ts";
import {
  clearPersistedRuntimeAuthState,
  createDefaultRuntimeAuthState,
  createFixedLocalRuntimeAuthState,
  persistRuntimeAuthState,
  readPersistedRuntimeAuthState,
  subscribeRuntimeAuthState,
  updateRuntimeAuthStateFromProfile,
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
  sessionRecoveryWarning: string | null;
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
  const localOnlyRuntime = !KKAI_FEATURE_FLAGS.admin
    && !KKAI_FEATURE_FLAGS.workspaceCloudSync
    && !KKAI_FEATURE_FLAGS.cloudProfileFallback;
  const cachedTempUser = tempUserService.getCachedTempUser();
  if (cachedTempUser) {
    return {
      user: cachedTempUser.user,
      isTempUser: true,
      tempUserExpiry: cachedTempUser.expiresAt,
    };
  }

  const persistedState = readPersistedRuntimeAuthState();
  if (!persistedState.isTempUser && !getStoredKkApiAccessToken()) {
    return localOnlyRuntime ? createFixedLocalRuntimeAuthState() : createDefaultRuntimeAuthState();
  }

  return persistedState;
}

export const useAuth = () => useContext(AuthContext);

function isSessionRecoveryAuthErrorCode(code: unknown): boolean {
  const normalizedCode = String(code || "").trim().toUpperCase();
  return normalizedCode === "AUTH_REQUIRED"
    || normalizedCode === "HTTP_401"
    || normalizedCode === "HTTP_403"
    || normalizedCode === "SESSION_REAUTH_REQUIRED";
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [runtimeState, setRuntimeState] = useState<RuntimeAuthState>(() => resolveInitialRuntimeState());
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [sessionRecoveryLoading, setSessionRecoveryLoading] = useState(false);
  const [sessionRecoveryWarning, setSessionRecoveryWarning] = useState<string | null>(null);
  const hostedRuntime = useMemo(() => isHostedRuntime(), []);
  const runtimeUserId = runtimeState.user?.id || null;
  const sessionAccessToken = runtimeState.isTempUser ? undefined : getStoredKkApiAccessToken();
  const loading = authActionLoading || sessionRecoveryLoading;

  useLayoutEffect(() => {
    const allowSessionlessLocalUserApiStorage =
      runtimeState.isTempUser
      && shouldUseLegacyWebApiFallback()
      && Boolean(runtimeUserId);
    const keyManagerUserId = allowSessionlessLocalUserApiStorage
      ? runtimeUserId
      : runtimeState.isTempUser
        ? null
        : runtimeUserId;
    setTaskPersistenceStorageUserId(runtimeUserId);
    void keyManager.setUserId(keyManagerUserId, {
      sessionlessLocalUserApiStorageEnabled: allowSessionlessLocalUserApiStorage,
    }).catch((error) => {
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
      const nextState = clearHostedSessionRuntime();
      clearStoredAdminSession();
      setSessionRecoveryWarning(null);
      setSessionRecoveryLoading(false);
      setRuntimeState(nextState);
    });
  }, []);

  useEffect(() => {
    if (runtimeState.user || runtimeState.isTempUser) {
      setSessionRecoveryLoading(false);
      setSessionRecoveryWarning(null);
      return;
    }

    let disposed = false;
    let retryTimer: number | null = null;
    const retryableWarning = "Checking your sign-in status. Please try again in a moment.";

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleRetry = () => {
      clearRetryTimer();
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void recoverRuntimeSession();
      }, 3000);
    };

    const clearHostedSession = () => {
      tempUserService.clearCachedTempUser();
      const nextState = clearHostedSessionRuntime();
      clearStoredAdminSession();
      setSessionRecoveryWarning(null);
      setSessionRecoveryLoading(false);
      setRuntimeState(nextState);
    };

    const tryRestoreHostedSession = async (): Promise<boolean> => {
      const response = await fetchHostedSessionFromServer();
      if (disposed) {
        return true;
      }

      if (response.success) {
        const nextState = applyHostedSessionToRuntime(response.data);
        setSessionRecoveryWarning(null);
        setSessionRecoveryLoading(false);
        setRuntimeState(nextState);
        return true;
      }

      if (isSessionRecoveryAuthErrorCode(response.error?.code)) {
        clearHostedSession();
        return true;
      }

      return false;
    };

    const restoreSessionFromStoredToken = async (accessToken: string) => {
      try {
        const response = await kkWebApiClient.getProfile({ accessToken });
        if (disposed) {
          return;
        }

        if (response.success) {
          const nextState = updateRuntimeAuthStateFromProfile(response.data);
          setSessionRecoveryWarning(null);
          setSessionRecoveryLoading(false);
          setRuntimeState(nextState);
          return;
        }

        if (isSessionRecoveryAuthErrorCode(response.error?.code)) {
          clearHostedSession();
          return;
        }

        setSessionRecoveryWarning(retryableWarning);
        scheduleRetry();
      } catch {
        if (disposed) {
          return;
        }

        setSessionRecoveryWarning(retryableWarning);
        scheduleRetry();
      }
    };

    const recoverRuntimeSession = async () => {
      setSessionRecoveryLoading(true);
      const storedToken = getStoredKkApiAccessToken();
      if (!hostedRuntime && !storedToken) {
        clearHostedSession();
        return;
      }

      if (hostedRuntime || !storedToken) {
        const restoredHostedSession = await tryRestoreHostedSession();
        if (restoredHostedSession || disposed) {
          return;
        }
      }

      if (!storedToken) {
        setSessionRecoveryWarning(retryableWarning);
        scheduleRetry();
        return;
      }

      await restoreSessionFromStoredToken(storedToken);
    };

    void recoverRuntimeSession();

    return () => {
      disposed = true;
      clearRetryTimer();
    };
  }, [hostedRuntime, runtimeState.user, runtimeState.isTempUser, sessionAccessToken]);

  const value = useMemo<AuthContextType>(() => {
    return {
      session: createSession(runtimeState.user, sessionAccessToken),
      user: runtimeState.user,
      loading,
      signOut: async () => {
        tempUserService.clearCachedTempUser();
        await logoutHostedSessionFromServer().catch(() => {
          clearHostedSessionRuntime();
        });
        clearStoredAdminSession();
        setSessionRecoveryWarning(null);
        setSessionRecoveryLoading(false);
        setRuntimeState(clearPersistedRuntimeAuthState());
      },
      loginAsTempUser: async () => {
        setAuthActionLoading(true);

        try {
          setStoredKkApiAccessToken(undefined);
          clearStoredAdminSession();
          setSessionRecoveryWarning(null);
          const tempSession = await tempUserService.getOrCreateTempUser();
          const nextState = persistRuntimeAuthState({
            user: tempSession.user,
            isTempUser: true,
            tempUserExpiry: tempSession.expiresAt,
          });
          setRuntimeState(nextState);
        } finally {
          setAuthActionLoading(false);
        }
      },
      isTempUser: runtimeState.isTempUser,
      tempUserExpiry: runtimeState.tempUserExpiry,
      sessionRecoveryWarning,
    };
  }, [loading, runtimeState, sessionAccessToken, sessionRecoveryWarning]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
