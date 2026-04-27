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
      className="settings-shell-main__topbar border-b px-6 py-3.5"
      style={{
        borderColor: 'var(--settings-nav-glass-border)',
        background: 'var(--settings-shell-header-bg)',
      }}
    >
      <div className="flex w-full items-center justify-end gap-4">
        <div
          className="hidden items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)] xl:flex"
          aria-hidden="true"
        >
          <span>{pick('快捷操作', 'Quick actions')}</span>
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: activeView === 'system-logs' ? 'rgb(var(--settings-accent-rgb))' : 'var(--settings-border-subtle)' }}
          />
          <span>{pick('保持当前工作流', 'Stay in flow')}</span>
        </div>

        <div
          className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2 rounded-full border p-1"
          style={{
            borderColor: 'var(--settings-nav-glass-border)',
            background: 'color-mix(in srgb, var(--settings-nav-glass-bg) 68%, transparent)',
            boxShadow: '0 8px 24px rgb(15 23 42 / 0.06)',
          }}
        >
          <SettingsActionButton icon={RefreshCw} tone="secondary" size="sm" onClick={onRefreshCurrentView}>
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
          <SettingsActionButton icon={X} tone="secondary" size="sm" onClick={onClose}>
            {pick('关闭', 'Close')}
          </SettingsActionButton>
        </div>
      </div>
    </header>
  );
};

export default SettingsDesktopWorkbenchHeader;
