import React from 'react';
import { RefreshCw, ScrollText, X } from 'lucide-react';

import { useLocale } from '../../../context/LocaleContext';
import { SettingsActionButton } from '../SettingsScaffold';
import {
  SETTINGS_VIEW_META,
  type CanonicalSettingsViewId as DesktopSettingsViewId,
} from '../settingsRegistry';

export { SETTINGS_VIEW_META as DESKTOP_SETTINGS_VIEW_META };

interface SettingsDesktopWorkbenchHeaderProps {
  meta: {
    eyebrow: string;
    title: string;
    description: string;
  };
  languageControl?: React.ReactNode;
  activeView: DesktopSettingsViewId;
  onRefreshCurrentView: () => void;
  onOpenLogs: () => void;
  onClose: () => void;
}

const SettingsDesktopWorkbenchHeader: React.FC<SettingsDesktopWorkbenchHeaderProps> = ({
  meta,
  languageControl,
  activeView,
  onRefreshCurrentView,
  onOpenLogs,
  onClose,
}) => {
  const { pick } = useLocale();

  return (
    <header
      className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5 xl:flex-nowrap"
      style={{
        borderColor: 'var(--settings-sidebar-border)',
        background: 'var(--settings-shell-header-bg)',
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="uppercase"
          style={{
            color: 'var(--text-tertiary)',
            fontSize: 'var(--type-caption)',
            fontWeight: 'var(--font-semibold)',
            letterSpacing: '0.22em',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {meta.eyebrow}
        </div>
        <h2
          className="mt-2"
          style={{
            color: 'var(--text-primary)',
            fontSize: 'var(--type-title-1)',
            fontWeight: 'var(--font-semibold)',
            letterSpacing: '-0.05em',
            lineHeight: 'var(--leading-tight)',
          }}
        >
          {meta.title}
        </h2>
        <p
          className="mt-2 max-w-3xl"
          style={{
            color: 'var(--text-secondary)',
            fontSize: 'var(--type-body-2)',
            lineHeight: 'var(--ui-line-height-relaxed)',
          }}
        >
          {meta.description}
        </p>
      </div>

      <div
        className="flex min-w-[260px] max-w-full shrink-0 flex-col gap-3 rounded-[20px] border p-3"
        style={{
          borderColor: 'var(--settings-border-subtle)',
          background: 'var(--settings-surface-overlay)',
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          {pick('视图工具', 'View tools')}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {languageControl}
        </div>
        <div className="flex flex-wrap gap-2">
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
      </div>
    </header>
  );
};

export default SettingsDesktopWorkbenchHeader;
