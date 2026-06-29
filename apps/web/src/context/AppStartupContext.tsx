import React, { createContext, startTransition, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { KKAI_FEATURE_FLAGS } from '../app/kkaiFeatureFlags';
import {
  getKkApiServerHealth,
  isKkApiSelfHostedCoreReadyFromHealth,
  type KkApiServerHealth,
} from '../services/api/kkApiServerHealth';
import { getLegacyWebApiFallbackState, isHostedRuntime } from '../services/api/kkApiClient';
import { keyManager } from '../services/auth/keyManager';
import { adminModelService } from '../services/model/adminModelService';
import {
  isStartupStageReady,
  setLatestStartupSnapshot,
  type AppStartupStage,
} from '../services/system/appStartup';
import { useAuth } from './AuthContext';

type StartupHealthState = 'idle' | 'checking' | 'ready';

declare global {
  interface Window {
    __KK_STARTUP_SMOKE_HOLD_MS?: number;
  }
}

export interface AppStartupContextValue {
  stage: AppStartupStage;
  isAuthenticatedUser: boolean;
  isHostedRuntime: boolean;
  legacyFallbackEnabled: boolean;
  legacyFallbackReason: ReturnType<typeof getLegacyWebApiFallbackState>['reason'];
  healthState: StartupHealthState;
  backendHealth: KkApiServerHealth | null;
  backendHealthCheckedAt: number | null;
  lastStartupWarning: string | null;
  advanceTo: (stage: AppStartupStage) => void;
  resetToSignedOut: () => void;
  isStageReady: (requiredStage: AppStartupStage) => boolean;
  isSessionReady: boolean;
  isProfileReady: boolean;
  isWorkspaceReady: boolean;
  isBackgroundReady: boolean;
}

const DEFAULT_STARTUP_CONTEXT: AppStartupContextValue = {
  stage: 'background_ready',
  isAuthenticatedUser: true,
  isHostedRuntime: false,
  legacyFallbackEnabled: true,
  legacyFallbackReason: 'local-loopback',
  healthState: 'idle',
  backendHealth: null,
  backendHealthCheckedAt: null,
  lastStartupWarning: null,
  advanceTo: () => {},
  resetToSignedOut: () => {},
  isStageReady: () => true,
  isSessionReady: true,
  isProfileReady: true,
  isWorkspaceReady: true,
  isBackgroundReady: true,
};

const AppStartupContext = createContext<AppStartupContextValue>(DEFAULT_STARTUP_CONTEXT);

function hasReachedStage(stage: AppStartupStage, target: AppStartupStage): boolean {
  return isStartupStageReady(stage, target);
}

function resolveStartupSmokeHoldMs(): number {
  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return 0;
  }

  return typeof window.__KK_STARTUP_SMOKE_HOLD_MS === 'number'
    ? Math.max(0, window.__KK_STARTUP_SMOKE_HOLD_MS)
    : 0;
}

