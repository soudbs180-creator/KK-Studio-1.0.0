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
    gridTemplateRows:
      'minmax(0, var(--mobile-home-header-share, 10fr)) minmax(0, var(--mobile-home-feed-share, 60fr)) minmax(0, var(--mobile-home-composer-share, 30fr))',
    '--mobile-content-top-inset': 'calc(env(safe-area-inset-top, 0px) + 12px)',
    '--mobile-content-bottom-inset': 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    '--mobile-tabbar-total-height': '0px',
  } as React.CSSProperties;

  return (
    <div
      data-testid="mobile-app-shell"
      className="relative isolate grid min-h-dvh grid-cols-1 overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] lg:hidden"
      style={shellStyle}
    >
      <div
        data-slot="header"
        className="z-20 min-h-0 overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {header}
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
