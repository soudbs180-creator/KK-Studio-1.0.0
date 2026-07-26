import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface OverlayFocusLifecycleOptions {
  isOpen: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.getAttribute('aria-hidden') !== 'true');

const handleOverlayKeyDown = (
  event: KeyboardEvent,
  container: HTMLElement,
  onClose: () => void,
) => {
  if (event.defaultPrevented) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  if (!firstElement || !lastElement) {
    event.preventDefault();
    container.focus();
  } else if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
};

/**
 * Keeps keyboard focus inside a modal surface and restores it to the invoker
 * so page-level overlays follow the same interaction contract.
 */
export function useOverlayFocusLifecycle({
  isOpen,
  onClose,
  containerRef,
  initialFocusRef,
}: OverlayFocusLifecycleOptions) {
  const closeHandlerRef = useRef(onClose);
  const invokerRef = useRef<HTMLElement | null>(null);
  closeHandlerRef.current = onClose;

  useEffect(() => {
    const container = containerRef.current;
    if (!isOpen || !container) return;

    invokerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      (initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) =>
      handleOverlayKeyDown(event, container, () => closeHandlerRef.current());

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => {
        if (invokerRef.current?.isConnected) invokerRef.current?.focus();
      });
    };
  }, [containerRef, initialFocusRef, isOpen]);
}
