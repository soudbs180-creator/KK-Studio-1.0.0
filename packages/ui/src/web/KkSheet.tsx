import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { trapFocusWithin } from './focusManagement';

export type KkSheetPlacement = 'bottom' | 'left' | 'right';

export interface KkSheetProps {
  open: boolean;
  title?: React.ReactNode;
  placement?: KkSheetPlacement;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Responsive drawer and bottom-sheet primitive with Escape and focus restoration.
 */
export function KkSheet({
  open,
  title,
  placement = 'bottom',
  onClose,
  children,
  className,
}: KkSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="kk-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={sheetRef}
        className={['kk-sheet', className].filter(Boolean).join(' ')}
        data-placement={placement}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => trapFocusWithin(event.nativeEvent, sheetRef.current)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="kk-sheet__header">
          {title ? <h2 id={titleId}>{title}</h2> : <span />}
          <button type="button" className="kk-sheet__close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="kk-sheet__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
