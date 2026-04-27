import React, { Suspense, lazy, useCallback } from 'react';

const SettingsPanel = lazy(() => import('../components/settings/SettingsPanel'));
import { shouldUseHistoryBackForSettingsClose } from './settingsPageClose';

const SettingsPageRoot: React.FC = () => {
  const handleClose = useCallback(() => {
    if (window.history.length > 1 && shouldUseHistoryBackForSettingsClose({
      currentOrigin: window.location.origin,
      currentPathname: window.location.pathname,
      referrer: document.referrer,
    })) {
      window.history.back();
      return;
    }

    window.location.assign('/');
  }, []);

  return (
    <Suspense fallback={null}>
      <SettingsPanel
        isOpen={true}
        onClose={handleClose}
        presentation="page"
        initialPathname={window.location.pathname}
      />
    </Suspense>
  );
};

export default SettingsPageRoot;
