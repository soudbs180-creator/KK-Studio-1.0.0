import React from 'react';
import { Search } from 'lucide-react';

import type {
  CanonicalSettingsViewId,
  SettingsNavItem,
  SettingsNavSection,
} from '../settingsRegistry';

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
  items,
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
  return (
    <aside
      className="flex h-full min-h-0 shrink-0 flex-col border-r px-4 py-5"
      style={{
        width: 'var(--settings-sidebar-width)',
        borderColor: 'var(--settings-nav-glass-border)',
        background: 'var(--settings-nav-glass-bg)',
      }}
    >
      <div className="mb-5 px-1">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: 'var(--settings-nav-text-tertiary)' }}
        >
          KK Studio
        </div>
        <h1
          className="mt-3 text-[24px] font-semibold tracking-[-0.04em]"
          style={{ color: 'var(--settings-nav-text-primary)' }}
        >
          {title}
        </h1>
        <p
          className="mt-2 text-[13px] leading-6"
          style={{ color: 'var(--settings-nav-text-secondary)' }}
        >
          {description}
        </p>
      </div>

      <label
        className="mb-4 flex items-center gap-3 rounded-[18px] border px-3.5 py-2.5"
          style={{
            borderColor: 'var(--settings-search-border)',
            background: 'var(--settings-search-bg)',
            color: 'var(--settings-nav-text-tertiary)',
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
          style={{ color: 'var(--settings-nav-text-primary)' }}
        />
      </label>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
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
          sections.map((section) => {
            const sectionItems = items.filter((item) => item.section === section.id);
            if (sectionItems.length === 0) {
              return null;
            }

            return (
              <section key={section.id} className="space-y-2">
                <div
                  className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: 'var(--settings-nav-text-tertiary)' }}
                >
                  {section.label}
                </div>

                <div className="space-y-2">
                  {sectionItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        className="flex w-full items-start gap-3 rounded-[20px] border px-3.5 py-3 text-left transition-colors duration-200"
                        style={
                          isActive
                            ? {
                                color: 'var(--settings-nav-text-primary)',
                                borderColor: 'var(--settings-nav-active-border)',
                                background: 'var(--settings-nav-active-bg)',
                              }
                            : {
                                color: 'var(--settings-nav-text-secondary)',
                                borderColor: 'transparent',
                                background: 'transparent',
                              }
                        }
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px]"
                          style={{
                            background: isActive
                              ? 'rgb(var(--settings-accent-rgb) / 0.12)'
                              : 'var(--settings-surface-overlay)',
                            color: isActive
                              ? 'rgb(var(--settings-accent-rgb))'
                              : 'var(--settings-nav-text-tertiary)',
                          }}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block min-w-0 truncate text-[14px] font-medium">
                            {item.label}
                          </span>
                          <span
                            className="mt-1 block text-[12px] leading-5"
                            style={{
                              color: isActive
                                ? 'var(--settings-nav-text-secondary)'
                                : 'var(--settings-nav-text-tertiary)',
                            }}
                          >
                            {item.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </nav>

      {accountBlock ? <div className="mt-5">{accountBlock}</div> : null}
    </aside>
  );
};

export default SettingsDesktopSidebar;
