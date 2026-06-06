import React from 'react';

export type KkSelectValue = string | number;

export interface KkSelectOption {
  label: React.ReactNode;
  value: KkSelectValue;
  disabled?: boolean;
}

export interface KkSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'defaultValue' | 'onChange' | 'size'> {
  options?: KkSelectOption[];
  value?: KkSelectValue;
  defaultValue?: KkSelectValue;
  onChange?: (value: KkSelectValue, option?: KkSelectOption) => void;
  size?: 'small' | 'middle' | 'large';
}

export function KkSelect({
  options = [],
  value,
  defaultValue,
  onChange,
  size = 'middle',
  className,
  style,
  children,
  ...props
}: KkSelectProps) {
  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    const selectedValue = event.currentTarget.value;
    const selectedOption = options.find((option) => String(option.value) === selectedValue);
    onChange?.(selectedOption?.value ?? selectedValue, selectedOption);
  };

  return (
    <select
      {...props}
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
      onChange={handleChange}
      className={className}
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
    >
      {options.map((option) => (
        <option
          key={String(option.value)}
          value={String(option.value)}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
}
