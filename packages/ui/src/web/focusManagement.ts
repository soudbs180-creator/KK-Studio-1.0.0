const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

/**
 * Keeps keyboard focus within an active modal surface without changing pointer behavior.
 */
export function trapFocusWithin(event: KeyboardEvent, container: HTMLElement | null): void {
  if (event.key !== 'Tab' || !container) return;
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = container.ownerDocument.activeElement;
  const shouldWrapBackward = event.shiftKey && (
    activeElement === firstElement || activeElement === container
  );
  const shouldWrapForward = !event.shiftKey && activeElement === lastElement;

  if (shouldWrapBackward || shouldWrapForward) {
    event.preventDefault();
    (shouldWrapBackward ? lastElement : firstElement).focus();
  }
}
