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
    return rawItems.filter(item => item.id !== 'dashboard');
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

  // 过滤掉 dashboard 卡片导航，因为它已融入整个 Master-Detail 的小卡片常驻结构中，无需重复显示
  const filteredNavItems = useMemo(() => {
    return items.filter(item => item.id !== 'dashboard');
  }, [items]);

  // 匹配并渲染卡片下方的动态数据
  const renderCardStatusInfo = (itemId: SettingsDesktopSidebarViewId) => {
    if (itemId === 'api-management') {
      return (
        <div className="mt-2 text-[11px] leading-4 text-[var(--text-secondary)] font-medium">
          {channelStats.officialCount} 个官方直连 / {channelStats.activeProviders} 个中转就绪
        </div>
      );
    }
    if (itemId === 'consumption-records') {
      return (
        <div className="mt-2 text-[11px] leading-4 flex items-center justify-between">
          <span className="text-[var(--text-secondary)]">{pick('今日消耗', 'Today Cost')}</span>
          <span className="font-bold text-amber-300 text-xs">{remainingBalanceDisplay}</span>
        </div>
      );
    }
    if (itemId === 'system-logs') {
      const isHealthy = importantLogCount === 0;
      return (
        <div className="mt-2 text-[11px] leading-4 flex items-center gap-1.5 font-medium">
          <span className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
          <span style={{ color: isHealthy ? 'var(--text-secondary)' : '#f87171' }}>
            {isHealthy ? pick('系统运行正常', 'System healthy') : pick(`${importantLogCount} 项告警日志`, `${importantLogCount} warnings`)}
          </span>
        </div>
      );
    }
    if (itemId === 'storage-settings') {
      const progress = Math.min(100, (storageUsageMb / 1024) * 100);
      return (
        <div className="mt-2 space-y-1.5">
          <div className="text-[10px] leading-3 text-[var(--text-secondary)] flex justify-between font-medium">
            <span>{storedImages} 张图</span>
            <span>{storageUsageMb.toFixed(1)} MB / 1 GB</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500" 
              style={{
                width: `${progress}%`,
                background: progress >= 85 ? '#ef4444' : progress >= 60 ? '#f59e0b' : '#3b82f6'
              }}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <aside
      className="settings-shell-nav flex h-full min-h-0 shrink-0 flex-col border-r px-4 py-5"
      style={{
        width: 'var(--settings-sidebar-width)',
        borderColor: 'var(--settings-nav-glass-border)',
        background: 'var(--settings-nav-glass-bg)',
      }}
    >
      <style>{`
        .sidebar-card-list::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-card-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 9px;
        }
        .settings-sidebar-card {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 18px;
          border: 1px solid var(--frost-card-framework-border, rgba(255, 255, 255, 0.08));
          background: var(--frost-card-framework-bg, rgba(22, 28, 45, 0.65));
          padding: 12px 14px;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          backdrop-filter: blur(var(--frost-card-framework-blur, 15px));
          -webkit-backdrop-filter: blur(var(--frost-card-framework-blur, 15px));
          text-align: left;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        .settings-sidebar-card:hover {
          transform: translateY(-1px);
          border-color: var(--frost-card-sub-border, rgba(255, 255, 255, 0.14));
          background: var(--frost-card-sub-bg, rgba(27, 34, 54, 0.74));
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        }
        .settings-sidebar-card.active {
          border-color: var(--accent-color, #3b82f6) !important;
          background: var(--frost-card-sub-bg, rgba(27, 34, 54, 0.85)) !important;
          box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15) !important;
        }
        .settings-sidebar-card.active::before {
          content: "";
          position: absolute;
          left: 0;
          top: 25%;
          height: 50%;
          width: 3px;
          background: var(--accent-color, #3b82f6);
          border-radius: 0 4px 4px 0;
        }
        .card-avatar-icon {
          display: flex;
          height: 28px;
          width: 28px;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid var(--frost-card-framework-border, rgba(255, 255, 255, 0.08));
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
        }
        .settings-sidebar-card.active .card-avatar-icon {
          background: rgba(59, 130, 246, 0.15);
          color: var(--accent-color, #3b82f6);
          border-color: rgba(59, 130, 246, 0.25);
        }
      `}</style>

      <div className="settings-shell-nav__title mb-4 px-1">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: 'var(--settings-nav-text-tertiary)' }}
        >
          KK Studio
        </div>
        <h1
          className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-[var(--settings-nav-text-primary)]"
        >
          {title}
        </h1>
        <p
          className="mt-1 text-[11px] leading-5 text-[var(--settings-nav-text-secondary)]"
        >
          {description}
        </p>
      </div>

      <label
        className="settings-shell-nav__search mb-4 flex items-center gap-2.5 px-3 py-2 rounded-xl border"
        style={{
          borderColor: 'var(--frost-card-framework-border, rgba(255, 255, 255, 0.08))',
          background: 'rgba(0, 0, 0, 0.15)',
          color: 'var(--settings-nav-text-tertiary)'
        }}
      >
        <Search size={13} />
        <input
          type="search"
          name="settings-navigation-search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="search"
          enterKeyHint="search"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          value={navQuery}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-sm outline-none"
          style={{ color: 'var(--settings-nav-text-primary)' }}
        />
      </label>

      <nav className="sidebar-card-list min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1">
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

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        title={item.description}
                        className={`settings-sidebar-card w-full ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
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
                          <ChevronRight size={13} className="text-[var(--settings-nav-text-tertiary)] opacity-60" />
                        </div>
                        {renderCardStatusInfo(item.id)}
                      </button>
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
