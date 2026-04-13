import React from 'react';
import { RefreshCw, ScrollText, X } from 'lucide-react';
import { SettingsActionButton } from '../SettingsScaffold';

export type DesktopSettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs';

export const DESKTOP_SETTINGS_VIEW_META: Record<
  DesktopSettingsViewId,
  { eyebrow: string; title: string; description: string }
> = {
  dashboard: {
    eyebrow: 'Overview',
    title: '桌面工作台',
    description: '统一查看关键状态、最近活动和需要继续处理的配置入口。',
  },
  'api-management': {
    eyebrow: 'API Routes',
    title: 'API 与模型路由',
    description: '集中管理官方接口、供应商、连通性和预算约束。',
  },
  'consumption-records': {
    eyebrow: 'Billing',
    title: '计费与账单',
    description: '查看充值、消费、汇率以及积分使用情况。',
  },
  'storage-settings': {
    eyebrow: 'Storage',
    title: '存储与缓存',
    description: '管理本地存储模式、缓存容量和资源整理策略。',
  },
  'system-logs': {
    eyebrow: 'Logs',
    title: '系统日志',
    description: '快速检索运行日志、异常来源和当前系统信号。',
  },
};

interface SettingsDesktopWorkbenchHeaderProps {
  meta: { eyebrow: string; title: string; description: string };
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
  return (
    <header
      className="flex items-start justify-between gap-5 border-b px-8 py-6"
      style={{
        borderColor: 'var(--settings-sidebar-border)',
        background: 'var(--settings-shell-header-bg)',
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {meta.eyebrow}
        </div>
        <h2
          className="mt-3 text-[28px] font-semibold tracking-[-0.05em]"
          style={{ color: 'var(--text-primary)' }}
        >
          {meta.title}
        </h2>
        <p
          className="mt-2 max-w-3xl text-[14px] leading-7"
          style={{ color: 'var(--text-secondary)' }}
        >
          {meta.description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {languageControl}
        <SettingsActionButton
          icon={RefreshCw}
          tone="secondary"
          size="sm"
          onClick={onRefreshCurrentView}
        >
          刷新
        </SettingsActionButton>
        <SettingsActionButton
          icon={ScrollText}
          tone={activeView === 'system-logs' ? 'primary' : 'secondary'}
          size="sm"
          onClick={onOpenLogs}
        >
          日志
        </SettingsActionButton>
        <SettingsActionButton
          icon={X}
          tone="secondary"
          size="sm"
          onClick={onClose}
        >
          关闭
        </SettingsActionButton>
      </div>
    </header>
  );
};

export default SettingsDesktopWorkbenchHeader;
