import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

export const APPEARANCE_MOTION_STORAGE_KEY = 'kk_appearance_motion_preferences_v1';

export type WebPerformanceMode = 'fast' | 'balanced' | 'visual';

export interface AppearanceMotionPreferences {
  glassOpacity: number;
  glassBlur: number;
  motionScale: number;
  solidFallback: boolean;
  performanceMode: WebPerformanceMode;
}

interface AppearanceMotionContextValue {
  preferences: AppearanceMotionPreferences;
  systemReducedMotion: boolean;
  setPreferences: (patch: Partial<AppearanceMotionPreferences>) => void;
  resetPreferences: () => void;
}

export const DEFAULT_APPEARANCE_MOTION_PREFERENCES: AppearanceMotionPreferences = {
  glassOpacity: 0.76,
  glassBlur: 20,
  motionScale: 1,
  solidFallback: false,
  performanceMode: 'balanced',
};

const AppearanceMotionContext = createContext<AppearanceMotionContextValue | undefined>(undefined);

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
};

const normalizePerformanceMode = (value: unknown): WebPerformanceMode => (
  value === 'fast' || value === 'visual' ? value : 'balanced'
);

const normalizePreferences = (value: Partial<AppearanceMotionPreferences> = {}): AppearanceMotionPreferences => ({
  glassOpacity: clampNumber(
    value.glassOpacity,
    DEFAULT_APPEARANCE_MOTION_PREFERENCES.glassOpacity,
    0.58,
    0.94,
  ),
  glassBlur: clampNumber(
    value.glassBlur,
    DEFAULT_APPEARANCE_MOTION_PREFERENCES.glassBlur,
    0,
    32,
  ),
  motionScale: clampNumber(
    value.motionScale,
    DEFAULT_APPEARANCE_MOTION_PREFERENCES.motionScale,
    0.2,
    1.2,
  ),
  solidFallback: Boolean(value.solidFallback),
  performanceMode: normalizePerformanceMode(value.performanceMode),
});

const readStoredPreferences = (): AppearanceMotionPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_APPEARANCE_MOTION_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(APPEARANCE_MOTION_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_APPEARANCE_MOTION_PREFERENCES;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<AppearanceMotionPreferences>;
    return normalizePreferences({
      ...DEFAULT_APPEARANCE_MOTION_PREFERENCES,
      ...parsedValue,
    });
  } catch {
    return DEFAULT_APPEARANCE_MOTION_PREFERENCES;
  }
};

const getSystemReducedMotion = () => (
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
);

export const applyAppearanceMotionPreferences = (
  preferences: AppearanceMotionPreferences,
  options: { systemReducedMotion?: boolean } = {},
) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const reducedMotion = options.systemReducedMotion ?? getSystemReducedMotion();
  const fastMode = preferences.performanceMode === 'fast';
  const modeMotionScale = fastMode ? Math.min(preferences.motionScale, 0.55) : preferences.motionScale;
  const modeGlassOpacity = fastMode ? Math.max(preferences.glassOpacity, 0.84) : preferences.glassOpacity;
  const modeGlassBlur = fastMode ? Math.min(preferences.glassBlur, 8) : preferences.glassBlur;
  const effectiveMotionScale = reducedMotion ? 0 : modeMotionScale;
  const effectiveGlassOpacity = preferences.solidFallback ? 1 : modeGlassOpacity;
  const effectiveGlassBlur = preferences.solidFallback ? 0 : modeGlassBlur;

  root.style.setProperty('--kk-ui-glass-opacity', effectiveGlassOpacity.toFixed(2));
  root.style.setProperty('--kk-ui-glass-blur', `${effectiveGlassBlur.toFixed(0)}px`);
  root.style.setProperty('--kk-ui-motion-scale', effectiveMotionScale.toFixed(2));
  root.dataset.kkUiMotion = reducedMotion || effectiveMotionScale <= 0.25
    ? 'reduced'
    : effectiveMotionScale >= 1.1
      ? 'expressive'
      : 'standard';
  root.dataset.kkUiSolidFallback = String(preferences.solidFallback);
  root.dataset.kkWebPerformance = preferences.performanceMode;
};

export const AppearanceMotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferencesState] = useState<AppearanceMotionPreferences>(readStoredPreferences);
  const [systemReducedMotion, setSystemReducedMotion] = useState(getSystemReducedMotion);

  useLayoutEffect(() => {
    applyAppearanceMotionPreferences(preferences, { systemReducedMotion });

    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(APPEARANCE_MOTION_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // local UI preference persistence is optional
    }
  }, [preferences, systemReducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setSystemReducedMotion(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setPreferences = useCallback((patch: Partial<AppearanceMotionPreferences>) => {
    setPreferencesState((current) => normalizePreferences({
      ...current,
      ...patch,
    }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferencesState(DEFAULT_APPEARANCE_MOTION_PREFERENCES);
  }, []);

  const value = useMemo<AppearanceMotionContextValue>(() => ({
    preferences,
    systemReducedMotion,
    setPreferences,
    resetPreferences,
  }), [preferences, resetPreferences, setPreferences, systemReducedMotion]);

  return (
    <AppearanceMotionContext.Provider value={value}>
      {children}
    </AppearanceMotionContext.Provider>
  );
};

export const useAppearanceMotion = () => {
  const context = useContext(AppearanceMotionContext);
  if (!context) {
    throw new Error('useAppearanceMotion must be used within AppearanceMotionProvider');
  }
  return context;
};
