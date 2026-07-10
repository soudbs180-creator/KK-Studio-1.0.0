import React, { type ReactNode } from 'react';

interface MobileAppShellProps {
  header: ReactNode;
  feed: ReactNode;
  composer: ReactNode;
  overlays?: ReactNode;
}

const MobileAppShell: React.FC<MobileAppShellProps> = ({
  header,
  feed,
  composer,
  overlays,
}) => {
  const shellStyle = {
    gridTemplateRows: 'minmax(0, 1fr) auto',
    '--mobile-content-top-inset': 'calc(env(safe-area-inset-top, 0px) + 76px)',
    '--mobile-content-bottom-inset': 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    '--mobile-tabbar-total-height': '0px',
  } as React.CSSProperties;

  return (
    <div
      data-testid="mobile-app-shell"
      className="relative isolate grid h-dvh max-h-dvh grid-cols-1 overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] lg:hidden"
      style={shellStyle}
    >
      <div
        data-slot="header"
        className="absolute top-0 left-0 right-0 z-20 min-h-0"
      >
        {/* 简体中文：极致柔和的 ease-scrim 顶栏渐变底板，限制在 Header 蓝色区实际高度内，pointer-events-none 防止阻碍卡片操作 */}
        <div 
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background: 'var(--mobile-header-scrim-bg)'
          }}
        />
        <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {header}
        </div>
      </div>

      <main data-slot="feed" className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {feed}
        </div>
      </main>

      <div
        data-slot="composer"
        className="z-20 min-h-0 overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {composer}
      </div>

      <div data-slot="overlays" className="pointer-events-none absolute inset-0 z-30">
        {overlays}
      </div>
    </div>
  );
};

export default MobileAppShell;
