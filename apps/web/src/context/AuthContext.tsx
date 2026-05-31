import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { clearStoredAdminSession } from "../services/api/adminSession";
import {
  clearStoredKkApiAuthTokens,
  getStoredKkApiAccessToken,
  refreshPreferredKkApiAccessToken,
} from "../services/api/authAccessToken";
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

import { getUserMe } from "@nano-banana/api-client";

interface AuthContextType {
  session: RuntimeAuthSession | null;
  user: RuntimeAuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAsTempUser: () => Promise<void>;
  isTempUser: boolean;
  tempUserExpiry: number | null;
  sessionRecoveryWarning: string | null;
  adminLevel: number;
}

const DEFAULT_AUTH_CONTEXT = createKkaiRuntimeAuthSnapshot();
const SESSION_RECOVERY_TIMEOUT_MS = 8000;

const AuthContext = createContext<AuthContextType>({
  ...DEFAULT_AUTH_CONTEXT,
  adminLevel: 0,
});

function createSessionRecoveryAbortScope(): { signal?: AbortSignal; dispose: () => void } {
  if (typeof window === "undefined" || typeof AbortController === "undefined") {
    return { dispose: () => undefined };
  }

  // 简体中文注释：部分移动端浏览器会让弱网 fetch 长时间悬挂，登录恢复必须按时让出首屏。
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SESSION_RECOVERY_TIMEOUT_MS);
  return {
    signal: controller.signal,
    dispose: () => window.clearTimeout(timer),
  };
}

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

  const persistedState = readPersistedRuntimeAuthState();
  if (!persistedState.isTempUser && !getStoredKkApiAccessToken()) {
    return createDefaultRuntimeAuthState();
  }

  return persistedState;
}

function shouldRecoverSessionOnMount(runtimeState: RuntimeAuthState): boolean {
  return !runtimeState.user && !runtimeState.isTempUser && Boolean(getStoredKkApiAccessToken());
}

