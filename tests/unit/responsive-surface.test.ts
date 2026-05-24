import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import {
  getAdaptiveResultColumnCount,
  getAdaptiveResultTileGridMetrics,
  isCompactResponsiveWidth,
  isCompactResponsiveSurface,
  isPhoneResponsiveWidth,
  resolveResponsiveSurface,
} from '../../src/utils/responsiveSurface.ts';

describe('responsive surface utilities', () => {
  test('classifies phone, tablet, and desktop at the planned breakpoints', () => {
    assert.equal(resolveResponsiveSurface(320), 'phone');
    assert.equal(resolveResponsiveSurface(768), 'phone');
    assert.equal(resolveResponsiveSurface(769), 'tablet');
    assert.equal(resolveResponsiveSurface(1023), 'tablet');
    assert.equal(resolveResponsiveSurface(1024), 'desktop');
    assert.equal(resolveResponsiveSurface(1440), 'desktop');
  });

  test('treats phone and tablet as compact result surfaces', () => {
    assert.equal(isCompactResponsiveSurface('phone'), true);
    assert.equal(isCompactResponsiveSurface('tablet'), true);
    assert.equal(isCompactResponsiveSurface('desktop'), false);
  });

  test('exposes width helpers backed by the shared breakpoint classifier', () => {
    assert.equal(isPhoneResponsiveWidth(768), true);
    assert.equal(isPhoneResponsiveWidth(769), false);
    assert.equal(isCompactResponsiveWidth(1023), true);
    assert.equal(isCompactResponsiveWidth(1024), false);
  });

  test('layout overlays reuse shared width helpers instead of hard-coded viewport checks', () => {
    const phoneSurfaceFiles = [
      'src/components/layout/Sidebar.tsx',
      'src/components/layout/SearchPalette.tsx',
      'src/components/modals/TagInputModal.tsx',
      'src/components/modals/StorageSelectionModal.tsx',
      'src/components/modals/MigrateModal.tsx',
      'src/components/image/PptDeckEditorModal.tsx',
      'src/components/image/GlobalLightbox.tsx',
      'src/components/common/TutorialOverlay.tsx',
      'src/utils/canvasCenter.ts',
      'src/context/CanvasContext.tsx',
    ];
    const compactSurfaceFiles = [
      'src/components/settings/SettingsPanel.localized.tsx',
    ];

    for (const file of phoneSurfaceFiles) {
      const source = readFileSync(file, 'utf8');
      assert.match(source, /isPhoneResponsiveWidth\(window\.innerWidth\)/, `${file} should use phone surface helper`);
      assert.doesNotMatch(source, /window\.innerWidth\s*(?:<|<=)\s*768/, `${file} should not hard-code the phone breakpoint`);
    }

    for (const file of compactSurfaceFiles) {
      const source = readFileSync(file, 'utf8');
      assert.match(source, /isCompactResponsiveWidth\(window\.innerWidth\)/, `${file} should use compact surface helper`);
      assert.doesNotMatch(source, /window\.innerWidth\s*(?:<|<=)\s*1024/, `${file} should not hard-code the compact breakpoint`);
    }
  });

  test('tutorial overlay keeps separate mobile and desktop onboarding flows', () => {
    const source = readFileSync('src/components/common/TutorialOverlay.tsx', 'utf8');

    assert.match(source, /const DESKTOP_TUTORIAL_STEPS:\s*TutorialStep\[\]\s*=/);
    assert.match(source, /const MOBILE_TUTORIAL_STEPS:\s*TutorialStep\[\]\s*=/);
    assert.match(source, /const getTutorialSteps = \(surface: TutorialSurface\)/);
    assert.match(source, /const tutorialSurface: TutorialSurface = isMobile \? 'mobile' : 'desktop'/);
    assert.match(source, /setCurrentStepIndex\(\(current\) => Math\.min\(current, STEPS\.length - 1\)\)/);

    assert.doesNotMatch(source, /targetId:\s*isMobile\s*\?/);
    assert.doesNotMatch(source, /position:\s*isMobile\s*\?/);

    const mobileSteps = source.slice(
      source.indexOf('const MOBILE_TUTORIAL_STEPS'),
      source.indexOf('const getTutorialSteps'),
    );
    const desktopSteps = source.slice(
      source.indexOf('const DESKTOP_TUTORIAL_STEPS'),
      source.indexOf('const MOBILE_TUTORIAL_STEPS'),
    );

    assert.match(mobileSteps, /mobile-tab-bar/);
    assert.match(mobileSteps, /mobile-prompt-sheet|移动端|底部/);
    assert.doesNotMatch(mobileSteps, /project-manager-container/);
    assert.match(desktopSteps, /project-manager-container/);
    assert.doesNotMatch(desktopSteps, /mobile-tab-bar/);
  });

  test('Clay settings shell keeps separate mobile and desktop surface tokens', () => {
    const cssSource = readFileSync('src/index.css', 'utf8');
    const settingsSource = readFileSync('src/components/settings/SettingsPanel.localized.tsx', 'utf8');

    assert.match(settingsSource, /settings-shell-page--desktop/);
    assert.match(settingsSource, /settings-shell-page--mobile/);
    assert.match(cssSource, /--clay-desktop-shell-padding:\s*16px 28px 18px;/);
    assert.match(cssSource, /--clay-mobile-shell-padding:\s*12px 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ 14px\);/);
    assert.match(cssSource, /\.settings-panel \.settings-shell-page--desktop[\s\S]*padding:\s*var\(--clay-desktop-shell-padding\);/);
    assert.match(cssSource, /\.settings-panel \.settings-shell-page--mobile[\s\S]*padding:\s*var\(--clay-mobile-shell-padding\);/);
  });

  test('Clay search palette keeps distinct mobile sheet and desktop command surface', () => {
    const source = readFileSync('src/components/layout/SearchPalette.tsx', 'utf8');

    assert.match(source, /const DESKTOP_SEARCH_SHORTCUTS/);
    assert.match(source, /const MOBILE_SEARCH_HINTS/);
    assert.match(source, /isPhoneResponsiveWidth\(window\.innerWidth\)/);
    assert.match(source, /data-search-surface=\{isMobile \? 'mobile' : 'desktop'\}/);
    assert.match(source, /data-search-panel=\{isMobile \? 'mobile-bottom-sheet' : 'desktop-command-surface'\}/);
    assert.match(source, /var\(--search-palette-desktop-radius\)/);
    assert.match(source, /var\(--search-palette-mobile-radius\)/);
    assert.match(source, /isMobile \? \(\s*<>\s*\{MOBILE_SEARCH_HINTS\.map/);
    assert.match(source, /\) : \(\s*<>\s*\{DESKTOP_SEARCH_SHORTCUTS\.map/);
    assert.match(source, /if \(!isOpen \|\| isMobile\) return;/);
    assert.doesNotMatch(source, /rounded-t-\[var\(--radius-panel-xl\)\]/);
    assert.doesNotMatch(source, /borderRadius:\s*isMobile \? undefined : 'var\(--radius-surface-lg\)'/);
  });

  test('caps standard result columns by compact surface while detail mode is single column', () => {
    assert.equal(getAdaptiveResultColumnCount({ surface: 'phone', width: 320, viewMode: 'standard' }), 12);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'phone', width: 520, viewMode: 'standard' }), 12);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'phone', width: 768, viewMode: 'standard' }), 12);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'tablet', width: 900, viewMode: 'standard' }), 12);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'tablet', width: 1024, viewMode: 'standard' }), 12);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'phone', width: 768, viewMode: 'detail' }), 1);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'tablet', width: 1024, viewMode: 'detail' }), 1);
  });

  test('computes ratio-aware masonry spans without exceeding compact column caps', () => {
    const phoneColumns = getAdaptiveResultColumnCount({ surface: 'phone', width: 768, viewMode: 'standard' });
    const widePhoneTile = getAdaptiveResultTileGridMetrics({
      surface: 'phone',
      width: 768,
      viewMode: 'standard',
      columnCount: phoneColumns,
      aspectRatio: 2,
      aspectCategory: 'wide',
    });
    const portraitPhoneTile = getAdaptiveResultTileGridMetrics({
      surface: 'phone',
      width: 390,
      viewMode: 'standard',
      columnCount: getAdaptiveResultColumnCount({ surface: 'phone', width: 390, viewMode: 'standard' }),
      aspectRatio: 0.75,
      aspectCategory: 'portrait',
    });
    const squarePhoneTile = getAdaptiveResultTileGridMetrics({
      surface: 'phone',
      width: 390,
      viewMode: 'standard',
      columnCount: getAdaptiveResultColumnCount({ surface: 'phone', width: 390, viewMode: 'standard' }),
      aspectRatio: 1,
      aspectCategory: 'square',
    });
    const tabletWideTile = getAdaptiveResultTileGridMetrics({
      surface: 'tablet',
      width: 1024,
      viewMode: 'standard',
      columnCount: getAdaptiveResultColumnCount({ surface: 'tablet', width: 1024, viewMode: 'standard' }),
      aspectRatio: 2,
      aspectCategory: 'wide',
    });
    const detailTile = getAdaptiveResultTileGridMetrics({
      surface: 'tablet',
      width: 1024,
      viewMode: 'detail',
      columnCount: 1,
      aspectRatio: 1.5,
      aspectCategory: 'landscape',
    });

    assert.equal(phoneColumns, 12);
    assert.equal(widePhoneTile.columnSpan, 12);
    assert.equal(tabletWideTile.columnSpan, 12);
    assert.equal(detailTile.columnSpan, 1);
    assert.ok(portraitPhoneTile.rowSpan > squarePhoneTile.rowSpan);
  });
});
