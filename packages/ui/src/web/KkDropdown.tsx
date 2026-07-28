import React, { useEffect, useRef, useState } from 'react';

export interface KkDropdownMenuItem {
  key: string;
  label: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

export interface KkDropdownProps {
  children?: React.ReactNode;
  overlay?: React.ReactNode;
  menu?: { items?: KkDropdownMenuItem[] };
  trigger?: Array<'click' | 'hover'>;
  disabled?: boolean;
  className?: string;
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
}

export function KkDropdown({
  children,
  overlay,
  menu,
  trigger = ['click'],
  disabled = false,
  className,
  placement = 'bottomLeft',
}: KkDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const useHover = trigger.includes('hover');

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  const popup = overlay ?? (
    <div className="kk-dropdown-menu" role="menu">
      {(menu?.items ?? []).map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onClick?.();
            setOpen(false);
          }}
          className="kk-dropdown-menu__item"
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <span
      ref={rootRef}
      className={['kk-dropdown', className].filter(Boolean).join(' ')}
      onClick={() => {
        if (!disabled && trigger.includes('click')) {
          setOpen((current) => !current);
        }
      }}
      onMouseEnter={() => {
        if (!disabled && useHover) {
          setOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (useHover) {
          setOpen(false);
        }
      }}
    >
      {children}
      {open ? (
        <span
          className="kk-dropdown-popup"
          data-placement={placement}
        >
          {popup}
        </span>
      ) : null}
    </span>
  );
}
