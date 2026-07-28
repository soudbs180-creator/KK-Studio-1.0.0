import React, { useId } from 'react';

export interface KkTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * CSS-driven tooltip that is available to both pointer and keyboard users.
 */
export function KkTooltip({
  content,
  children,
  placement = 'top',
  className,
}: KkTooltipProps) {
  const tooltipId = useId();

  return (
    <span
      className={['kk-tooltip', className].filter(Boolean).join(' ')}
      data-placement={placement}
      aria-describedby={tooltipId}
    >
      {children}
      <span id={tooltipId} className="kk-tooltip__content" role="tooltip">
        {content}
      </span>
    </span>
  );
}
