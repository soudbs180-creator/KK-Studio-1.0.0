import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

export interface KkModalProps {
  open?: boolean;
  visible?: boolean;
  onCancel?: (event?: React.MouseEvent<HTMLButtonElement | HTMLDivElement> | KeyboardEvent) => void;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
  centered?: boolean;
  destroyOnClose?: boolean;
  maskClosable?: boolean;
  closable?: boolean;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  className?: string;
  wrapClassName?: string;
  zIndex?: number;
  children?: React.ReactNode;
}

function resolveWidth(width: KkModalProps['width']): string {
  if (typeof width === 'number') {
    return `${width}px`;
  }

  return width || '640px';
}

function mergeClassName(...values: Array<string | undefined>): string | undefined {
  const className = values.filter(Boolean).join(' ');
  return className || undefined;
}

export function KkModal({
  open,
  visible,
  onCancel,
  title,
  footer,
  width,
  centered = false,
  destroyOnClose = false,
  maskClosable = true,
  closable = true,
  style,
  bodyStyle,
  className,
  wrapClassName,
  zIndex = 3000,
  children,
}: KkModalProps) {
  const isOpen = open ?? visible ?? false;
  const titleId = useId();

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel?.(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen && destroyOnClose) {
    return null;
  }

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const handleMaskClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (maskClosable && event.target === event.currentTarget) {
      onCancel?.(event);
    }
  };

  const modal = (
    <div
      className={mergeClassName('kk-modal-root', wrapClassName)}
      onMouseDown={handleMaskClick}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: centered ? 'center' : 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: centered ? '24px' : '64px 24px 24px',
        background: 'rgba(0, 0, 0, 0.62)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <section
        className={mergeClassName('kk-modal-panel', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        style={{
          width: `min(calc(100vw - 32px), ${resolveWidth(width)})`,
          borderRadius: 'var(--kk-ui-border-radius, 16px)',
          border: '1px solid var(--frost-card-framework-border, rgba(148, 163, 184, 0.18))',
          background: 'var(--frost-card-framework-bg-solid, var(--kk-ui-bg-container, #121216))',
          color: 'var(--text-primary, var(--kk-ui-text-primary, #fff))',
          boxShadow: 'var(--kk-shadow-floating, 0 30px 80px rgba(0, 0, 0, 0.45))',
          overflow: 'hidden',
          ...style,
        }}
      >
        {title || closable ? (
          <header
            className="kk-modal-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '18px 20px',
              borderBottom: '1px solid var(--frost-card-framework-border, rgba(148, 163, 184, 0.16))',
            }}
          >
            {title ? (
              <h2
                id={titleId}
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                {title}
              </h2>
            ) : <span />}
            {closable ? (
              <button
                type="button"
                aria-label="Close"
                onClick={onCancel}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 0,
                  borderRadius: '10px',
                  background: 'transparent',
                  color: 'var(--text-secondary, var(--kk-ui-text-secondary, #cbd5e1))',
                  cursor: 'pointer',
                  fontSize: '22px',
                  lineHeight: '30px',
                }}
              >
                ×
              </button>
            ) : null}
          </header>
        ) : null}
        <div
          className="kk-modal-body"
          style={{
            padding: '20px',
            ...bodyStyle,
          }}
        >
          {children}
        </div>
        {footer !== null ? (
          <footer
            className="kk-modal-footer"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 20px',
              borderTop: '1px solid var(--frost-card-framework-border, rgba(148, 163, 184, 0.16))',
            }}
          >
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
