import type {
  AppearanceMotionPreferences,
  WebPerformanceMode,
} from '../../context/AppearanceMotionContext';

export const GENERATION_ROUTE_STORAGE_KEY = 'kk_studio_preferred_generation_mode';
export const CANVAS_PERFORMANCE_STORAGE_KEY = 'kk_studio_canvas_perf_mode';
export const SETTINGS_QUICK_PREFERENCES_EVENT = 'kk-settings-quick-preferences-change';

/**
 * 生成路由偏好。必须与两处消费方保持同一取值域：
 * - 写入与选择：components/settings/views/GenerationModeView.tsx
 * - 实际路由判定：core/routing/ProviderRouteEngine.ts
 * 两者都按 auto/local/cloud/platform 四值工作。此处若窄化为两值，
 * 总览页读到 auto/platform 会退化成 local，用户一旦在总览页改动就会
 * 把「自动」「平台」静默改写成「本地」。
 */
export type QuickGenerationRoute = 'auto' | 'local' | 'cloud' | 'platform';

const QUICK_GENERATION_ROUTES: readonly QuickGenerationRoute[] = ['auto', 'local', 'cloud', 'platform'];

export const isQuickGenerationRoute = (value: unknown): value is QuickGenerationRoute =>
  typeof value === 'string' && (QUICK_GENERATION_ROUTES as readonly string[]).includes(value);

type AppearancePreset = AppearanceMotionPreferences & {
  canvasMode: 'auto' | 'quality' | 'smooth';
};

export const APPEARANCE_PERFORMANCE_PRESETS: Record<WebPerformanceMode, AppearancePreset> = {
  fast: {
    performanceMode: 'fast',
    glassOpacity: 0.94,
    glassBlur: 0,
    motionScale: 0.35,
    solidFallback: true,
    canvasMode: 'smooth',
  },
  balanced: {
    performanceMode: 'balanced',
    glassOpacity: 0.76,
    glassBlur: 20,
    motionScale: 1,
    solidFallback: false,
    canvasMode: 'auto',
  },
  visual: {
    performanceMode: 'visual',
    glassOpacity: 0.68,
    glassBlur: 32,
    motionScale: 1.2,
    solidFallback: false,
    canvasMode: 'quality',
  },
};

const dispatchPreferenceChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SETTINGS_QUICK_PREFERENCES_EVENT));
};

export const readQuickGenerationRoute = (): QuickGenerationRoute => {
  if (typeof window === 'undefined') return 'auto';
  const stored = window.localStorage.getItem(GENERATION_ROUTE_STORAGE_KEY);
  // 与 ProviderRouteEngine 的回退一致：无效值一律视为 auto，而不是 local。
  return isQuickGenerationRoute(stored) ? stored : 'auto';
};

export const setQuickGenerationRoute = (route: QuickGenerationRoute) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GENERATION_ROUTE_STORAGE_KEY, route);
  dispatchPreferenceChange();
};

export const readCanvasPerformanceMode = () => {
  if (typeof window === 'undefined') return 'auto';
  return window.localStorage.getItem(CANVAS_PERFORMANCE_STORAGE_KEY) || 'auto';
};

export const applyPerformancePreset = (
  mode: WebPerformanceMode,
  setPreferences: (patch: Partial<AppearanceMotionPreferences>) => void,
) => {
  const preset = APPEARANCE_PERFORMANCE_PRESETS[mode];
  const { canvasMode, ...appearancePreferences } = preset;
  setPreferences(appearancePreferences);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CANVAS_PERFORMANCE_STORAGE_KEY, canvasMode);
    dispatchPreferenceChange();
  }
};

export const isPerformancePresetActive = (
  preferences: AppearanceMotionPreferences,
  mode: WebPerformanceMode,
  canvasMode = readCanvasPerformanceMode(),
) => {
  const preset = APPEARANCE_PERFORMANCE_PRESETS[mode];
  return preferences.performanceMode === preset.performanceMode
    && preferences.glassOpacity === preset.glassOpacity
    && preferences.glassBlur === preset.glassBlur
    && preferences.motionScale === preset.motionScale
    && preferences.solidFallback === preset.solidFallback
    && canvasMode === preset.canvasMode;
};

export const getActivePerformancePreset = (
  preferences: AppearanceMotionPreferences,
  canvasMode = readCanvasPerformanceMode(),
): WebPerformanceMode | 'manual' => {
  const activeMode = (Object.keys(APPEARANCE_PERFORMANCE_PRESETS) as WebPerformanceMode[])
    .find((mode) => isPerformancePresetActive(preferences, mode, canvasMode));
  return activeMode || 'manual';
};