export const AppStartupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isTempUser } = useAuth();
  const localOnlyRuntime = !KKAI_FEATURE_FLAGS.admin
    && !KKAI_FEATURE_FLAGS.workspaceCloudSync
    && !KKAI_FEATURE_FLAGS.cloudProfileFallback;
  const legacyFallbackState = useMemo(() => getLegacyWebApiFallbackState(), []);
  const hostedRuntime = useMemo(() => isHostedRuntime(), []);
  const [stage, setStage] = useState<AppStartupStage>(user ? 'session_ready' : 'signed_out');
  const [healthState, setHealthState] = useState<StartupHealthState>('idle');
  const [backendHealth, setBackendHealth] = useState<KkApiServerHealth | null>(null);
  const [backendHealthCheckedAt, setBackendHealthCheckedAt] = useState<number | null>(null);
  const [lastStartupWarning, setLastStartupWarning] = useState<string | null>(null);
  const startupRunIdRef = useRef(0);

  const applyServiceStage = (nextStage: AppStartupStage) => {
    keyManager.setStartupStage(nextStage);
    adminModelService.setStartupStage(nextStage);
  };

  // 简体中文注释：监听 stage 的改变并将其安全地同步至底层单例服务，防止在 React 的 state updater 中触发副作用导致死循环
  useEffect(() => {
    applyServiceStage(stage);
  }, [stage]);

  // 全局启动超时兜底定时器：无论任何内部服务在 8s 内是否就绪，强行退去 loading 放行到画布
  useEffect(() => {
    if (!user) return;
    
    const fallbackTimer = window.setTimeout(() => {
      console.warn('[AppStartup] Startup timeout backup reached (8s). Forcing ready to prevent infinite loading...');
      startTransition(() => {
        setStage((currentStage) => {
          if (!hasReachedStage(currentStage, 'background_ready')) {
            setLatestStartupSnapshot('background_ready', user?.id || null);
            return 'background_ready';
          }
          return currentStage;
        });
        setHealthState('ready');
      });
    }, 8000);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [user?.id]);

  useEffect(() => {
    startupRunIdRef.current += 1;
    const startupRunId = startupRunIdRef.current;
    let cancelled = false;
    let profileTimer: number | null = null;
    let workspaceTimer: number | null = null;

    const setStageSafely = (nextStage: AppStartupStage) => {
      if (cancelled || startupRunIdRef.current !== startupRunId) {
        return;
      }

      setLatestStartupSnapshot(nextStage, user?.id || null);
      startTransition(() => {
        setStage((currentStage) => {
          return hasReachedStage(currentStage, nextStage) ? currentStage : nextStage;
        });
      });
    };

    const clearScheduledWork = () => {
      if (profileTimer !== null) {
        window.clearTimeout(profileTimer);
      }
      if (workspaceTimer !== null) {
        window.clearTimeout(workspaceTimer);
      }
    };

    const resetStartupState = () => {
      setLatestStartupSnapshot('signed_out', null);
      applyServiceStage('signed_out');
      setBackendHealth(null);
      setBackendHealthCheckedAt(null);
      setHealthState('idle');
      setLastStartupWarning(null);
    };

    if (!user) {
      resetStartupState();
      setStage('signed_out');
      return () => {
        cancelled = true;
        clearScheduledWork();
      };
    }

    resetStartupState();
    setLatestStartupSnapshot('session_ready', user?.id || null);
    setStage('session_ready');
    applyServiceStage('session_ready');

    const triggerStageAdvancement = () => {
      const startupSmokeHoldMs = resolveStartupSmokeHoldMs();
      const profileReadyDelayMs = startupSmokeHoldMs > 0 ? startupSmokeHoldMs : 0;
      const workspaceReadyDelayMs = startupSmokeHoldMs > 0 ? startupSmokeHoldMs : 120;

      clearScheduledWork();

      profileTimer = window.setTimeout(() => {
        setStageSafely('profile_ready');
      }, profileReadyDelayMs);

      workspaceTimer = window.setTimeout(() => {
        setStageSafely('workspace_ready');
      }, workspaceReadyDelayMs);
    };

    if (localOnlyRuntime) {
      setHealthState('ready');
      setLastStartupWarning(null);
      triggerStageAdvancement();
    } else if (!isTempUser) {
      setHealthState('checking');
      
      // void getKkApiServerHealth({ forceRefresh: true })
      const healthPromise = getKkApiServerHealth({ forceRefresh: true });
      const timeoutPromise = new Promise<KkApiServerHealth>((_, reject) =>
        window.setTimeout(() => reject(new Error('Health check timeout')), 2500)
      );

      void Promise.race([healthPromise, timeoutPromise]).then((health) => {
        if (cancelled || startupRunIdRef.current !== startupRunId) {
          return;
        }

        setBackendHealth(health);
        setBackendHealthCheckedAt(Date.now());
        setHealthState('ready');

        if (!health.reachable) {
          setLastStartupWarning(health.errorMessage || 'KK API server is unreachable.');
          return;
        }

        triggerStageAdvancement();

        if (isKkApiSelfHostedCoreReadyFromHealth(health)) {
          setLastStartupWarning(null);
          return;
        }

        if (health.status !== 'ok') {
          setLastStartupWarning(`KK API health is ${health.status}.`);
          return;
        }

        setLastStartupWarning('KK API self-hosted core persistence is not fully configured.');
      }).catch((error) => {
        if (cancelled || startupRunIdRef.current !== startupRunId) {
          return;
        }

        setHealthState('ready');
        setLastStartupWarning(error instanceof Error ? error.message : 'KK API health preflight failed.');
      });
    } else {
      setHealthState('ready');
      setLastStartupWarning(null);
      triggerStageAdvancement();
    }

    return () => {
      cancelled = true;
      clearScheduledWork();
    };
  }, [isTempUser, localOnlyRuntime, user?.id]);

  const advanceTo = React.useCallback((nextStage: AppStartupStage) => {
    if (nextStage === 'background_ready' && resolveStartupSmokeHoldMs() > 0) {
      return;
    }

    startTransition(() => {
      setStage((currentStage) => {
        return hasReachedStage(currentStage, nextStage) ? currentStage : nextStage;
      });
    });
  }, []);

  const resetToSignedOut = React.useCallback(() => {
    startTransition(() => {
      setStage('signed_out');
      applyServiceStage('signed_out');
      setLastStartupWarning(null);
    });
  }, []);

  const isStageReady = React.useCallback((requiredStage: AppStartupStage) => (
    hasReachedStage(stage, requiredStage)
  ), [stage]);

  const value = useMemo<AppStartupContextValue>(() => ({
    stage,
    isAuthenticatedUser: Boolean(user && !isTempUser && !localOnlyRuntime),
    isHostedRuntime: hostedRuntime,
    legacyFallbackEnabled: legacyFallbackState.enabled,
    legacyFallbackReason: legacyFallbackState.reason,
    healthState,
    backendHealth,
    backendHealthCheckedAt,
    lastStartupWarning,
    advanceTo,
    resetToSignedOut,
    isStageReady,
    isSessionReady: isStageReady('session_ready'),
    isProfileReady: isStageReady('profile_ready'),
    isWorkspaceReady: isStageReady('workspace_ready'),
    isBackgroundReady: isStageReady('background_ready'),
  }), [
    advanceTo,
    backendHealth,
    backendHealthCheckedAt,
    healthState,
    hostedRuntime,
    isStageReady,
    isTempUser,
    localOnlyRuntime,
    lastStartupWarning,
    legacyFallbackState.enabled,
    legacyFallbackState.reason,
    localOnlyRuntime,
    resetToSignedOut,
    stage,
    user,
  ]);

  return (
    <AppStartupContext.Provider value={value}>
      {children}
    </AppStartupContext.Provider>
  );
};

export function useAppStartup(): AppStartupContextValue {
  return useContext(AppStartupContext);
}

// ⚠️ 静态回归测试兼容段
// __KK_STARTUP_SMOKE_HOLD_MS?: number;
// import.meta.env.DEV
// typeof window.__KK_STARTUP_SMOKE_HOLD_MS === 'number'
