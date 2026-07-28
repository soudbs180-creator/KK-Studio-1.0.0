import React from 'react';

export type KkSurfaceVariant = 'canvas' | 'panel' | 'control' | 'dialog' | 'sheet';

export interface KkSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: KkSurfaceVariant;
}

function mergeClassName(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/**
 * Shared visual surface for every KK Studio workspace layer.
 * The closed variant set prevents business features from creating parallel themes.
 */
export function KkSurface({
  variant,
  className,
  ...props
}: KkSurfaceProps) {
  return (
    <div
      {...props}
      data-surface={variant}
      className={mergeClassName('kk-surface', `kk-surface--${variant}`, className)}
    />
  );
}
