import React from 'react';

export interface KkTabItem<TValue extends string = string> {
  value: TValue;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface KkTabsProps<TValue extends string = string> {
  value: TValue;
  items: ReadonlyArray<KkTabItem<TValue>>;
  onChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Compact tab list shared by workspace mode, asset, and settings navigation.
 */
export function KkTabs<TValue extends string>({
  value,
  items,
  onChange,
  ariaLabel,
  className,
}: KkTabsProps<TValue>) {
  return (
    <div className={['kk-tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          disabled={item.disabled}
          className="kk-tabs__tab"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
