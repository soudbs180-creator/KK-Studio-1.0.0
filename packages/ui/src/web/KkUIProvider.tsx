import React, { type PropsWithChildren, useMemo } from 'react';
import {
  LobeUIProvider,
  ThemeProvider as LobeThemeProvider,
} from '@lobehub/ui';

export interface KkUIProviderProps extends PropsWithChildren {
  locale?: 'zh-CN' | 'en-US';
  appearance?: 'light' | 'dark';
}

export function KkUIProvider({
  children,
  appearance = 'dark',
}: KkUIProviderProps) {
  const theme = useMemo(() => {
    const isDark = appearance === 'dark';
    return {
      appearance,
      token: {
        colorPrimary: '#6366f1',
        colorBgLayout: isDark ? '#050608' : '#f8fafc',
        colorBgContainer: isDark ? '#121216' : '#ffffff',
        colorText: isDark ? 'rgba(255, 255, 255, 0.96)' : '#0f172a',
        colorTextSecondary: isDark ? 'rgba(226, 232, 240, 0.74)' : '#475569',
        borderRadius: 16,
        wireframe: false,
      },
    };
  }, [appearance]);

  return (
    <LobeThemeProvider theme={theme as any}>
      <LobeUIProvider motion={false as any}>
        {children}
      </LobeUIProvider>
    </LobeThemeProvider>
  );
}
