import React, { Suspense, lazy } from 'react';
import { AppStartupScreen } from '../components/common/AppStartupScreen';
import NotificationToast from '../components/common/NotificationToast';
import { useAppStartup } from '../context/AppStartupContext';

const CostEstimation = lazy(() => import('../pages/CostEstimation'));

export interface AuthenticatedAppShellProps {
  showCostEstimation: boolean;
  onExitCostEstimation: () => void;
  AppContentComponent: React.ComponentType;
}

export const StartupRuntimeBanner: React.FC = () => {
  const {
    isHostedRuntime,
    legacyFallbackEnabled,
    lastStartupWarning,
  } = useAppStartup();

  const message = legacyFallbackEnabled && isHostedRuntime
    ? 'Hosted 运行时不应启用 legacy Web API fallback，请检查 VITE_KK_API_BASE_URL / VITE_ENABLE_LEGACY_WEB_API_FALLBACK。'
    : lastStartupWarning;

  if (!message) {
    return null;
  }

  return (
    <div
      className="fixed left-1/2 top-4 z-[120] -translate-x-1/2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
      style={{
        borderColor: 'rgba(245, 158, 11, 0.35)',
        background: 'rgba(120, 53, 15, 0.88)',
        color: '#fef3c7',
      }}
    >
      {message}
    </div>
  );
};

export const AuthenticatedAppShell: React.FC<AuthenticatedAppShellProps> = ({ showCostEstimation, onExitCostEstimation, AppContentComponent }) => {
  const {
    stage,
    isBackgroundReady,
    lastStartupWarning,
  } = useAppStartup();

  return (
    <>
      {showCostEstimation ? (
        <Suspense fallback={null}>
          <CostEstimation onBack={onExitCostEstimation} />
        </Suspense>
      ) : (
        <>
          <StartupRuntimeBanner />
          <NotificationToast />
          {/* <UpdateNotification /> moved to InfiniteCanvas */}
          <AppContentComponent />
        </>
      )}
      {!isBackgroundReady ? <AppStartupScreen stage={stage} warning={lastStartupWarning} /> : null}
    </>
  );
};
