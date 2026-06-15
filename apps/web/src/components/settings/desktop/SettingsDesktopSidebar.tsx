import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Search } from 'lucide-react';

import type {
  CanonicalSettingsViewId,
  SettingsNavItem,
  SettingsNavSection,
} from '../settingsRegistry';

import { useBilling } from '../../../context/BillingContext';
import { useLocale } from '../../../context/LocaleContext';
import keyManager from '../../../services/auth/keyManager';
import { getStorageUsage, getAllImageIds } from '../../../services/storage/imageStorage';
import { getTodayLogs, subscribeToLogs, LogLevel } from '../../../services/system/systemLogService';
import { formatRemainingCredits } from '../../../services/billing/remainingBalance';

type SettingsDesktopSidebarViewId = CanonicalSettingsViewId;

interface SettingsDesktopSidebarProps {
  items: SettingsNavItem[];
  sections: SettingsNavSection[];
  activeView: SettingsDesktopSidebarViewId;
  navQuery: string;
  searchPlaceholder: string;
  onQueryChange: (value: string) => void;
  onNavigate: (view: SettingsDesktopSidebarViewId) => void;
  title: string;
  description: string;
  emptyLabel: string;
  accountBlock?: React.ReactNode;
}

const SettingsDesktopSidebar: React.FC<SettingsDesktopSidebarProps> = ({
  items: rawItems,
  sections,
  activeView,
  navQuery,
  searchPlaceholder,
  onQueryChange,
  onNavigate,
  title,
  description,
  emptyLabel,
  accountBlock,
}) => {
  const { pick } = useLocale();

  const items = useMemo(() => {
    return rawItems;
  }, [rawItems]);

  // 1. API 状态统计
  const [channelStats, setChannelStats] = useState(() => {
    const slots = keyManager.getSlots();
    const providers = keyManager.getProviders();
    const officialCount = slots.filter(s => !s.disabled && s.status === 'valid').length;
    const activeProviders = providers.filter(p => p.isActive && p.status === 'active').length;
    return { officialCount, activeProviders };
  });

  // 2. 计费余额统计
  const { balance } = useBilling();
  const remainingBalanceDisplay = formatRemainingCredits(balance, 'zh-CN');

  // 3. 日志统计
  const [logs, setLogs] = useState(() => getTodayLogs());
  const importantLogCount = useMemo(() => 
    logs.filter(log => log.level === LogLevel.CRITICAL || log.level === LogLevel.ERROR || log.level === LogLevel.WARNING).length
  , [logs]);

  // 4. 存储统计
  const [storageUsageMb, setStorageUsageMb] = useState(0);
  const [storedImages, setStoredImages] = useState(0);

  // 订阅 keyManager 变更
  useEffect(() => {
    const updateStats = () => {
      const slots = keyManager.getSlots();
      const providers = keyManager.getProviders();
      const officialCount = slots.filter(s => !s.disabled && s.status === 'valid').length;
      const activeProviders = providers.filter(p => p.isActive && p.status === 'active').length;
      setChannelStats({ officialCount, activeProviders });
    };
    updateStats();
    return keyManager.subscribe(updateStats);
  }, []);

  // 订阅日志变更
  useEffect(() => {
    setLogs(getTodayLogs());
    return subscribeToLogs((next) => setLogs(next));
  }, []);

  // 获取存储大小
  useEffect(() => {
    const refreshStorage = async () => {
      try {
        const [bytes, imageIds] = await Promise.all([
          getStorageUsage().catch(() => 0),
          getAllImageIds().catch(() => []),
        ]);
        setStorageUsageMb(bytes / (1024 * 1024));
        setStoredImages(imageIds.length);
      } catch {}
    };
    void refreshStorage();
    const timer = setInterval(refreshStorage, 5000);
    return () => clearInterval(timer);
  }, []);

  const filteredNavItems = useMemo(() => {
    return items;
  }, [items]);

  // Map route ids to sidebar accent tokens; CSS owns the visual treatment.
  const getSidebarItemAccent = (itemId: string) => {
    switch (itemId) {
      case 'dashboard':
        return 'overview';
      case 'consumption-records':
        return 'billing';
      case 'api-management':
        return 'api';
      case 'storage-settings':
        return 'storage';
      case 'system-logs':
        return 'logs';
      default:
        return 'default';
    }
  };

  // Render lightweight live status for each navigation card.
  const renderCardStatusInfo = (itemId: SettingsDesktopSidebarViewId) => {
    if (itemId === 'dashboard') {
      return (
        <div className="mt-2 text-[11px] leading-4 text-[var(--text-secondary)] font-medium truncate">
          {pick('工作区健康和总览面板就绪', 'Workspace health & overview panel ready')}
        </div>
      );
    }
    if (itemId === 'api-management') {
      return (
        <div className="mt-2 text-[11px] leading-4 text-[var(--text-secondary)] font-medium truncate">
          {channelStats.officialCount} 个官方直连 / {channelStats.activeProviders} 个中转就绪
        </div>
      );
    }
    if (itemId === 'consumption-records') {
      return (
        <div className="mt-2 text-[11px] leading-4 flex items-center justify-between">
          <span className="text-[var(--text-secondary)]">{pick('今日消耗', 'Today Cost')}</span>
          <span className="settings-sidebar-card__balance text-xs">{remainingBalanceDisplay}</span>
        </div>
      );
    }
    if (itemId === 'system-logs') {
      const isHealthy = importantLogCount === 0;
      return (
        <div className="mt-2 text-[11px] leading-4 flex items-center gap-1.5 font-medium truncate">
          <span className="settings-sidebar-card__status-dot h-2 w-2 rounded-full" data-state={isHealthy ? 'healthy' : 'warning'} />
          <span className="settings-sidebar-card__status-text truncate" data-state={isHealthy ? 'healthy' : 'warning'}>
            {isHealthy ? pick('系统运行正常', 'System healthy') : pick(`${importantLogCount} 项告警日志`, `${importantLogCount} warnings`)}
          </span>
        </div>
      );
    }
    if (itemId === 'storage-settings') {
      return (
        <div className="mt-2 text-[11px] leading-4 text-[var(--text-secondary)] font-medium truncate">
          {storedImages} 张图 · {storageUsageMb.toFixed(1)} MB / 1 GB
        </div>
      );
    }
    return null;
  };

  return (
    <aside
      className="settings-shell-nav flex h-full min-h-0 shrink-0 flex-col border-r pl-2 pr-2 py-5"
      style={{
        width: 'var(--settings-sidebar-width)',
        borderColor: 'var(--settings-nav-glass-border)',
        background: 'var(--settings-nav-glass-bg)',
      }}
    >
      <div className="settings-shell-nav__title px-3 pb-3">
        <h1 className="text-sm font-semibold text-[var(--settings-nav-text-primary)]">{title}</h1>
        <p className="mt-1 text-[11px] leading-5 text-[var(--settings-nav-text-secondary)]">{description}</p>
      </div>

      <label className="settings-shell-nav__search mx-2 mb-4">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={navQuery}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-sm outline-none"
        />
      </label>

      <nav className="sidebar-card-list min-h-0 flex-1 space-y-3.5 overflow-y-auto pl-2 pr-3">
        {filteredNavItems.length === 0 ? (
          <div
            className="settings-shell-empty rounded-[18px] border px-4 py-3 text-[12px] leading-6"
            style={{
              borderColor: 'var(--settings-border-subtle)',
              background: 'var(--settings-surface-overlay)',
              color: 'var(--text-secondary)',
            }}
          >
            {emptyLabel}
          </div>
        ) : (
          sections.map((section) => {
            const sectionItems = items.filter((item) => item.section === section.id);
            if (sectionItems.length === 0) {
              return null;
            }

            return (
              <section key={section.id} className="settings-shell-nav__group space-y-2">
                <div
                  className="settings-shell-nav__group-label px-1 text-[9px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: 'var(--settings-nav-text-tertiary)' }}
                >
                  {section.label}
                </div>

                <div className="settings-shell-nav__group-list space-y-2.5">
                  {sectionItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    const accent = getSidebarItemAccent(item.id);

                    return (
                      <div key={item.id} className="relative w-full">
                        {isActive && (
                          <span className="settings-sidebar-card__active-rail" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          onClick={() => onNavigate(item.id)}
                          title={item.description}
                          className="settings-sidebar-card w-full"
                          aria-current={isActive ? 'page' : undefined}
                          data-state={isActive ? 'active' : 'idle'}
                          data-accent={accent}
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="card-avatar-icon shrink-0">
                                <Icon size={14} />
                              </span>
                              <span className="truncate text-xs font-semibold text-[var(--settings-nav-text-primary)]">
                                {item.label}
                              </span>
                            </div>
                            {!isActive && (
                              <ChevronRight size={13} className="text-[var(--settings-nav-text-tertiary)] opacity-60 shrink-0" />
                            )}
                          </div>
                          {renderCardStatusInfo(item.id)}
                          {isActive && (
                            <span className="settings-sidebar-card__active-chevron">
                              <ChevronRight size={13} />
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </nav>

      {accountBlock ? <div className="mt-4">{accountBlock}</div> : null}
    </aside>
  );
};

export default SettingsDesktopSidebar;
