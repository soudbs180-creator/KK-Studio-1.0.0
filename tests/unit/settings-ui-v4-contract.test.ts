import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('settings v4 presents the approved dashboard and model-center hierarchy', () => {
  const bootstrapSource = readSource('apps/web/src/bootstrap.tsx');
  const modelCenterSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(bootstrapSource, /styles\/settings-ui-v4\.css/);
  assert.match(styles, /\.dashboard-card-consumption\s*\{[\s\S]*order:\s*1/);
  assert.match(styles, /\.dashboard-quick-strategy\s*\{[\s\S]*order:\s*2/);
  assert.match(styles, /\.dashboard-card-api\s*\{[\s\S]*order:\s*3/);
  assert.match(styles, /\.dashboard-card-system\s*\{[\s\S]*order:\s*4/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*65fr\)\s+minmax\(280px,\s*35fr\)/);
  assert.match(styles, /\.settings-model-center-route\s*\{[\s\S]*grid-template-columns/);
  assert.match(styles, /\.settings-model-center-directory__tab\s*\{[\s\S]*border-radius:\s*999px/);
  assert.match(modelCenterSource, /MODEL_CENTER_PRESET_PAGE_SIZE\s*=\s*6/);
  assert.match(modelCenterSource, /visiblePresets\.map/);
  assert.match(modelCenterSource, /settings-model-center-directory__pagination/);
  assert.match(styles, /\.settings-model-center-directory__pagination\s*\{/);
});

test('settings v4 fixes the shared switch and risk-icon alignment', () => {
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(styles, /\.settings-risk-card__icon\s*\{[\s\S]*place-items:\s*center/);
  assert.match(styles, /\.settings-system-switch::after\s*\{[\s\S]*top:\s*50%/);
  assert.match(styles, /transform:\s*translate\([^)]*,-50%\)/);
});
