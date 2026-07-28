import React from 'react';

export type KkButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost' | 'recharge';
export type KkButtonSize = 'small' | 'middle' | 'large';

export interface KkButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  tone?: KkButtonTone;
  htmlType?: React.ButtonHTMLAttributes<HTMLButtonElement>['type'];
  loading?: boolean;
  icon?: React.ReactNode;
  block?: boolean;
  size?: KkButtonSize;
}

function mergeClassName(...values: Array<string | undefined>): string | undefined {
  const className = values.filter(Boolean).join(' ');
  return className || undefined;
}

export function KkButton({
  tone = 'secondary',
  htmlType = 'button',
  loading = false,
  icon,
  block = false,
  size = 'middle',
  disabled,
  className,
  children,
  style,
  ...props
}: KkButtonProps) {
  return (
    <button
      {...props}
      type={htmlType}
      disabled={disabled || loading}
      data-tone={tone}
      data-size={size}
      data-block={block || undefined}
      aria-busy={loading || undefined}
      className={mergeClassName('kk-button', `kk-button--${tone}`, className)}
      style={style}
    >
      {loading ? <span className="kk-button__loading" aria-hidden="true">…</span> : icon}
      {children}
    </button>
  );
}
