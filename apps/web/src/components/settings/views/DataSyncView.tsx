import React from 'react';
import { HardDrive, HelpCircle } from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsHero,
  SettingsBadge,
} from '../SettingsScaffold';
import { StorageSettingsView } from './StorageSettingsView.localized';

export const DataSyncView: React.FC = () => {
  const { pick } = useLocale();

  return (
    <SettingsViewShell>
      <SettingsHero
        title={pick('数据与同步', 'Data & Sync')}
        eyebrow="Storage & Workspaces"
        description={pick(
          '管理您的本地 IndexedDB 容量、云端 Workspace 存储空间、以及手机端的多端同步机制。',
          'Manage local IndexedDB quota, cloud workspace databases, and mobile sync pipes.'
        )}
        icon={HardDrive}
        tone="indigo"
      />

      {/* 手机端云端优先提示，根据当前设备和平台指导用户 */}
      <SettingsSection title={pick('同步控制台 (Mobile Cloud-First)', 'Synchronization Control')}>
        <div className="p-4 rounded-xl border border-[var(--accent-coral)]/30 bg-[var(--accent-coral)]/5 text-[var(--text-primary)]">
          <div className="font-semibold text-xs flex items-center gap-1.5">
            <HelpCircle size={14} className="text-[var(--accent-coral)]" />
            {pick('多端同步策略：手机端以云端同步为主', 'Sync Strategy: Mobile Cloud-First')}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-2 leading-relaxed">
            {pick(
              '为了优化多端性能，手机端默认强制以云端 workspace 存储为主，本地 IndexedDB 缓存仅做临时加速，不占用庞大的手机物理空间。如果您在手机端使用，建议保持良好的网络连接。',
              'To preserve device memory, mobile clients only use local cache for fast loading; workspace assets are hosted on cloud repositories.'
            )}
          </p>
        </div>
      </SettingsSection>

      <div className="border border-[var(--border-light)] rounded-xl overflow-hidden bg-[var(--bg-overlay)] p-2">
        {/* 复用核心存储清除、本地文件夹授权等成熟逻辑 */}
        <StorageSettingsView />
      </div>
    </SettingsViewShell>
  );
};

export default DataSyncView;
