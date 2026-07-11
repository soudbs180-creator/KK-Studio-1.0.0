export type CanvasPerformanceModePreference = 'auto' | 'quality' | 'smooth' | 'ghost';

export interface CanvasPerformancePreferences {
  mode: CanvasPerformanceModePreference;
  viewportCulling: boolean;
  dragSuspend: boolean;
  zoomReduceMotion: boolean;
  connectorThrottle: boolean;
}

export const CANVAS_PERFORMANCE_PREFERENCE_KEYS = {
  mode: 'kk_studio_canvas_perf_mode',
  viewportCulling: 'kk_studio_perf_viewport_culling',
  dragSuspend: 'kk_studio_perf_drag_suspend',
  zoomReduceMotion: 'kk_studio_perf_zoom_reduce_motion',
  connectorThrottle: 'kk_studio_perf_connector_throttle',
} as const;

const CANVAS_PERFORMANCE_PREFERENCES_EVENT = 'kk:canvas-performance-preferences';
const DEFAULT_PREFERENCES: CanvasPerformancePreferences = {
  mode: 'auto',
  viewportCulling: true,
  dragSuspend: true,
  zoomReduceMotion: true,
  connectorThrottle: true,
};

let cachedSignature = '';
let cachedPreferences = DEFAULT_PREFERENCES;

const readBoolean = (key: string): boolean => localStorage.getItem(key) !== 'false';

export const getCanvasPerformancePreferences = (): CanvasPerformancePreferences => {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  const rawMode = localStorage.getItem(CANVAS_PERFORMANCE_PREFERENCE_KEYS.mode);
  const mode: CanvasPerformanceModePreference = rawMode === 'quality' || rawMode === 'smooth' || rawMode === 'ghost'
    ? rawMode
    : 'auto';
  const signature = [
    mode,
    localStorage.getItem(CANVAS_PERFORMANCE_PREFERENCE_KEYS.viewportCulling),
    localStorage.getItem(CANVAS_PERFORMANCE_PREFERENCE_KEYS.dragSuspend),
    localStorage.getItem(CANVAS_PERFORMANCE_PREFERENCE_KEYS.zoomReduceMotion),
    localStorage.getItem(CANVAS_PERFORMANCE_PREFERENCE_KEYS.connectorThrottle),
  ].join('|');
  if (signature === cachedSignature) return cachedPreferences;
  cachedSignature = signature;
  cachedPreferences = {
    mode,
    viewportCulling: readBoolean(CANVAS_PERFORMANCE_PREFERENCE_KEYS.viewportCulling),
    dragSuspend: readBoolean(CANVAS_PERFORMANCE_PREFERENCE_KEYS.dragSuspend),
    zoomReduceMotion: readBoolean(CANVAS_PERFORMANCE_PREFERENCE_KEYS.zoomReduceMotion),
    connectorThrottle: readBoolean(CANVAS_PERFORMANCE_PREFERENCE_KEYS.connectorThrottle),
  };
  return cachedPreferences;
};

export const subscribeCanvasPerformancePreferences = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key && Object.values(CANVAS_PERFORMANCE_PREFERENCE_KEYS).includes(event.key as any)) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CANVAS_PERFORMANCE_PREFERENCES_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CANVAS_PERFORMANCE_PREFERENCES_EVENT, listener);
  };
};

export const setCanvasPerformancePreference = <K extends keyof CanvasPerformancePreferences>(
  key: K,
  value: CanvasPerformancePreferences[K],
): void => {
  localStorage.setItem(CANVAS_PERFORMANCE_PREFERENCE_KEYS[key], String(value));
  cachedSignature = '';
  window.dispatchEvent(new Event(CANVAS_PERFORMANCE_PREFERENCES_EVENT));
};
