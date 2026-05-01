import React from 'react';

interface MobileEmbeddedAdvancedDrawerProps {
  summaryText: string;
  promptTools: React.ReactNode;
  modePanel: React.ReactNode;
}

const MobileEmbeddedAdvancedDrawer: React.FC<MobileEmbeddedAdvancedDrawerProps> = ({
  summaryText,
  promptTools,
  modePanel,
}) => {
  return (
    <details
      data-mobile-composer-section="advanced-drawer"
      className="w-full min-w-0 text-[var(--text-primary)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[16px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--toolbar-hover)] marker:hidden">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            高级设置
          </div>
          <div className="mt-1 truncate text-[12px] font-medium text-[var(--text-secondary)]">
            {summaryText}
          </div>
        </div>
        <span className="rounded-full border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
          展开
        </span>
      </summary>

      <div
        data-mobile-secondary-menu="promptbar-low-frequency-actions"
        className="mt-1 space-y-2 border-t border-[var(--frost-card-sub-border)] px-2.5 pb-2 pt-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          {promptTools}
        </div>
        <div className="w-full min-w-0">
          {modePanel}
        </div>
      </div>
    </details>
  );
};

export default MobileEmbeddedAdvancedDrawer;
