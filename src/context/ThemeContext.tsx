import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';
const DEFAULT_THEME: Theme = 'dark';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    isDarkMode: boolean;
    isLightMode: boolean;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

const applyResolvedThemeToDocument = (mode: ResolvedTheme) => {
    if (typeof document === 'undefined') {
        return;
    }

    const body = document.body;
    const root = document.documentElement;

    body.classList.toggle('dark-mode', mode === 'dark');
    root.classList.toggle('dark', mode === 'dark');
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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');

        const applyMode = (mode: ResolvedTheme) => {
            setResolvedTheme((currentMode) => (currentMode === mode ? currentMode : mode));
            applyResolvedThemeToDocument(mode);
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
