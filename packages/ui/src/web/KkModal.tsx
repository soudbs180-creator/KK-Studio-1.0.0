import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { trapFocusWithin } from './focusManagement';

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
  return typeof width === 'number' ? `${width}px` : width || '412px';
}

function mergeClassName(...values: Array<string | undefined>): string | undefined {
  const className = values.filter(Boolean).join(' ');
  return className || undefined;
}

function useModalA11y(
  isOpen: boolean,
  panelRef: React.RefObject<HTMLElement | null>,
  onCancel: KkModalProps['onCancel'],
) {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel?.(event);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, onCancel, panelRef]);
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
  zIndex,
  children,
}: KkModalProps) {
  const isOpen = open ?? visible ?? false;
  const titleId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  useModalA11y(isOpen, panelRef, onCancel);

  if ((!isOpen && destroyOnClose) || !isOpen || typeof document === 'undefined') return null;

  const handleMaskClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (maskClosable && event.target === event.currentTarget) onCancel?.(event);
  };

  return createPortal(
    <div
      className={mergeClassName('kk-modal-root', wrapClassName)}
      data-centered={centered || undefined}
      onMouseDown={handleMaskClick}
      role="presentation"
      style={zIndex === undefined ? undefined : { zIndex }}
    >
      <section
        ref={panelRef}
        className={mergeClassName('kk-modal-panel', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => trapFocusWithin(event.nativeEvent, panelRef.current)}
        style={{ width: `min(calc(100vw - 32px), ${resolveWidth(width)})`, ...style }}
      >
        {title || closable ? (
          <header className="kk-modal-header">
            {title ? <h2 id={titleId}>{title}</h2> : <span />}
            {closable ? (
              <button type="button" aria-label="Close" onClick={onCancel} className="kk-modal-close">
                ×
              </button>
            ) : null}
          </header>
        ) : null}
        <div className="kk-modal-body" style={bodyStyle}>{children}</div>
        {footer !== null ? <footer className="kk-modal-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
