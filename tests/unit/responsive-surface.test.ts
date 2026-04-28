import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getAdaptiveResultColumnCount,
  getAdaptiveResultTileGridMetrics,
  isCompactResponsiveSurface,
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
