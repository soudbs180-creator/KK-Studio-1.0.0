import React, { type PropsWithChildren, useEffect } from 'react';

export interface KkUIProviderProps extends PropsWithChildren {
  locale?: 'zh-CN' | 'en-US';
  appearance?: 'light' | 'dark';
}

const THEME_VARIABLES: Record<NonNullable<KkUIProviderProps['appearance']>, Record<string, string>> = {
  light: {
    '--kk-ui-color-primary': 'var(--kk-morphic-action)',
    '--kk-ui-bg-layout': 'var(--kk-morphic-page)',
    '--kk-ui-bg-container': 'var(--kk-morphic-panel)',
    '--kk-ui-text-primary': 'var(--kk-morphic-text-primary)',
    '--kk-ui-text-secondary': 'var(--kk-morphic-text-secondary)',
    '--kk-ui-border-radius': 'var(--kk-morphic-radius-panel)',
  },
  dark: {
    '--kk-ui-color-primary': 'var(--kk-morphic-action)',
    '--kk-ui-bg-layout': 'var(--kk-morphic-page)',
    '--kk-ui-bg-container': 'var(--kk-morphic-panel)',
    '--kk-ui-text-primary': 'var(--kk-morphic-text-primary)',
    '--kk-ui-text-secondary': 'var(--kk-morphic-text-secondary)',
    '--kk-ui-border-radius': 'var(--kk-morphic-radius-panel)',
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
    root.setAttribute('data-kk-ui-appearance', 'dark');
    root.setAttribute('data-kk-ui-preference', appearance);

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
      root.removeAttribute('data-kk-ui-preference');
      for (const name of Object.keys(variables)) {
        root.style.removeProperty(name);
      }
    };
  }, [appearance]);

  return <>{children}</>;
}