function createInitialAuthState() {
  const runtimeState = resolveInitialRuntimeState();
  return {
    runtimeState,
    sessionRecoveryLoading: shouldRecoverSessionOnMount(runtimeState),
  };
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
  const initialAuthStateRef = useRef<ReturnType<typeof createInitialAuthState> | null>(null);
  if (!initialAuthStateRef.current) {
    initialAuthStateRef.current = createInitialAuthState();
  }

  const [runtimeState, setRuntimeState] = useState<RuntimeAuthState>(() => initialAuthStateRef.current!.runtimeState);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [sessionRecoveryLoading, setSessionRecoveryLoading] = useState(() => initialAuthStateRef.current!.sessionRecoveryLoading);
  const [sessionRecoveryBlockedBySignOut, setSessionRecoveryBlockedBySignOut] = useState(false);
  const [sessionRecoveryWarning, setSessionRecoveryWarning] = useState<string | null>(null);
  const [adminLevel, setAdminLevel] = useState<number>(0);
  const hostedRuntime = useMemo(() => isHostedRuntime(), []);
  const runtimeUserId = runtimeState.user?.id || null;
  const sessionAccessToken = runtimeState.isTempUser ? undefined : getStoredKkApiAccessToken();
  const loading = authActionLoading || sessionRecoveryLoading;

  useEffect(() => {
    if (sessionAccessToken && !runtimeState.isTempUser) {
      getUserMe(sessionAccessToken)
        .then((res) => {
          if (res && typeof res.adminLevel === "number") {
            setAdminLevel(res.adminLevel);
          }
        })
        .catch(async (err) => {
          const refreshedToken = await refreshPreferredKkApiAccessToken().catch(() => undefined);
          if (refreshedToken && refreshedToken !== sessionAccessToken) {
            try {
              const res = await getUserMe(refreshedToken);
              if (res && typeof res.adminLevel === "number") {
                setAdminLevel(res.adminLevel);
                return;
              }
            } catch {
              // 简体中文注释：管理员等级只影响入口展示，续期后仍失败时回落为普通用户避免误放权。
            }
          }

          console.error("[AuthContext] Fetch adminLevel failed:", err);
          setAdminLevel(0);
        });
    } else {
      setAdminLevel(0);
    }
  }, [sessionAccessToken, runtimeState.isTempUser]);

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
      if (nextState.user || nextState.isTempUser) {
        setSessionRecoveryBlockedBySignOut(false);
      }
      setRuntimeState(nextState);
    });
  }, []);

  useEffect(() => {
    return subscribeAuthSessionInvalidationRequest(() => {
      tempUserService.clearCachedTempUser();
      const nextState = clearHostedSessionRuntime();
      clearStoredAdminSession();
      setSessionRecoveryBlockedBySignOut(true);
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

    if (sessionRecoveryBlockedBySignOut) {
      setSessionRecoveryWarning(null);
      setSessionRecoveryLoading(false);
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
      const abortScope = createSessionRecoveryAbortScope();
      const response = await fetchHostedSessionFromServer({ signal: abortScope.signal }).finally(abortScope.dispose);
      if (disposed) {
        return true;
      }

      if (response.success) {
        const nextState = applyHostedSessionToRuntime(response.data);
        setSessionRecoveryBlockedBySignOut(false);
        setSessionRecoveryWarning(null);
        setSessionRecoveryLoading(false);
        setRuntimeState(nextState);
        return true;
      }

      // 简体中文：如果托管环境的 Cookie Session 恢复失败，但本地存有 AccessToken
      // 我们不应当直接清空，而是返回 false，交给外层逻辑降级使用本地存储的 Token 进行登录恢复
      const storedToken = getStoredKkApiAccessToken();
      if (storedToken) {
        console.log("[AuthContext] Hosted session restore failed, trying local token fallback...");
        return false;
      }

      if (isSessionRecoveryAuthErrorCode(response.error?.code)) {
        clearHostedSession();
        return true;
      }

      setSessionRecoveryWarning(retryableWarning);
      setSessionRecoveryLoading(false);
      scheduleRetry();
      return true;
    };

    const restoreSessionFromStoredToken = async (accessToken: string) => {
      try {
        const abortScope = createSessionRecoveryAbortScope();
        const response = await kkWebApiClient.getProfile({ accessToken, signal: abortScope.signal }).finally(abortScope.dispose);
        if (disposed) {
          return;
        }

        if (response.success) {
          const nextState = updateRuntimeAuthStateFromProfile(response.data);
          setSessionRecoveryBlockedBySignOut(false);
          setSessionRecoveryWarning(null);
          setSessionRecoveryLoading(false);
          setRuntimeState(nextState);
          return;
        }

        if (isSessionRecoveryAuthErrorCode(response.error?.code)) {
          const refreshedToken = await refreshPreferredKkApiAccessToken().catch(() => undefined);
          if (refreshedToken && refreshedToken !== accessToken) {
            await restoreSessionFromStoredToken(refreshedToken);
            return;
          }

          clearHostedSession();
          return;
        }

        setSessionRecoveryWarning(retryableWarning);
        setSessionRecoveryLoading(false);
        scheduleRetry();
      } catch {
        if (disposed) {
          return;
        }

        setSessionRecoveryWarning(retryableWarning);
        setSessionRecoveryLoading(false);
        scheduleRetry();
      }
    };

    const recoverRuntimeSession = async () => {
      setSessionRecoveryLoading(true);
      let storedToken = getStoredKkApiAccessToken();

      if (hostedRuntime) {
        const restoredHostedSession = await tryRestoreHostedSession();
        if (restoredHostedSession || disposed) {
          return;
        }
        storedToken = getStoredKkApiAccessToken() || storedToken;
      }

      if (!storedToken) {
        clearHostedSession();
        return;
      }

      await restoreSessionFromStoredToken(storedToken);
    };

    void recoverRuntimeSession();

    return () => {
      disposed = true;
      clearRetryTimer();
    };
  }, [hostedRuntime, runtimeState.user, runtimeState.isTempUser, sessionAccessToken, sessionRecoveryBlockedBySignOut]);

  const value = useMemo<AuthContextType>(() => {
    return {
      session: createSession(runtimeState.user, sessionAccessToken),
      user: runtimeState.user,
      loading,
      signOut: async () => {
        tempUserService.clearCachedTempUser();
        setSessionRecoveryBlockedBySignOut(true);
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
          clearStoredKkApiAuthTokens();
          clearStoredAdminSession();
          setSessionRecoveryBlockedBySignOut(false);
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
      adminLevel,
    };
  }, [loading, runtimeState, sessionAccessToken, sessionRecoveryWarning, adminLevel]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
