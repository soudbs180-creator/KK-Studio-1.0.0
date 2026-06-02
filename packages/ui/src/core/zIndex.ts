// 中文注释：统一管理应用的层级 z-index 体系，防止弹窗或浮层冲突
export const Z_INDEX = {
  canvas: "var(--kk-z-canvas, 1)",
  chrome: "var(--kk-z-chrome, 100)",
  dropdown: "var(--kk-z-dropdown, 1000)",
  modal: "var(--kk-z-modal, 3000)",
  toast: "var(--kk-z-toast, 5000)",
};

export type ZIndexConfig = typeof Z_INDEX;
