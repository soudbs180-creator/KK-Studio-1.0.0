// 中文注释：平台无关的设计令牌，用于在不同端统一主题色、布局、动态与配色逻辑
export const UI_SYSTEM_TOKENS = {
  breakpoints: {
    phoneSmall: 375,
    phoneStandard: 430,
    tablet: 768,
    desktop: 1024,
    desktopWide: 1280,
    desktopLarge: 1440,
  },
  spacing: {
    1: "var(--kk-space-1)",
    2: "var(--kk-space-2)",
    3: "var(--kk-space-3)",
    4: "var(--kk-space-4)",
    5: "var(--kk-space-5)",
    6: "var(--kk-space-6)",
    8: "var(--kk-space-8)",
    10: "var(--kk-space-10)",
    12: "var(--kk-space-12)",
  },
  layout: {
    mobilePageMargin: "16px",
    tabletPageMargin: "24px",
    desktopPageMargin: "32px",
    contentMaxWidth: "1200px",
    contentWideMaxWidth: "1440px",
    touchTargetMin: "44px",
    desktopControlHeight: "40px",
    mobileControlHeight: "48px",
  },
  typography: {
    bodyMobile: "16px",
    bodyDesktop: "14px",
    caption: "12px",
    lineHeightBody: "1.5",
    lineHeightTight: "1.2",
  },
  motion: {
    durationFast: "var(--kk-motion-fast)",
    durationStandard: "var(--kk-motion-standard)",
    durationPanel: "var(--kk-motion-panel)",
    easeStandard: "var(--kk-motion-ease-standard)",
  },
  glass: {
    surface: "var(--kk-glass-surface-bg)",
    border: "var(--kk-glass-surface-border)",
    blur: "var(--kk-ui-glass-blur)",
    opacity: "var(--kk-ui-glass-opacity)",
  },
} as const;

export const TOKENS = {
  colors: {
    background: "var(--kk-color-bg-canvas)",
    surface: "var(--kk-color-bg-surface)",
    surfaceSolid: "var(--kk-color-bg-surface-solid)",
    surfaceGlass: "rgba(15, 23, 42, 0.75)",
    surfaceGlassBorder: "rgba(255, 255, 255, 0.1)",
    textPrimary: "var(--kk-color-text-primary)",
    textSecondary: "var(--kk-color-text-secondary)",
    textTertiary: "var(--kk-color-text-tertiary)",
    borderSubtle: "var(--kk-color-border-subtle)",
    brandPrimary: "var(--kk-color-brand-primary)",
    brandCoral: "var(--kk-color-brand-coral)",
    accentIndigo: "#6366F1",
    accentEmerald: "#10B981",
    accentAmber: "#F59E0B",
    glowAccent: "rgba(99, 102, 241, 0.3)",
  },
  radius: {
    sm: "var(--kk-radius-sm)",
    md: "var(--kk-radius-md)",
    lg: "var(--kk-radius-lg)",
    xl: "var(--kk-radius-xl)",
    full: "9999px",
  },
  shadows: {
    surface: "var(--kk-shadow-surface)",
    floating: "var(--kk-shadow-floating)",
    primaryAction: "var(--kk-shadow-primary-action)",
    cardSelected: "0 0 0 2px #6366F1, 0 10px 25px -5px rgba(99, 102, 241, 0.4)",
    glow: "0 0 20px rgba(99, 102, 241, 0.35)",
  },
  typography: {
    fontFamily: "Inter, Roboto, sans-serif",
    displayFontFamily: "Outfit, Inter, sans-serif",
  },
  uiSystem: UI_SYSTEM_TOKENS,
};

export type ThemeTokens = typeof TOKENS;

