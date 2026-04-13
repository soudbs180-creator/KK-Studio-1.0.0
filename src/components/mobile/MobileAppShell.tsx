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
  return (
    <div
      data-testid="mobile-app-shell"
      className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] md:hidden"
    >
      <div
        data-slot="header"
        className="sticky top-0 z-20 shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {header}
      </div>

      <main data-slot="feed" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {feed}
        </div>
      </main>

      <div
        data-slot="composer"
        className="sticky bottom-0 z-20 shrink-0"
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
