import React from 'react';

export interface KkInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  allowClear?: boolean;
  onClear?: () => void;
  status?: 'error' | 'warning';
  size?: 'small' | 'middle' | 'large';
}

function hasAdornment(prefix: React.ReactNode, suffix: React.ReactNode, allowClear?: boolean): boolean {
  return Boolean(prefix || suffix || allowClear);
}

export function KkInput({
  prefix,
  suffix,
  allowClear,
  onClear,
  status,
  size = 'middle',
  className,
  style,
  value,
  onChange,
  ...props
}: KkInputProps) {
  const input = (
    <input
      {...props}
      value={value}
      onChange={onChange}
      className={className}
      data-status={status}
      data-size={size}
      style={{
        width: '100%',
        minHeight: size === 'large' ? '44px' : size === 'small' ? '32px' : '38px',
        border: '1px solid var(--frost-card-framework-border, rgba(148, 163, 184, 0.18))',
        borderRadius: '10px',
        padding: '0 12px',
        background: 'var(--frost-card-framework-bg-solid, rgba(255, 255, 255, 0.08))',
        color: 'var(--text-primary, var(--kk-ui-text-primary, #fff))',
        outline: 'none',
        ...style,
      }}
    />
  );

  if (!hasAdornment(prefix, suffix, allowClear)) {
    return input;
  }

  return (
    <span
      className="kk-input-affix-wrapper"
      style={{
        display: 'inline-flex',
        width: style?.width ?? '100%',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid var(--frost-card-framework-border, rgba(148, 163, 184, 0.18))',
        borderRadius: '10px',
        padding: '0 10px',
        background: 'var(--frost-card-framework-bg-solid, rgba(255, 255, 255, 0.08))',
      }}
    >
      {prefix ? <span className="kk-input-prefix">{prefix}</span> : null}
      {React.cloneElement(input, {
        className: undefined,
        style: {
          minWidth: 0,
          minHeight: size === 'large' ? '42px' : size === 'small' ? '30px' : '36px',
          flex: 1,
          border: 0,
          borderRadius: 0,
          padding: 0,
          background: 'transparent',
          color: 'var(--text-primary, var(--kk-ui-text-primary, #fff))',
          outline: 'none',
        },
      })}
      {allowClear && value ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={onClear}
          style={{
            border: 0,
            background: 'transparent',
            color: 'var(--text-secondary, var(--kk-ui-text-secondary, #cbd5e1))',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      ) : null}
      {suffix ? <span className="kk-input-suffix">{suffix}</span> : null}
    </span>
  );
}
