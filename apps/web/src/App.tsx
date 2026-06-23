import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AppearanceMotionProvider } from './context/AppearanceMotionContext';
import { KkUIProvider } from '@kk/ui/web';
import { AppStartupProvider } from './context/AppStartupContext';
import { BillingProvider } from './context/BillingContext';
import { CanvasProvider } from './context/CanvasContext';
import { AuthenticatedAppShell } from './app/AuthenticatedAppShell';
import AppRootContentSwitch from './app/AppRootContentSwitch';
import { createAppRootMode } from './context/kkaiRuntimeContext';


const AppKkUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  return (
    <KkUIProvider appearance={resolvedTheme}>
      {children}
    </KkUIProvider>
  );
};

const App: React.FC = () => {
  const [showCostEstimation, setShowCostEstimation] = useState(false);
  const rootMode = createAppRootMode({ pathname: window.location.pathname });
  const [, setPathnameVersion] = useState(0);

  useEffect(() => {
    const handleLocationChange = () => {
      setPathnameVersion((v) => v + 1);
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('kk-app-locationchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('kk-app-locationchange', handleLocationChange);
    };
  }, []);

  // Initialize update check on mount
  useEffect(() => {
    import('./services/system/updateCheck').then(({ initUpdateCheck }) => {
      initUpdateCheck();
    });
  }, []);

  return (
    <ThemeProvider>
      <AppearanceMotionProvider>
        <AppKkUIProvider>
          <AppStartupProvider>
            <BillingProvider>
              <CanvasProvider>
                <AuthenticatedAppShell
                  showCostEstimation={rootMode === 'workspace' ? showCostEstimation : false}
                  onExitCostEstimation={() => setShowCostEstimation(false)}
                  showStartupBanner={rootMode === 'workspace'}
                  AppContentComponent={AppRootContentSwitch}
                />
              </CanvasProvider>
            </BillingProvider>
          </AppStartupProvider>
        </AppKkUIProvider>
      </AppearanceMotionProvider>
    </ThemeProvider>
  );
};

export default App;
