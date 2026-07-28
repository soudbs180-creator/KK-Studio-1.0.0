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
      className={['kk-input', className].filter(Boolean).join(' ')}
      data-status={status}
      data-size={size}
      style={style}
    />
  );

  if (!hasAdornment(prefix, suffix, allowClear)) {
    return input;
  }

  return (
    <span className="kk-input-affix-wrapper" data-size={size} data-status={status}>
      {prefix ? <span className="kk-input-prefix">{prefix}</span> : null}
      {React.cloneElement(input, { className: 'kk-input', style: undefined })}
      {allowClear && value ? (
        <button type="button" aria-label="Clear" onClick={onClear} className="kk-input__clear">
          ×
        </button>
      ) : null}
      {suffix ? <span className="kk-input-suffix">{suffix}</span> : null}
    </span>
  );
}
