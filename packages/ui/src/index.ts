// 中文注释：定义并导出跨端安全的设计令牌（Design Tokens）
// 包含主题颜色、字体等，确保桌面端和移动端能以一致的设计规范进行渲染

export const TOKENS = {
  colors: {
    // 默认背景（纯白）
    background: "#FFFFFF",
    // 次级背景（Gray-50，用于交替区域）
    canvasMuted: "#F9FAFB",
    // 主要文字（Gray-900）
    foreground: "#111827",
    // 次要文字（Gray-500，用于副标题/描述）
    foregroundMuted: "#6B7280",
    // 边框颜色（Gray-200，卡片/分隔线）
    borderGhost: "#E5E7EB",
    // 主操作色（Blue-600，主按钮/激活状态）
    primary: "#2563EB",
    // 软操作背景（Blue-50，次要按钮背景）
    primarySoft: "#EFF6FF",
    // 数据可视化（Orange-600，进度环等）
    chartOrange: "#EA580C",
  },
  typography: {
    // 项目唯一字体
    fontFamily: "Inter",
  }
};
export type ThemeTokens = typeof TOKENS;
