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
    assert.equal(resolveResponsiveSurface(1024), 'tablet');
    assert.equal(resolveResponsiveSurface(1025), 'desktop');
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
    assert.equal(isCompactResponsiveWidth(1024), true);
    assert.equal(isCompactResponsiveWidth(1025), false);
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

  test('caps standard result columns by compact surface while detail mode is single column', () => {
    assert.equal(getAdaptiveResultColumnCount({ surface: 'phone', width: 320, viewMode: 'standard' }), 2);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'phone', width: 520, viewMode: 'standard' }), 3);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'phone', width: 768, viewMode: 'standard' }), 4);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'tablet', width: 900, viewMode: 'standard' }), 4);
    assert.equal(getAdaptiveResultColumnCount({ surface: 'tablet', width: 1024, viewMode: 'standard' }), 5);
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

    assert.equal(phoneColumns, 4);
    assert.equal(widePhoneTile.columnSpan, 2);
    assert.equal(tabletWideTile.columnSpan, 2);
    assert.equal(detailTile.columnSpan, 1);
    assert.ok(portraitPhoneTile.rowSpan > squarePhoneTile.rowSpan);
  });
});
