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
    <div role="menu">
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
          style={{
            display: 'block',
            width: '100%',
            border: 0,
            padding: '8px 12px',
            background: 'transparent',
            color: 'var(--text-primary, var(--kk-ui-text-primary, #fff))',
            textAlign: 'left',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? 0.5 : 1,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <span
      ref={rootRef}
      className={className}
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
      style={{
        position: 'relative',
        display: 'inline-flex',
      }}
    >
      {children}
      {open ? (
        <span
          className="kk-dropdown-popup"
          style={{
            position: 'absolute',
            top: placement.startsWith('bottom') ? 'calc(100% + 8px)' : undefined,
            bottom: placement.startsWith('top') ? 'calc(100% + 8px)' : undefined,
            left: placement.endsWith('Left') ? 0 : undefined,
            right: placement.endsWith('Right') ? 0 : undefined,
            zIndex: 1000,
            minWidth: '180px',
            border: '1px solid var(--frost-card-framework-border, rgba(148, 163, 184, 0.18))',
            borderRadius: '12px',
            background: 'var(--frost-card-framework-bg-solid, var(--kk-ui-bg-container, #121216))',
            boxShadow: 'var(--kk-shadow-floating, 0 24px 64px rgba(0, 0, 0, 0.35))',
            padding: '6px',
          }}
        >
          {popup}
        </span>
      ) : null}
    </span>
  );
}
