import React, { type PropsWithChildren, useEffect } from 'react';

export interface KkUIProviderProps extends PropsWithChildren {
  locale?: 'zh-CN' | 'en-US';
  appearance?: 'light' | 'dark';
}

const THEME_VARIABLES: Record<NonNullable<KkUIProviderProps['appearance']>, Record<string, string>> = {
  light: {
    '--kk-ui-color-primary': '#6366f1',
    '--kk-ui-bg-layout': '#f8fafc',
    '--kk-ui-bg-container': '#ffffff',
    '--kk-ui-text-primary': '#0f172a',
    '--kk-ui-text-secondary': '#475569',
    '--kk-ui-border-radius': '16px',
  },
  dark: {
    '--kk-ui-color-primary': '#6366f1',
    '--kk-ui-bg-layout': '#050608',
    '--kk-ui-bg-container': '#121216',
    '--kk-ui-text-primary': 'rgba(255, 255, 255, 0.96)',
    '--kk-ui-text-secondary': 'rgba(226, 232, 240, 0.74)',
    '--kk-ui-border-radius': '16px',
  },
};

export function KkUIProvider({
  children,
  appearance = 'dark',
}: KkUIProviderProps) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const previousAppearance = root.getAttribute('data-kk-ui-appearance');
    root.setAttribute('data-kk-ui-appearance', appearance);

    const variables = THEME_VARIABLES[appearance];
    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value);
    }

    return () => {
      if (previousAppearance) {
        root.setAttribute('data-kk-ui-appearance', previousAppearance);
      } else {
        root.removeAttribute('data-kk-ui-appearance');
      }
      for (const name of Object.keys(variables)) {
        root.style.removeProperty(name);
      }
    };
  }, [appearance]);

  return <>{children}</>;
}
