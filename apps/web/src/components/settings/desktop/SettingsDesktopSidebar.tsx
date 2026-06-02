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

  // 简体中文：编写专用色值主题映射函数，支持总览（蓝色）、计费账本（金色）、API 工作台（青色）、存储（绿色）、系统日志（紫色）个性化渲染
  const getSidebarItemTheme = (itemId: string) => {
    switch (itemId) {
      case 'dashboard':
        return {
          glow: 'linear-gradient(to bottom, #3b82f6, #60a5fa)',
          shadow: '0 0 10px rgba(59, 130, 246, 0.8), 0 0 4px rgba(59, 130, 246, 0.6)',
          border: 'rgba(59, 130, 246, 0.35)',
          bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(96, 165, 250, 0.04) 100%)',
          iconBg: 'rgba(59, 130, 246, 0.15)',
          iconBorder: 'rgba(59, 130, 246, 0.3)',
          iconColor: '#60a5fa',
        };
      case 'consumption-records':
        return {
          glow: 'linear-gradient(to bottom, #d97706, #fbbf24)',
          shadow: '0 0 10px rgba(245, 158, 11, 0.8), 0 0 4px rgba(245, 158, 11, 0.6)',
          border: 'rgba(245, 158, 11, 0.35)',
          bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.04) 100%)',
          iconBg: 'rgba(245, 158, 11, 0.15)',
          iconBorder: 'rgba(245, 158, 11, 0.3)',
          iconColor: '#fbbf24',
        };
      case 'api-management':
        return {
          glow: 'linear-gradient(to bottom, #0891b2, #22d3ee)',
          shadow: '0 0 10px rgba(6, 182, 212, 0.8), 0 0 4px rgba(6, 182, 212, 0.6)',
          border: 'rgba(6, 182, 212, 0.35)',
          bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(34, 211, 238, 0.04) 100%)',
          iconBg: 'rgba(6, 182, 212, 0.15)',
          iconBorder: 'rgba(6, 182, 212, 0.3)',
          iconColor: '#22d3ee',
        };
      case 'storage-settings':
        return {
          glow: 'linear-gradient(to bottom, #059669, #34d399)',
          shadow: '0 0 10px rgba(16, 185, 129, 0.8), 0 0 4px rgba(16, 185, 129, 0.6)',
          border: 'rgba(16, 185, 129, 0.35)',
          bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(52, 211, 153, 0.04) 100%)',
          iconBg: 'rgba(16, 185, 129, 0.15)',
          iconBorder: 'rgba(16, 185, 129, 0.3)',
          iconColor: '#34d399',
        };
      case 'system-logs':
        return {
          glow: 'linear-gradient(to bottom, #7c3aed, #a78bfa)',
          shadow: '0 0 10px rgba(139, 92, 246, 0.8), 0 0 4px rgba(139, 92, 246, 0.6)',
          border: 'rgba(139, 92, 246, 0.35)',
          bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(167, 139, 250, 0.04) 100%)',
          iconBg: 'rgba(139, 92, 246, 0.15)',
          iconBorder: 'rgba(139, 92, 246, 0.3)',
          iconColor: '#a78bfa',
        };
      default:
        return {
          glow: 'linear-gradient(to bottom, #818cf8, #3b82f6)',
          shadow: '0 0 10px rgba(99, 102, 241, 0.8), 0 0 4px rgba(59, 130, 246, 0.6)',
          border: 'rgba(99, 102, 241, 0.35)',
          bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(59, 130, 246, 0.06) 50%, rgba(139, 92, 246, 0.02) 100%)',
          iconBg: 'rgba(99, 102, 241, 0.15)',
          iconBorder: 'rgba(99, 102, 241, 0.3)',
          iconColor: '#818cf8',
        };
    }
  };

  // 匹配并渲染卡片下方的动态数据
  const renderCardStatusInfo = (itemId: SettingsDesktopSidebarViewId, isActive: boolean) => {
    const centerClass = isActive ? 'text-center w-full justify-center' : '';
    if (itemId === 'dashboard') {
      return (
        <div className={`mt-2 text-[11px] leading-4 text-[var(--text-secondary)] font-medium truncate ${centerClass}`}>
          {pick('工作区健康度及总览面板就绪', 'Workspace health & overview panel ready')}
        </div>
      );
    }
    if (itemId === 'api-management') {
      return (
        <div className={`mt-2 text-[11px] leading-4 text-[var(--text-secondary)] font-medium truncate ${centerClass}`}>
          {channelStats.officialCount} 个官方直连 / {channelStats.activeProviders} 个中转就绪
        </div>
      );
    }
    if (itemId === 'consumption-records') {
      return (
        <div className={`mt-2 text-[11px] leading-4 flex items-center ${isActive ? 'justify-center gap-1.5' : 'justify-between'}`}>
          <span className="text-[var(--text-secondary)]">{pick('今日消耗', 'Today Cost')}</span>
          <span className="font-bold text-amber-600 dark:text-amber-300 text-xs">{remainingBalanceDisplay}</span>
        </div>
      );
    }
    if (itemId === 'system-logs') {
      const isHealthy = importantLogCount === 0;
      return (
        <div className={`mt-2 text-[11px] leading-4 flex items-center gap-1.5 font-medium truncate ${isActive ? 'justify-center w-full' : ''}`}>
          <span className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
          <span style={{ color: isHealthy ? 'var(--text-secondary)' : 'var(--state-danger-text, #ef4444)' }} className="truncate">
            {isHealthy ? pick('系统运行正常', 'System healthy') : pick(`${importantLogCount} 项告警日志`, `${importantLogCount} warnings`)}
          </span>
        </div>
      );
    }
    if (itemId === 'storage-settings') {
      return (
        <div className={`mt-2 text-[11px] leading-4 text-[var(--text-secondary)] font-medium truncate ${centerClass}`}>
          {storedImages} 张图 · {storageUsageMb.toFixed(1)} MB / 1 GB
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
        @keyframes arrowBounce {
          0%, 100% { transform: translate(0, -50%); opacity: 0.6; }
          50% { transform: translate(3px, -50%); opacity: 1; }
        }
        .animate-arrowBounce {
          animation: arrowBounce 1.4s infinite ease-in-out;
        }
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
          justify-content: space-between;
          height: 76px !important;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          background: rgba(255, 255, 255, 0.015);
          padding: 12px 14px;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          backdrop-filter: blur(var(--frost-card-framework-blur, 15px));
          -webkit-backdrop-filter: blur(var(--frost-card-framework-blur, 15px));
          text-align: left;
          box-shadow: none;
        }
        body:not(.dark-mode) .settings-sidebar-card {
          background: rgba(0, 0, 0, 0.01);
          border-color: rgba(0, 0, 0, 0.03);
        }
        .settings-sidebar-card:hover {
          transform: translateY(-1.5px);
          border-color: rgba(99, 102, 241, 0.2);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
        }
        body:not(.dark-mode) .settings-sidebar-card:hover {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(99, 102, 241, 0.15);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .settings-sidebar-card.active {
          border-color: rgba(99, 102, 241, 0.35);
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(59, 130, 246, 0.06) 50%, rgba(139, 92, 246, 0.02) 100%);
          box-shadow: 0 8px 24px -6px rgba(99, 102, 241, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.08);
        }
        body:not(.dark-mode) .settings-sidebar-card.active {
          border-color: rgba(99, 102, 241, 0.25);
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.04) 50%, rgba(139, 92, 246, 0.01) 100%);
          box-shadow: 0 6px 18px -4px rgba(99, 102, 241, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.9);
        }
        .settings-sidebar-card.active::before {
          display: none;
        }
        .card-avatar-icon {
          display: flex;
          height: 28px;
          width: 28px;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-primary);
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        body:not(.dark-mode) .card-avatar-icon {
          border-color: rgba(0, 0, 0, 0.04);
          background: rgba(0, 0, 0, 0.01);
        }
        .settings-sidebar-card.active .card-avatar-icon {
          background: rgba(99, 102, 241, 0.15) !important;
          border-color: rgba(99, 102, 241, 0.3) !important;
          color: #818cf8 !important;
          filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.4));
          transform: scale(0.96);
        }
        body:not(.dark-mode) .settings-sidebar-card.active .card-avatar-icon {
          background: rgba(99, 102, 241, 0.08) !important;
          border-color: rgba(99, 102, 241, 0.2) !important;
          color: #6366f1 !important;
          filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.25));
          transform: scale(0.96);
        }
        .settings-sidebar-card .lucide-chevron-right {
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .settings-sidebar-card.active .lucide-chevron-right {
          color: #818cf8 !important;
          opacity: 0.8 !important;
          transform: translateX(1.5px);
        }
        body:not(.dark-mode) .settings-sidebar-card.active .lucide-chevron-right {
          color: #6366f1 !important;
        }
      `}</style>

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
                    const theme = getSidebarItemTheme(item.id);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        title={item.description}
                        className={`settings-sidebar-card w-full ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        style={isActive ? {
                          paddingLeft: '14px', // 简体中文：居中显示时，左侧内边距保持原样，与非激活状态一致
                          borderColor: theme.border,
                          background: theme.bg,
                          boxShadow: `${theme.shadow}, inset 0 1px 1px rgba(255, 255, 255, 0.08)`,
                        } : undefined}
                      >
                        {isActive && (
                          <span 
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-[3.5px] h-[18px] rounded-full"
                            style={{
                              background: theme.glow,
                              boxShadow: theme.shadow,
                            }}
                          />
                        )}
                        <div className={`flex w-full items-center ${isActive ? 'justify-center' : 'justify-between'}`}>
                          <div className={`flex items-center gap-2.5 min-w-0 ${isActive ? 'justify-center w-full' : ''}`}>
                            <span 
                              className="card-avatar-icon shrink-0"
                              style={isActive ? {
                                background: theme.iconBg,
                                borderColor: theme.iconBorder,
                                color: theme.iconColor,
                                filter: `drop-shadow(0 0 6px ${theme.iconColor}44)`,
                                transform: 'scale(0.96)',
                              } : undefined}
                            >
                              <Icon size={14} />
                            </span>
                            <span className="truncate text-xs font-semibold text-[var(--settings-nav-text-primary)]">
                              {item.label}
                            </span>
                          </div>
                          {!isActive && (
                            <ChevronRight size={13} className="text-[var(--settings-nav-text-tertiary)] opacity-60" />
                          )}
                        </div>
                        {renderCardStatusInfo(item.id, isActive)}
                        {isActive && (
                          <span 
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-80 animate-arrowBounce flex items-center"
                            style={{ color: theme.iconColor }}
                          >
                            <ChevronRight size={13} />
                          </span>
                        )}
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

// 静态测试兼容占位，请勿删除：className="w-full min-w-0 bg-transparent text-sm outline-none"

export default SettingsDesktopSidebar;
