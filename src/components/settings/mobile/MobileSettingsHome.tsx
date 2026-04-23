import React from 'react';
import { AlertTriangle, Coins, KeyRound, LayoutDashboard } from 'lucide-react';

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
    label: 'Overview',
    description: 'System status, route priority, and recent activity',
    icon: LayoutDashboard,
  },
  {
    id: 'api-management',
    label: 'API',
    description: 'Local routes, providers, diagnostics, and platform entry',
    icon: KeyRound,
  },
  {
    id: 'consumption-records',
    label: 'Billing',
    description: 'Recharge history, spend, and ledger activity',
    icon: Coins,
  },
  {
    id: 'system-logs',
    label: 'Errors',
    description: 'System errors, warnings, and troubleshooting signals',
    icon: AlertTriangle,
  },
];

const MobileSettingsHome: React.FC<MobileSettingsHomeProps> = ({
  activeSection,
  onSelectSection,
}) => {
  return (
    <section data-testid="mobile-settings-home" className="space-y-4">
      <div className="rounded-[24px] border border-[var(--settings-border-subtle)] bg-[var(--settings-surface-overlay)] px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Four Mobile Entries
        </div>
        <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">
          Overview / API / Billing / Errors
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          The home stays focused on the four highest-priority settings destinations for phone workflows.
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
              data-testid={`mobile-settings-entry-${entry.id}`}
              onClick={() => onSelectSection(entry.id)}
              className="rounded-[24px] border px-4 py-4 text-left transition"
              style={{
                borderColor: isActive ? 'var(--settings-nav-active-border)' : 'var(--settings-border-subtle)',
                background: isActive ? 'var(--settings-nav-active-bg)' : 'var(--settings-section-bg)',
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{
                    background: isActive
                      ? 'rgb(var(--settings-accent-rgb) / 0.12)'
                      : 'var(--settings-surface-overlay)',
                    color: isActive ? 'rgb(var(--settings-accent-rgb))' : 'var(--text-primary)',
                  }}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">
                    {entry.label}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">
                    {entry.description}
                  </span>
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
