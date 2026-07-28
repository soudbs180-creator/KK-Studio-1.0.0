// packages/ui/src/core/layout.ts
// 中文注释：布局控制与防溢出通用设计令牌

export const KK_LAYOUT = {
  // 滚动条样式定义
  scrollbarClass: 'kk-custom-scrollbar',
  
  // 防溢出基础样式类
  preventOverflowClass: 'kk-min-w-0 kk-break-anywhere',
  
  // 最小物理布局尺寸约束
  minCardWidth: 200,
  minSidebarWidth: 280,

  // Shared workspace geometry. Keeping these values in the UI package makes
  // the canvas, assistant drawer, and floating controls use the same frame.
  workspace: {
    navigationRailWidth: 260,
    compactRailWidth: 60,
    assistantSidebarDefaultWidth: 420,
    assistantSidebarTakeoverWidth: 380,
    assistantSidebarMinWidth: 320,
    assistantSidebarMaxWidth: 800,
    assistantEdgeToggleWidth: 24,
    topBarHeight: 48,
    leftPanelWidth: 262,
    leftPanelInset: 12,
    leftPanelBottom: 10,
    composerMaxWidth: 570,
    composerBottom: 10,
    dialogWidth: 412,
    dialogMaxHeight: 546,
    desktopButtonHeight: 30,
    desktopPillHeight: 32,
    desktopControlHeight: 36,
    mobileTouchTarget: 44,
    mobileDrawerMaxWidth: 320,
    mobileDrawerViewportWidth: 88,
    mobileComposerInset: 8,
  },
} as const;

export type WorkspaceLayout = typeof KK_LAYOUT.workspace;

export const normalizeAssistantSidebarWidth = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return KK_LAYOUT.workspace.assistantSidebarDefaultWidth;
  return Math.min(
    KK_LAYOUT.workspace.assistantSidebarMaxWidth,
    Math.max(KK_LAYOUT.workspace.assistantSidebarMinWidth, Math.round(numeric)),
  );
};
