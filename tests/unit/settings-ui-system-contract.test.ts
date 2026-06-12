import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { readSource, workspacePath } from '../support/workspacePaths.js';

test('settings UI system exposes responsive tokens and shared scaffold primitives', () => {
  const tokenSource = readSource('packages/ui/src/core/tokens.ts');
  const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');
  const settingsStylesSource = readSource('apps/web/src/styles/settings.css');

  assert.match(tokenSource, /uiSystem:/);
  assert.match(tokenSource, /breakpoints:/);
  assert.match(tokenSource, /phoneSmall:\s*375/);
  assert.match(tokenSource, /tablet:\s*768/);
  assert.match(tokenSource, /desktop:\s*1024/);
  assert.match(tokenSource, /desktopLarge:\s*1440/);
  assert.match(tokenSource, /spacing:/);
  assert.match(tokenSource, /touchTargetMin:\s*"44px"/);
  assert.match(tokenSource, /motion:/);
  assert.match(tokenSource, /glass:/);

  assert.match(scaffoldSource, /SETTINGS_UI_SYSTEM/);
  assert.match(scaffoldSource, /SETTINGS_PAGE_CONTAINER_CLASSNAME/);
  assert.match(scaffoldSource, /SETTINGS_GLASS_SURFACE_CLASSNAME/);
  assert.match(scaffoldSource, /SETTINGS_RESPONSIVE_GRID_CLASSNAME/);
  assert.match(scaffoldSource, /SettingsSystemCard/);
  assert.match(scaffoldSource, /SettingsSystemField/);

  assert.match(settingsStylesSource, /\.settings-system-page/);
  assert.match(settingsStylesSource, /\.settings-system-card/);
  assert.match(settingsStylesSource, /\.settings-system-grid/);
  assert.match(settingsStylesSource, /min-height:\s*var\(--kk-touch-target-min\)/);
  assert.match(settingsStylesSource, /@media \(min-width:\s*768px\)/);
  assert.match(settingsStylesSource, /@media \(min-width:\s*1024px\)/);
  assert.match(settingsStylesSource, /prefers-reduced-motion:\s*reduce/);
});

test('appearance and motion settings are a canonical route with persistent document variables', () => {
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');
  const routeSource = readSource('apps/web/src/components/settings/settingsRouteConfig.tsx');
  const workspaceSurfaceSource = readSource('apps/web/src/hooks/useWorkspaceSurface.ts');
  const appSource = readSource('apps/web/src/App.tsx');
  const contextPath = workspacePath('apps/web/src/context/AppearanceMotionContext.tsx');

  assert.ok(existsSync(contextPath), 'AppearanceMotionContext.tsx must exist');

  const contextSource = readSource('apps/web/src/context/AppearanceMotionContext.tsx');
  assert.match(contextSource, /APPEARANCE_MOTION_STORAGE_KEY\s*=\s*'kk_appearance_motion_preferences_v1'/);
  assert.match(contextSource, /DEFAULT_APPEARANCE_MOTION_PREFERENCES/);
  assert.match(contextSource, /useAppearanceMotion/);
  assert.match(contextSource, /--kk-ui-glass-opacity/);
  assert.match(contextSource, /--kk-ui-glass-blur/);
  assert.match(contextSource, /--kk-ui-motion-scale/);

  assert.match(registrySource, /'appearance-motion'/);
  assert.match(registrySource, /titleZh:\s*'外观与动态'/);
  assert.match(registrySource, /labelZh:\s*'外观与动态'/);
  assert.match(routeSource, /AppearanceMotionView/);
  assert.match(routeSource, /kind:\s*'appearance-motion'/);
  assert.match(workspaceSurfaceSource, /'appearance-motion'/);
  assert.match(appSource, /AppearanceMotionProvider/);
});

test('appearance and motion view consumes only the shared settings system primitives', () => {
  const viewPath = workspacePath('apps/web/src/components/settings/views/AppearanceMotionView.tsx');
  assert.ok(existsSync(viewPath), 'AppearanceMotionView.tsx must exist');

  const viewSource = readSource('apps/web/src/components/settings/views/AppearanceMotionView.tsx');

  assert.match(viewSource, /SettingsHero/);
  assert.match(viewSource, /SettingsSystemCard/);
  assert.match(viewSource, /SettingsSystemField/);
  assert.match(viewSource, /SETTINGS_PAGE_CONTAINER_CLASSNAME/);
  assert.match(viewSource, /SETTINGS_RESPONSIVE_GRID_CLASSNAME/);
  assert.match(viewSource, /useAppearanceMotion/);
  assert.match(viewSource, /glassOpacity/);
  assert.match(viewSource, /motionScale/);
  assert.doesNotMatch(viewSource, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(viewSource, /rgba?\(/);
  assert.doesNotMatch(viewSource, /hsla?\(/);
});

test('mobile settings shell title stays out of heading landmarks', () => {
  const panelSource = readSource('apps/web/src/components/settings/SettingsPanel.localized.tsx');

  assert.match(panelSource, /<div className="settings-shell-mobile__title"/);
  assert.doesNotMatch(panelSource, /<h[1-6]\s+className="settings-shell-mobile__title"/);
});

test('mobile settings hero stacks copy and actions to avoid overlap', () => {
  const settingsStylesSource = readSource('apps/web/src/styles/settings.css');

  assert.match(
    settingsStylesSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-hero-flat-header \.settings-hero-card__header \{[\s\S]*display:\s*grid !important;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(
    settingsStylesSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-hero-flat-header \.settings-hero-card__actions \{[\s\S]*margin-top:\s*var\(--kk-space-3\);/,
  );
  assert.match(
    settingsStylesSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-hero-flat-header \.settings-hero-card__title-wrap \{[\s\S]*height:\s*auto !important;/,
  );
  assert.match(
    settingsStylesSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-hero-flat-header \.settings-hero-card__lead > \.settings-hero-card__title-wrap \{[\s\S]*width:\s*100% !important;/,
  );
  assert.match(readSource('apps/web/src/components/settings/SettingsScaffold.tsx'), /settings-hero-card__title-line/);
  assert.match(
    settingsStylesSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-hero-flat-header \.settings-hero-card__title-line \{[\s\S]*display:\s*grid !important;/,
  );
});
