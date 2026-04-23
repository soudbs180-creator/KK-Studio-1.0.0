import React from 'react';
import { RefreshCw, ScrollText, X } from 'lucide-react';

import { useLocale } from '../../../context/LocaleContext';
import { SettingsActionButton } from '../SettingsScaffold';
import { type CanonicalSettingsViewId as DesktopSettingsViewId } from '../settingsRegistry';

interface SettingsDesktopWorkbenchHeaderProps {
  activeView: DesktopSettingsViewId;
  onRefreshCurrentView: () => void;
  onOpenLogs: () => void;
  onClose: () => void;
}

const SettingsDesktopWorkbenchHeader: React.FC<SettingsDesktopWorkbenchHeaderProps> = ({
  activeView,
  onRefreshCurrentView,
  onOpenLogs,
  onClose,
}) => {
  const { pick } = useLocale();

  return (
    <header
      className="flex items-center justify-end gap-2 border-b px-6 py-4"
      style={{
        borderColor: 'var(--settings-nav-glass-border)',
        background: 'var(--settings-shell-header-bg)',
      }}
    >
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <SettingsActionButton
          icon={RefreshCw}
          tone="secondary"
          size="sm"
          onClick={onRefreshCurrentView}
        >
          {pick('刷新', 'Refresh')}
        </SettingsActionButton>
        <SettingsActionButton
          icon={ScrollText}
          tone={activeView === 'system-logs' ? 'primary' : 'secondary'}
          size="sm"
          onClick={onOpenLogs}
        >
          {pick('日志', 'Logs')}
        </SettingsActionButton>
        <SettingsActionButton
          icon={X}
          tone="secondary"
          size="sm"
          onClick={onClose}
        >
          {pick('关闭', 'Close')}
        </SettingsActionButton>
      </div>
    </header>
  );
};

export default SettingsDesktopWorkbenchHeader;
