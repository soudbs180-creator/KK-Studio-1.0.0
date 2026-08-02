import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizePerformanceMode } from '../../apps/web/src/context/performanceModes.ts';
import { APPEARANCE_PERFORMANCE_PRESETS } from '../../apps/web/src/components/settings/settingsQuickPreferences.ts';
import { readSource } from '../support/workspacePaths.js';

test('legacy performance values migrate deterministically to the five-mode contract', () => {
  assert.equal(normalizePerformanceMode('fast'), 'smooth');
  assert.equal(normalizePerformanceMode('balanced'), 'standard');
  assert.equal(normalizePerformanceMode('visual'), 'performance');
  assert.equal(normalizePerformanceMode('auto'), 'auto');
  assert.equal(normalizePerformanceMode('custom'), 'custom');
  assert.equal(normalizePerformanceMode('unknown'), 'auto');
});

test('four managed presets leave granular controls exclusively to custom mode', () => {
  assert.deepEqual(Object.keys(APPEARANCE_PERFORMANCE_PRESETS), [
    'auto',
    'smooth',
    'standard',
    'performance',
  ]);

  const viewSource = readSource('apps/web/src/components/settings/views/AppearanceMotionView.tsx');
  assert.match(viewSource, /id:\s*'custom'/);
  assert.match(viewSource, /activePerformancePreset === 'custom'/);
  assert.match(viewSource, /activePerformancePreset === 'custom'\s*\?\s*\(/);
  assert.doesNotMatch(viewSource, /navigate\('\/settings\/canvas-performance'\)/);
});
