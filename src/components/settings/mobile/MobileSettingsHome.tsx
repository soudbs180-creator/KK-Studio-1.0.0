import React from 'react';
import { Coins, KeyRound, LayoutDashboard, ScrollText } from 'lucide-react';

import type { MobileSettingsSection } from '../../../types';

interface MobileSettingsHomeProps {
  activeSection: MobileSettingsSection;
  onSelectSection: (section: MobileSettingsSection) => void;
}

const ENTRIES: Array<{
  id: MobileSettingsSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: '总览、核心指标与最近异常',
    icon: LayoutDashboard,
  },
  {
    id: 'api-management',
    label: 'API',
    description: '官方接口与第三方供应商设置',
    icon: KeyRound,
  },
  {
    id: 'consumption-records',
    label: 'Usage',
    description: '使用日志与消耗记录',
    icon: Coins,
  },
  {
    id: 'system-logs',
    label: 'Errors',
    description: '系统错误日志与故障排查',
    icon: ScrollText,
  },
];

const MobileSettingsHome: React.FC<MobileSettingsHomeProps> = ({
  activeSection,
  onSelectSection,
}) => {
  return (
    <section data-testid="mobile-settings-home" className="space-y-4">
      <div className="rounded-[24px] border border-[var(--border-light)] bg-[var(--bg-secondary)]/90 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Four Mobile Entries
        </div>
        <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">
          Dashboard / API / Usage / Errors
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Only the focused mobile entries are kept here for the phone-first settings experience.
        </div>
      </div>

      <div className="grid gap-3">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          const isActive = activeSection === entry.id;

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectSection(entry.id)}
              className={`rounded-[24px] border px-4 py-4 text-left transition ${
                isActive ? 'border-blue-400/50 bg-blue-500/10' : 'border-[var(--border-light)] bg-[var(--bg-secondary)]/90'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{entry.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">{entry.description}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default MobileSettingsHome;
