/**
 * Settings Skeleton Components
 * 设置面板骨架屏组件 - 提升加载体验
 */
import React from 'react';

export const SettingsSkeletonCard: React.FC<{ height?: number; className?: string }> = ({
  height = 120,
  className = '',
}) => (
  <div
    className={`animate-pulse rounded-2xl border border-[var(--settings-border-subtle)] bg-[var(--settings-surface-elevated)] p-4 ${className}`}
    style={{ height }}
  >
    <div className="flex items-start gap-4">
      <div className="h-11 w-11 rounded-2xl bg-[var(--settings-surface-muted)]"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-[var(--settings-surface-muted)]"></div>
        <div className="h-3 w-2/3 rounded bg-[var(--settings-surface-muted)]"></div>
      </div>
    </div>
  </div>
);

export const SettingsSkeletonMetric: React.FC = () => (
  <div className="animate-pulse rounded-[16px] border border-[var(--settings-border-subtle)] bg-[var(--settings-surface-elevated)] p-3.5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-20 rounded bg-[var(--settings-surface-muted)]"></div>
        <div className="h-6 w-24 rounded bg-[var(--settings-surface-muted)]"></div>
        <div className="h-3 w-32 rounded bg-[var(--settings-surface-muted)]"></div>
      </div>
      <div className="h-9 w-9 rounded-xl bg-[var(--settings-surface-muted)]"></div>
    </div>
  </div>
);

export const SettingsSkeletonSection: React.FC<{ title?: boolean }> = ({ title = true }) => (
  <div className="animate-pulse rounded-[18px] border border-[var(--settings-border-subtle)] bg-[var(--settings-surface-elevated)] p-4">
    {title && (
      <div className="mb-3 space-y-2">
        <div className="h-5 w-32 rounded bg-[var(--settings-surface-muted)]"></div>
        <div className="h-4 w-2/3 rounded bg-[var(--settings-surface-muted)]"></div>
      </div>
    )}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SettingsSkeletonMetric key={i} />
      ))}
    </div>
  </div>
);

export const SettingsSkeletonDashboard: React.FC = () => (
  <div className="space-y-3">
    <SettingsSkeletonSection />
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr),minmax(320px,0.8fr)]">
      <SettingsSkeletonCard height={200} />
      <SettingsSkeletonCard height={200} />
    </div>
    <SettingsSkeletonCard height={150} />
  </div>
);

export const SettingsSkeletonNav: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 2 }).map((_, sectionIdx) => (
      <div key={sectionIdx} className="space-y-2">
        <div className="h-4 w-16 rounded bg-[var(--settings-surface-muted)]"></div>
        {Array.from({ length: 3 }).map((_, itemIdx) => (
          <div
            key={itemIdx}
            className="animate-pulse rounded-xl border border-[var(--settings-border-subtle)] bg-[var(--settings-surface-elevated)] p-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[var(--settings-surface-muted)]"></div>
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 rounded bg-[var(--settings-surface-muted)]"></div>
                <div className="h-3 w-40 rounded bg-[var(--settings-surface-muted)]"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

export default {
  Card: SettingsSkeletonCard,
  Metric: SettingsSkeletonMetric,
  Section: SettingsSkeletonSection,
  Dashboard: SettingsSkeletonDashboard,
  Nav: SettingsSkeletonNav,
};
