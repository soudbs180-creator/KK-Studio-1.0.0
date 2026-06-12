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
} as const;
