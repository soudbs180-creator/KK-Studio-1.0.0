// 中文注释：平台无关的设计令牌，用于在不同端统一主题色与配色逻辑
export const TOKENS = {
  colors: {
    background: "var(--kk-color-bg-canvas)",
    surface: "var(--kk-color-bg-surface)",
    surfaceSolid: "var(--kk-color-bg-surface-solid)",
    textPrimary: "var(--kk-color-text-primary)",
    textSecondary: "var(--kk-color-text-secondary)",
    textTertiary: "var(--kk-color-text-tertiary)",
    borderSubtle: "var(--kk-color-border-subtle)",
    brandPrimary: "var(--kk-color-brand-primary)",
    brandCoral: "var(--kk-color-brand-coral)",
  },
  radius: {
    sm: "var(--kk-radius-sm)",
    md: "var(--kk-radius-md)",
    lg: "var(--kk-radius-lg)",
    xl: "var(--kk-radius-xl)",
  },
  shadows: {
    surface: "var(--kk-shadow-surface)",
    floating: "var(--kk-shadow-floating)",
    primaryAction: "var(--kk-shadow-primary-action)",
  },
  typography: {
    fontFamily: "Inter, sans-serif",
  }
};

export type ThemeTokens = typeof TOKENS;
