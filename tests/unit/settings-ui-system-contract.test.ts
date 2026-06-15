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

test('settings visual alignment layer unifies hero, cards, controls, and motion', () => {
  const settingsStylesSource = readSource('apps/web/src/styles/settings.css');

  assert.match(settingsStylesSource, /Settings Visual Alignment Layer/);
  assert.match(settingsStylesSource, /--settings-visual-hero-bg:\s*color-mix\(in srgb, var\(--settings-surface-elevated\) 88%, var\(--settings-page-bg\) 12%\);/);
  assert.match(settingsStylesSource, /--settings-visual-shell-bg:\s*color-mix\(in srgb, var\(--settings-shell-bg\) 82%, var\(--settings-surface-elevated\) 18%\);/);
  assert.match(settingsStylesSource, /--settings-visual-sidebar-bg:\s*color-mix\(in srgb, var\(--settings-surface-elevated\) 76%, var\(--settings-page-bg\) 24%\);/);
  assert.match(settingsStylesSource, /--settings-visual-card-bg:\s*color-mix\(in srgb, var\(--settings-surface-elevated\) 94%, var\(--settings-page-bg\) 6%\);/);
  assert.match(settingsStylesSource, /--settings-visual-control-menu-bg:\s*color-mix\(in srgb, var\(--settings-surface-elevated\) 92%, transparent\);/);

  assert.match(settingsStylesSource, /\.settings-panel :where\(\.settings-shell-desktop, \.settings-shell-mobile\) \{[\s\S]*background:\s*var\(--settings-visual-shell-bg\) !important;[\s\S]*box-shadow:\s*var\(--settings-visual-shell-shadow\) !important;/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-shell-nav \{[\s\S]*background:\s*var\(--settings-visual-sidebar-bg\) !important;[\s\S]*border-right:\s*1px solid var\(--settings-visual-border\) !important;/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-shell-main__topbar,\n\.settings-panel \.settings-shell-mobile__topbar \{[\s\S]*min-height:\s*64px;[\s\S]*background:\s*var\(--settings-visual-topbar-bg\) !important;/);
  assert.match(settingsStylesSource, /\.settings-panel \.sidebar-card-list > :not\(\[hidden\]\) ~ :not\(\[hidden\]\),\n\.settings-panel \.settings-shell-nav__group-list > :not\(\[hidden\]\) ~ :not\(\[hidden\]\) \{[\s\S]*margin-top:\s*0 !important;/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-sidebar-card \{[\s\S]*height:\s*74px !important;[\s\S]*background:\s*var\(--settings-visual-sidebar-card-bg\) !important;/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-sidebar-card\.active \{[\s\S]*background:\s*var\(--settings-visual-sidebar-active-bg\) !important;[\s\S]*box-shadow:\s*0 10px 26px rgb\(var\(--settings-accent-rgb\) \/ 0\.12\)/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-hero-flat-header \{[\s\S]*background:\s*var\(--settings-visual-hero-bg\);[\s\S]*border:\s*1px solid var\(--settings-visual-border\);[\s\S]*box-shadow:\s*var\(--settings-visual-hero-shadow\);/);
  assert.match(settingsStylesSource, /\.settings-panel :where\(\.settings-reference-card, \.settings-section-card, \.settings-system-card, \.settings-provider-card\) \{[\s\S]*background:\s*var\(--settings-visual-card-bg\) !important;[\s\S]*border:\s*1px solid var\(--settings-visual-border\) !important;/);
  assert.match(settingsStylesSource, /\.settings-panel :where\(\.settings-reference-card, \.settings-section-card, \.settings-system-card, \.settings-provider-card\):hover \{[\s\S]*transform:\s*translateY\(-1px\);/);
  assert.match(settingsStylesSource, /\.settings-panel :where\(input:not\(\[type="color"\]\):not\(\[type="checkbox"\]\), textarea, select, \.settings-system-control-menu-trigger\) \{[\s\S]*min-height:\s*var\(--kk-control-height-mobile\);/);
  assert.match(settingsStylesSource, /\.settings-panel :where\(\.settings-system-control-menu, \.settings-system-modal-panel\) \{[\s\S]*box-shadow:\s*var\(--settings-visual-floating-shadow\);/);
  assert.match(settingsStylesSource, /@media \(max-width:\s*640px\) \{[\s\S]*\.settings-panel \.settings-shell-page--mobile \{[\s\S]*padding:\s*76px 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ 18px\) !important;/);
  assert.match(settingsStylesSource, /@media \(prefers-reduced-motion:\s*reduce\) \{[\s\S]*\.settings-panel :where\(\.settings-reference-card, \.settings-section-card, \.settings-system-card, \.settings-provider-card, \.settings-sidebar-card, \.settings-system-control-menu, \.settings-system-control-menu-option\) \{[\s\S]*transition:\s*none !important;/);
});

test('shared settings select dropdown consumes control-menu primitive and layer token', () => {
  const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');
  const uiSource = readSource('apps/web/src/components/settings/ui/index.tsx');
  const settingsStylesSource = readSource('apps/web/src/styles/settings.css');

  assert.match(scaffoldSource, /SETTINGS_CONTROL_MENU_CLASSNAME/);
  assert.match(scaffoldSource, /SETTINGS_CONTROL_MENU_OPTION_CLASSNAME/);

  assert.match(uiSource, /import \{ KK_LAYER \} from '@kk\/ui';/);
  assert.match(uiSource, /SETTINGS_CONTROL_MENU_CLASSNAME/);
  assert.match(uiSource, /SETTINGS_CONTROL_MENU_OPTION_CLASSNAME/);
  assert.match(uiSource, /style=\{\{\s*zIndex:\s*KK_LAYER\.dropdown\s*\}\}/);
  assert.match(uiSource, /data-state=\{option\.value === value \? 'selected' : 'idle'\}/);

  assert.match(settingsStylesSource, /\.settings-panel \.settings-system-control-menu/);
  assert.match(settingsStylesSource, /box-shadow:\s*var\(--settings-card-shadow\)/);
  assert.match(settingsStylesSource, /backdrop-filter:\s*blur\(var\(--kk-ui-glass-blur\)\) saturate\(1\.18\)/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-system-control-menu-option\[data-state='selected'\]/);

  assert.doesNotMatch(uiSource, /z-\[100\]/);
  assert.doesNotMatch(uiSource, /shadow-lg/);
  assert.doesNotMatch(uiSource, /backdrop-blur-md/);
});
