import React from 'react';

export interface KkComposerShellProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

/**
 * Stable prompt-composer frame used by Canvas, Copilot, and Create modes.
 */
export function KkComposerShell({
  elevated = false,
  className,
  ...props
}: KkComposerShellProps) {
  return (
    <div
      {...props}
      data-elevated={elevated || undefined}
      className={['kk-composer-shell', className].filter(Boolean).join(' ')}
    />
  );
}
