import React, { Suspense, useCallback } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';

const SettingsPanel = lazyWithRetry(() => import('../components/settings/SettingsPanel'));
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
