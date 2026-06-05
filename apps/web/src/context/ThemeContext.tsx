import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';
const DEFAULT_THEME: Theme = 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    isDarkMode: boolean;
    isLightMode: boolean;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_TRANSITION_CLASS = 'theme-transitioning';
const THEME_TRANSITION_MS = 260;
let themeTransitionTimer: number | undefined;

const getSystemTheme = (): ResolvedTheme => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredTheme = (): Theme => {
    if (typeof window === 'undefined') return DEFAULT_THEME;

    const stored = localStorage.getItem('theme') || localStorage.getItem('kk_theme');
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    return DEFAULT_THEME;
};

const resolveThemeMode = (theme: Theme): ResolvedTheme => (
    theme === 'system' ? getSystemTheme() : theme
);

const getAppliedDocumentTheme = (): ResolvedTheme | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    const appliedTheme = document.documentElement.dataset.theme || document.body.dataset.theme;
    return appliedTheme === 'dark' || appliedTheme === 'light' ? appliedTheme : null;
};

const applyResolvedThemeToDocument = (mode: ResolvedTheme, animate = false) => {
    if (typeof document === 'undefined') {
        return;
    }

    const body = document.body;
    const root = document.documentElement;

    if (animate) {
        body.classList.add(THEME_TRANSITION_CLASS);
        root.classList.add(THEME_TRANSITION_CLASS);
        body.dataset.themeTransition = 'active';
        root.dataset.themeTransition = 'active';

        if (themeTransitionTimer !== undefined) {
            window.clearTimeout(themeTransitionTimer);
        }

        themeTransitionTimer = window.setTimeout(() => {
            body.classList.remove(THEME_TRANSITION_CLASS);
            root.classList.remove(THEME_TRANSITION_CLASS);
            delete body.dataset.themeTransition;
            delete root.dataset.themeTransition;
            themeTransitionTimer = undefined;
        }, THEME_TRANSITION_MS);
    }

    body.classList.toggle('dark-mode', mode === 'dark');
    body.classList.toggle('light-mode', mode === 'light');
    root.classList.toggle('dark', mode === 'dark');
    root.classList.toggle('light', mode === 'light');
    root.classList.toggle('dark-mode', mode === 'dark');
    root.classList.toggle('light-mode', mode === 'light');
    body.dataset.theme = mode;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
};

export const initializeThemeOnBoot = () => {
    const initialTheme = getStoredTheme();
    applyResolvedThemeToDocument(resolveThemeMode(initialTheme));
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(getStoredTheme);
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveThemeMode(getStoredTheme()));

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');

        const applyMode = (mode: ResolvedTheme) => {
            const appliedTheme = getAppliedDocumentTheme();
            applyResolvedThemeToDocument(mode, appliedTheme !== null && appliedTheme !== mode);
            setResolvedTheme((currentMode) => (currentMode === mode ? currentMode : mode));
        };

        if (theme === 'system') {
            applyMode(resolveThemeMode(theme));
            localStorage.removeItem('theme');
            localStorage.removeItem('kk_theme');

            const handleChange = () => {
                applyMode(resolveThemeMode('system'));
            };

            media.addEventListener('change', handleChange);

            return () => {
                media.removeEventListener('change', handleChange);
            };
        }

        applyMode(theme);
        localStorage.setItem('theme', theme);
        localStorage.setItem('kk_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setThemeState((previousTheme) => {
            if (previousTheme === 'dark') return 'light';
            if (previousTheme === 'light') return 'dark';
            return resolvedTheme === 'dark' ? 'light' : 'dark';
        });
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider
            value={{
                theme,
                resolvedTheme,
                isDarkMode: resolvedTheme === 'dark',
                isLightMode: resolvedTheme === 'light',
                toggleTheme,
                setTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
