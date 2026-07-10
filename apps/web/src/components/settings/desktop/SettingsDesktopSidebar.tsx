import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { useLocale } from '../../../context/LocaleContext';
import keyManager from '../../../services/auth/keyManager';
import { getAllImageIds, getStorageUsage } from '../../../services/storage/imageStorage';
import { getTodayLogs, LogLevel, subscribeToLogs } from '../../../services/system/systemLogService';
import type {
  CanonicalSettingsViewId,
  SettingsModule,
  SettingsModuleId,
} from '../settingsRegistry';
import { SETTINGS_SHELL_ACTIONS } from '../settingsModuleActions';

interface SettingsDesktopSidebarProps {
  modules: SettingsModule[];
  activeModuleId: SettingsModuleId | null;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  title: string;
  description: string;
  accountBlock?: React.ReactNode;
}

const SettingsDesktopSidebar: React.FC<SettingsDesktopSidebarProps> = ({
  modules,
  activeModuleId,
  onNavigate,
  title,
  description,
  accountBlock,
}) => {
  const { pick } = useLocale();
  const [channelStats, setChannelStats] = useState(() => {
    const slots = keyManager.getSlots();
    const providers = keyManager.getProviders();
    return {
      officialCount: slots.filter((slot) => !slot.disabled && slot.status === 'valid').length,
      activeProviders: providers.filter((provider) => provider.isActive && provider.status === 'active').length,
    };
  });
  const [logs, setLogs] = useState(() => getTodayLogs());
  const [storageUsageMb, setStorageUsageMb] = useState(0);
  const [storedImages, setStoredImages] = useState(0);

  useEffect(() => {
    const updateStats = () => {
      const slots = keyManager.getSlots();
      const providers = keyManager.getProviders();
      setChannelStats({
        officialCount: slots.filter((slot) => !slot.disabled && slot.status === 'valid').length,
        activeProviders: providers.filter((provider) => provider.isActive && provider.status === 'active').length,
      });
    };
    updateStats();
    return keyManager.subscribe(updateStats);
  }, []);

  useEffect(() => {
    setLogs(getTodayLogs());
    return subscribeToLogs((next) => setLogs(next));
  }, []);

  useEffect(() => {
    const refreshStorage = async () => {
      const [bytes, imageIds] = await Promise.all([
        getStorageUsage().catch(() => 0),
        getAllImageIds().catch(() => []),
      ]);
      setStorageUsageMb(bytes / (1024 * 1024));
      setStoredImages(imageIds.length);
    };
    void refreshStorage();
    const timer = window.setInterval(() => void refreshStorage(), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const importantLogCount = useMemo(
    () => logs.filter((log) => (
      log.level === LogLevel.CRITICAL
      || log.level === LogLevel.ERROR
      || log.level === LogLevel.WARNING
    )).length,
    [logs],
  );
  const visibleModules = useMemo(
    () => modules.filter((module) => module.id !== activeModuleId),
    [activeModuleId, modules],
  );

  const renderModuleStatus = (moduleId: SettingsModuleId) => {
    if (moduleId === 'overview') {
      return pick('本地优先 · 快捷策略', 'Local first · quick controls');
    }
    if (moduleId === 'ai') {
      const routes = channelStats.officialCount + channelStats.activeProviders;
      return pick(`${routes} 条能力链路已配置`, `${routes} capability routes configured`);
    }
    if (importantLogCount > 0) {
      return pick(`${importantLogCount} 项运行告警`, `${importantLogCount} runtime warnings`);
    }
    return pick(
      `${storedImages} 张资源 · ${storageUsageMb.toFixed(1)} MB`,
      `${storedImages} assets · ${storageUsageMb.toFixed(1)} MB`,
    );
  };

  return (
    <aside
      className="settings-shell-nav flex h-full min-h-0 shrink-0 flex-col border-r px-3 py-5"
      style={{
        width: 'var(--settings-sidebar-width)',
        borderColor: 'var(--settings-nav-glass-border)',
        background: 'var(--settings-nav-glass-bg)',
      }}
    >
      <div className="settings-shell-nav__title px-2 pb-5">
        <h1 className="text-sm font-semibold text-[var(--settings-nav-text-primary)]">{title}</h1>
        <p className="mt-1 text-[11px] leading-5 text-[var(--settings-nav-text-secondary)]">{description}</p>
      </div>

      <nav className="sidebar-card-list min-h-0 flex-1" aria-label={pick('切换设置模块', 'Switch settings module')}>
        <div className="settings-shell-nav__group-label px-2 pb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--settings-nav-text-tertiary)]">
          {pick('切换模块', 'Switch module')}
        </div>
        <div className="settings-shell-nav__group-list space-y-2.5">
          {visibleModules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => onNavigate(module.target)}
                title={module.description}
                className="settings-sidebar-card w-full"
                data-state="idle"
                data-accent={module.id === 'ai' ? 'ai-management' : module.id === 'system' ? 'storage' : 'overview'}
                data-settings-module={module.id}
                data-ai-settings-target={module.target}
                data-settings-shell-action={SETTINGS_SHELL_ACTIONS.navigateModule.uiAction}
              >
                <span className="card-avatar-icon shrink-0"><Icon size={20} /></span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-xs font-semibold text-[var(--settings-nav-text-primary)]">{module.label}</span>
                  <span className="mt-1 block truncate text-[11px] leading-4 font-medium text-[var(--text-secondary)]">
                    {renderModuleStatus(module.id)}
                  </span>
                </span>
                <span className="settings-sidebar-card__active-chevron"><ChevronRight size={13} /></span>
              </button>
            );
          })}
        </div>
      </nav>

      {accountBlock ? <div className="mt-4">{accountBlock}</div> : null}
    </aside>
  );
};

export default SettingsDesktopSidebar;
