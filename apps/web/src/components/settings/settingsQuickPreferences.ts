import type {
  AppearanceMotionPreferences,
  WebPerformanceMode,
} from '../../context/AppearanceMotionContext';

export const GENERATION_ROUTE_STORAGE_KEY = 'kk_studio_preferred_generation_mode';
export const CANVAS_PERFORMANCE_STORAGE_KEY = 'kk_studio_canvas_perf_mode';
export const SETTINGS_QUICK_PREFERENCES_EVENT = 'kk-settings-quick-preferences-change';

export type QuickGenerationRoute = 'local' | 'cloud';

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
  if (typeof window === 'undefined') return 'local';
  return window.localStorage.getItem(GENERATION_ROUTE_STORAGE_KEY) === 'cloud' ? 'cloud' : 'local';
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
