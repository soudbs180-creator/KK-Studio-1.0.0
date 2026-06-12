// packages/ui/src/core/layers.ts
// 中文注释：系统核心 UI 绝对层级（z-index）管理

export const KK_LAYER = {
  canvasBase: 1,
  connector: 5,
  node: 10,
  nodeSelected: 30,
  floating: 100,
  toolbar: 200,
  drawerBackdrop: 500,
  drawer: 600,
  promptComposer: 960,
  modalBackdrop: 1000,
  modal: 1050,
  dropdown: 1100,
  toast: 1200,
  fullscreen: 1300,
} as const;
