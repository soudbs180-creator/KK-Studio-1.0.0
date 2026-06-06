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

const HEIGHT_BY_SIZE: Record<KkButtonSize, string> = {
  small: '32px',
  middle: '38px',
  large: '44px',
};

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
      className={mergeClassName('kk-button', `kk-button--${tone}`, className)}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        minHeight: HEIGHT_BY_SIZE[size],
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        border: '1px solid var(--frost-card-framework-border, rgba(148, 163, 184, 0.18))',
        borderRadius: '10px',
        padding: size === 'small' ? '0 12px' : '0 16px',
        background: tone === 'primary' || tone === 'recharge'
          ? 'var(--kk-gradient-primary-action, linear-gradient(135deg, #6366f1, #4f46e5))'
          : tone === 'danger'
            ? 'rgba(239, 68, 68, 0.14)'
            : tone === 'ghost'
              ? 'transparent'
              : 'var(--frost-card-framework-bg-solid, rgba(255, 255, 255, 0.08))',
        color: tone === 'primary' || tone === 'recharge'
          ? '#fff'
          : tone === 'danger'
            ? '#ef4444'
            : 'var(--text-primary, var(--kk-ui-text-primary, #fff))',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.62 : 1,
        fontSize: size === 'large' ? '15px' : '14px',
        fontWeight: 650,
        lineHeight: 1,
        transition: 'opacity 160ms ease, transform 160ms ease, background 160ms ease',
        ...style,
      }}
    >
      {loading ? <span aria-hidden="true">...</span> : icon}
      {children}
    </button>
  );
}
