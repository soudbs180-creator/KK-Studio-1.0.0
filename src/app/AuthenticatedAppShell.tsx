import React, { Suspense, lazy, useLayoutEffect, useState } from 'react';

import LoginScreen from '../components/auth/LoginScreen';
import AdminRechargeFloatingPanel from '../components/admin/AdminRechargeFloatingPanel';
import { AppStartupScreen } from '../components/common/AppStartupScreen';
import NotificationToast from '../components/common/NotificationToast';
import { useAuth } from '../context/AuthContext';
import { useAppStartup } from '../context/AppStartupContext';
import { shouldShowLoginForAuthGate } from './authGate';
import { pickByDocumentLanguage } from '../utils/localeText';

const CostEstimation = lazy(() => import('../pages/CostEstimation'));
const PROMPT_BAR_CONTAINER_ID = 'prompt-bar-container';
const PROMPT_BAR_TEXTAREA_SELECTOR = 'textarea.input-bar-textarea, textarea';

function resolvePromptBarAnchorRect(promptBar: HTMLElement): DOMRect {
  const textareaRects = Array.from(promptBar.querySelectorAll<HTMLElement>(PROMPT_BAR_TEXTAREA_SELECTOR))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

  if (textareaRects.length === 0) {
    return promptBar.getBoundingClientRect();
  }

  textareaRects.sort((left, right) => {
    if (right.width !== left.width) {
      return right.width - left.width;
    }

    return right.top - left.top;
  });

  return textareaRects[0];
}

export interface AuthenticatedAppShellProps {
  showCostEstimation: boolean;
  onExitCostEstimation: () => void;
  AppContentComponent: React.ComponentType;
  showStartupBanner?: boolean;
}

function getStartupStageMessage(stage: string, isWorkspaceReady: boolean, healthState: 'idle' | 'checking' | 'ready') {
  switch (stage) {
    case 'signed_out':
      return pickByDocumentLanguage('正在准备登录环境…', 'Preparing the sign-in environment...');
    case 'session_ready':
      return pickByDocumentLanguage('正在确认会话…', 'Confirming your session...');
    case 'profile_ready':
      return isWorkspaceReady || healthState !== 'checking'
        ? null
        : pickByDocumentLanguage('正在校验账号与 API 连通性…', 'Checking your account and API connectivity...');
    case 'workspace_ready':
      return pickByDocumentLanguage('工作区已可用，正在完成后台预热…', 'Workspace is ready. Finishing background warm-up...');
    case 'background_ready':
    default:
      return null;
  }
}

function getPromptBarAnchorX() {
  if (typeof document === 'undefined') {
    return null;
  }

  const promptBar = document.getElementById(PROMPT_BAR_CONTAINER_ID);
  if (!promptBar) {
    return null;
  }

  const anchorRect = resolvePromptBarAnchorRect(promptBar);

  if (anchorRect.width === 0) {
    return null;
  }

  return Math.round(anchorRect.left + (anchorRect.width / 2));
}

export const StartupRuntimeBanner: React.FC = () => {
  const [bannerLeft, setBannerLeft] = useState<number | null>(null);
  const {
    stage,
    healthState,
    isWorkspaceReady,
    isHostedRuntime,
    legacyFallbackEnabled,
    lastStartupWarning,
  } = useAppStartup();

  const stageMessage = getStartupStageMessage(stage, isWorkspaceReady, healthState);
  const hostedWarning = legacyFallbackEnabled && isHostedRuntime
    ? 'Hosted runtime should not use legacy Web API fallback. Check VITE_KK_API_BASE_URL and VITE_ENABLE_LEGACY_WEB_API_FALLBACK.'
    : null;
  const message = hostedWarning || lastStartupWarning || stageMessage;

  useLayoutEffect(() => {
    if (!message || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    let rafId: number | null = null;
    let pollTimer: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let observedPromptBar: HTMLElement | null = null;
    let observedAnchor: HTMLElement | null = null;

    const syncBannerLeft = () => {
      const nextLeft = getPromptBarAnchorX();
      setBannerLeft((prevLeft) => (prevLeft === nextLeft ? prevLeft : nextLeft));
    };

    const scheduleSync = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;

        const promptBar = document.getElementById(PROMPT_BAR_CONTAINER_ID);
        const anchor = promptBar?.querySelector<HTMLElement>(PROMPT_BAR_TEXTAREA_SELECTOR) ?? promptBar;

        if (promptBar !== observedPromptBar || anchor !== observedAnchor) {
          observedPromptBar = promptBar;
          observedAnchor = anchor;
          resizeObserver?.disconnect();

          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
              scheduleSync();
            });

            if (observedPromptBar) {
              resizeObserver.observe(observedPromptBar);
            }
            if (observedAnchor && observedAnchor !== observedPromptBar) {
              resizeObserver.observe(observedAnchor);
            }
          } else {
            resizeObserver = null;
          }
        }

        syncBannerLeft();
      });
    };

    mutationObserver = typeof MutationObserver !== 'undefined' && document.body
      ? new MutationObserver(() => {
        scheduleSync();
      })
      : null;

    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
    });

    scheduleSync();
    pollTimer = window.setInterval(() => {
      scheduleSync();
    }, 200);
    window.addEventListener('resize', scheduleSync);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', scheduleSync);
    };
  }, [message]);

  if (!message) {
    return null;
  }

  const isWarning = Boolean(hostedWarning) || Boolean(lastStartupWarning);

  return (
    <div
      data-testid="startup-runtime-banner"
      className="fixed top-4 z-[120] rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
      style={{
        left: bannerLeft === null ? '50%' : `${bannerLeft}px`,
        transform: 'translateX(-50%)',
        borderColor: isWarning ? 'rgba(245, 158, 11, 0.35)' : 'rgba(148, 163, 184, 0.28)',
        background: isWarning ? 'rgba(120, 53, 15, 0.88)' : 'rgba(31, 41, 55, 0.82)',
        color: isWarning ? '#fef3c7' : '#e5e7eb',
      }}
    >
      {message}
    </div>
  );
};

export const AuthenticatedAppShell: React.FC<AuthenticatedAppShellProps> = ({
  showCostEstimation,
  onExitCostEstimation,
  AppContentComponent,
  showStartupBanner = true,
}) => {
  const { session, user, isTempUser, loading, sessionRecoveryWarning } = useAuth();
  const {
    isBackgroundReady,
  } = useAppStartup();
  const showStartupRuntimeBanner = showStartupBanner && !isBackgroundReady;

  if (loading) {
    return <AppStartupScreen stage="session_ready" warning={sessionRecoveryWarning} />;
  }

  if (shouldShowLoginForAuthGate({ user, session, isTempUser })) {
    return <LoginScreen />;
  }

  return (
    <>
      {showCostEstimation ? (
        <Suspense fallback={null}>
          <CostEstimation onBack={onExitCostEstimation} />
        </Suspense>
      ) : (
        <>
          {showStartupRuntimeBanner ? <StartupRuntimeBanner /> : null}
          <NotificationToast />
          <AdminRechargeFloatingPanel />
          <AppContentComponent />
        </>
      )}
    </>
  );
};
