import React from 'react';
import { Search } from 'lucide-react';
import type { CanonicalSettingsViewId } from '../settingsRegistry';

type IconLike = React.ComponentType<{ size?: number; className?: string }>;
type SettingsDesktopSidebarViewId = CanonicalSettingsViewId;

export interface SettingsDesktopSidebarItem {
  id: SettingsDesktopSidebarViewId;
  label: string;
  icon: IconLike;
}

interface SettingsDesktopSidebarProps {
  items: SettingsDesktopSidebarItem[];
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
  items,
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
  return (
    <aside
      className="flex h-full w-[232px] shrink-0 flex-col border-r px-4 py-5"
      style={{
        borderColor: 'var(--settings-sidebar-border)',
        background: 'var(--settings-sidebar-bg)',
      }}
    >
      <div className="mb-5 px-1">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          KK Studio
        </div>
        <h1
          className="mt-3 text-[24px] font-semibold tracking-[-0.04em]"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h1>
        <p
          className="mt-2 text-[13px] leading-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          {description}
        </p>
      </div>

      <label
        className="mb-4 flex items-center gap-3 rounded-[18px] border px-3.5 py-2.5"
        style={{
          borderColor: 'var(--settings-search-border)',
          background: 'var(--settings-search-bg)',
          color: 'var(--text-tertiary)',
        }}
      >
        <Search size={14} />
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
          style={{ color: 'var(--text-primary)' }}
        />
      </label>

      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div
            className="rounded-[18px] border px-4 py-3 text-[12px] leading-6"
            style={{
              borderColor: 'var(--settings-border-subtle)',
              background: 'var(--settings-surface-overlay)',
              color: 'var(--text-secondary)',
            }}
          >
            {emptyLabel}
          </div>
        ) : (
          items.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-colors duration-200"
                style={
                  isActive
                    ? {
                        color: 'var(--text-primary)',
                        borderColor: 'var(--settings-nav-active-border)',
                        background: 'var(--settings-nav-active-bg)',
                      }
                    : {
                        color: 'var(--text-secondary)',
                        borderColor: 'transparent',
                        background: 'transparent',
                      }
                }
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px]"
                  style={{
                    background: isActive ? 'rgb(var(--settings-accent-rgb) / 0.12)' : 'var(--settings-surface-overlay)',
                    color: isActive ? 'rgb(var(--settings-accent-rgb))' : 'var(--text-tertiary)',
                  }}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 truncate text-[14px] font-medium">{item.label}</span>
              </button>
            );
          })
        )}
      </nav>

      {accountBlock ? <div className="mt-5">{accountBlock}</div> : null}
    </aside>
  );
};

export default SettingsDesktopSidebar;
