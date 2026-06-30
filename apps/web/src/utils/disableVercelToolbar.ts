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

export function disableVercelToolbar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  ensureToolbarHideStyle();
  removeInjectedToolbar();

  const handleMutations = (records: MutationRecord[]) => {
    let shouldRemove = false;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) {
          // 只通过比对标签名称以及 script src 快速过滤，避免执行高吞吐下的全局 querySelector 导致 INP 阻塞
          if (
            node.localName === TOOLBAR_HOST_SELECTOR ||
            (node.localName === 'script' && node.getAttribute('src')?.includes('vercel.live'))
          ) {
            shouldRemove = true;
            break;
          }
        }
      }
      if (shouldRemove) break;
    }

    if (shouldRemove) {
      removeInjectedToolbar();
    }
  };

  const observer = new MutationObserver(handleMutations);

  // Vercel toolbar 节点只会在 head 或 body 直属层级下进行动态插入。
  // 通过将 subtree 设为 false，彻底避免对 React 内部组件树千万级 DOM 深度变化的拦截重算。
  if (document.head) {
    observer.observe(document.head, { childList: true, subtree: false });
  }
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: false });
  } else {
    const docObserver = new MutationObserver((_, obs) => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: false });
        obs.disconnect();
      }
    });
    docObserver.observe(document.documentElement, { childList: true, subtree: false });
  }
}
