const HIDE_STYLE_ID = 'kk-disable-vercel-toolbar-style';
const TOOLBAR_SCRIPT_SELECTOR = 'script[src*="vercel.live/_next-live/feedback/feedback.js"]';
const TOOLBAR_HOST_SELECTOR = 'vercel-live-feedback';

type ToolbarHandle = {
  unmount?: () => void;
};

declare global {
  interface Window {
    __vercel_toolbar?: ToolbarHandle;
  }
}

function ensureToolbarHideStyle() {
  if (document.getElementById(HIDE_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = HIDE_STYLE_ID;
  style.textContent = `
    ${TOOLBAR_HOST_SELECTOR} {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

function removeInjectedToolbar() {
  window.__vercel_toolbar?.unmount?.();

  document.querySelectorAll<HTMLElement>(TOOLBAR_HOST_SELECTOR).forEach((node) => {
    node.remove();
  });

  document.querySelectorAll<HTMLScriptElement>(TOOLBAR_SCRIPT_SELECTOR).forEach((node) => {
    node.remove();
  });
}

function matchesToolbarNode(node: Node) {
  if (!(node instanceof Element)) {
    return false;
  }

  return node.matches(TOOLBAR_HOST_SELECTOR)
    || node.matches(TOOLBAR_SCRIPT_SELECTOR)
    || node.querySelector(TOOLBAR_HOST_SELECTOR) !== null
    || node.querySelector(TOOLBAR_SCRIPT_SELECTOR) !== null;
}

export function disableVercelToolbar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  ensureToolbarHideStyle();
  removeInjectedToolbar();

  // Vercel can inject the toolbar after the app boots, so keep stripping it out.
  const observer = new MutationObserver((records) => {
    const hasToolbarInsertion = records.some((record) =>
      Array.from(record.addedNodes).some((node) => matchesToolbarNode(node))
    );

    if (hasToolbarInsertion) {
      removeInjectedToolbar();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
