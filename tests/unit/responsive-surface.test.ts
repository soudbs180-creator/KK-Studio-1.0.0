import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getAdaptiveResultColumnCount,
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
});
