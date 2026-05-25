import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('theme bootstrapping defaults to system preference and applies before app mount', () => {
  const themeSource = readSource('src/context/ThemeContext.tsx');
  const mainSource = readSource('src/main.tsx');

  assert.match(themeSource, /const DEFAULT_THEME: Theme = 'system';/);
  assert.match(themeSource, /if \(typeof window === 'undefined'\) return 'light';/);
  assert.match(themeSource, /if \(typeof window === 'undefined'\) return DEFAULT_THEME;/);
  assert.match(themeSource, /const resolveThemeMode = \(theme: Theme\): ResolvedTheme => \(/);
  assert.match(themeSource, /const applyResolvedThemeToDocument = \(mode: ResolvedTheme\) => \{/);
  assert.match(themeSource, /export const initializeThemeOnBoot = \(\) => \{/);
  assert.match(themeSource, /applyResolvedThemeToDocument\(resolveThemeMode\(initialTheme\)\);/);
  assert.match(mainSource, /import \{ initializeThemeOnBoot \} from '\.\/context\/ThemeContext';/);
  assert.match(mainSource, /initializeThemeOnBoot\(\);/);
});

test('theme provider does not add programmatic transition classes that can flicker the UI', () => {
  const themeSource = readSource('src/context/ThemeContext.tsx');

  assert.doesNotMatch(themeSource, /theme-transitioning/);
  assert.doesNotMatch(themeSource, /startThemeTransition/);
  assert.doesNotMatch(themeSource, /setTimeout\(clearThemeTransition/);
});

test('theme-aware shells use resolved theme when preference is set to system', () => {
  const sidebarSource = readSource('src/components/layout/Sidebar.tsx');
  const projectManagerSource = readSource('src/components/settings/ProjectManager.tsx');
  const notificationToastSource = readSource('src/components/common/NotificationToast.tsx');
  const loginScreenSource = readSource('src/components/auth/LoginScreen.tsx');
  const loginScreenStylesSource = readSource('src/components/auth/LoginScreen.css');

  assert.match(sidebarSource, /const \{ theme, resolvedTheme, toggleTheme, setTheme \} = useTheme\(\);/);
  assert.match(sidebarSource, /const isDarkMode = resolvedTheme === 'dark';/);
  assert.match(sidebarSource, /const isLightMode = resolvedTheme === 'light';/);
  assert.match(sidebarSource, /data-theme-surface=\{isLightMode \? 'light-frosted' : 'dark-frosted'\}/);
  assert.match(sidebarSource, /background:\s*'var\(--frost-card-framework-bg\)'/);
  assert.match(sidebarSource, /border:\s*'1px solid var\(--frost-card-framework-border\)'/);
  assert.match(sidebarSource, /boxShadow:\s*'var\(--frost-card-framework-shadow\)'/);
  assert.match(sidebarSource, /backdropFilter:\s*'blur\(var\(--frost-card-framework-blur\)\) saturate\(1\.16\)'/);
  assert.doesNotMatch(sidebarSource, /0 8px 32px|var\(--shadow-xl\)|from-indigo|to-purple/);
  assert.match(sidebarSource, /title=\{isDarkMode \? '切换到亮色模式' : '切换到暗色模式'\}/);
  assert.match(sidebarSource, /\{isDarkMode \? \(/);

  assert.match(projectManagerSource, /const \{ resolvedTheme, toggleTheme \} = useTheme\(\);/);
  assert.match(projectManagerSource, /const isDarkMode = resolvedTheme === 'dark';/);
  assert.match(projectManagerSource, /frostedProjectManagerShellStyle/);
  assert.match(projectManagerSource, /frostedProjectManagerSubSurfaceStyle/);
  assert.match(projectManagerSource, /var\(--frost-card-framework-bg\)/);
  assert.match(projectManagerSource, /var\(--frost-card-framework-border\)/);
  assert.match(projectManagerSource, /var\(--frost-card-framework-shadow\)/);
  assert.match(projectManagerSource, /title=\{isDarkMode \? '切换到浅色模式' : '切换到深色模式'\}/);
  assert.match(projectManagerSource, /\{isDarkMode \? <Moon size=\{20\} \/> : <Sun size=\{20\} \/>}/);
  assert.doesNotMatch(projectManagerSource, /accent-indigo|text-sky|bg-indigo|#27272a|shadow-2xl/);

  assert.doesNotMatch(notificationToastSource, /import \{ useTheme \} from '\.\.\/\.\.\/context\/ThemeContext';/);
  assert.doesNotMatch(notificationToastSource, /const \{ isDarkMode \} = useTheme\(\);/);
  assert.match(notificationToastSource, /boxShadow: 'var\(--frost-card-framework-shadow\)'/);
  assert.match(notificationToastSource, /background: 'var\(--frost-card-sub-bg\)'/);
  assert.doesNotMatch(notificationToastSource, /MutationObserver/);
  assert.doesNotMatch(notificationToastSource, /document\.body\.classList\.contains\('dark-mode'\)/);

  assert.match(loginScreenSource, /import \{ useTheme \} from '\.\.\/\.\.\/context\/ThemeContext';/);
  assert.match(loginScreenSource, /const \{ resolvedTheme \} = useTheme\(\);/);
  assert.match(loginScreenSource, /const authThemeClass = `auth-screen-active--\$\{resolvedTheme\}`;/);
  assert.match(loginScreenSource, /root\.style\.colorScheme = resolvedTheme;/);
  assert.match(loginScreenSource, /<div className=\{`auth-page auth-page--\$\{resolvedTheme\}`\}>/);

  assert.match(loginScreenStylesSource, /\.auth-screen-active\.auth-screen-active--light,/);
  assert.match(loginScreenStylesSource, /\.auth-page--light \{/);
  assert.match(loginScreenStylesSource, /\.auth-page--light \.auth-panel \{/);
  assert.match(loginScreenStylesSource, /\.auth-page--light \.auth-input-wrap \{/);
  assert.match(loginScreenStylesSource, /\.auth-page--light \.auth-version-badge \{/);
});
