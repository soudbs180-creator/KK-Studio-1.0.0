import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('settings v4 presents the approved dashboard and model-center hierarchy', () => {
  const bootstrapSource = readSource('apps/web/src/bootstrap.tsx');
  const mainSource = readSource('apps/web/src/main.tsx');
  const modelCenterSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(bootstrapSource, /styles\/settings-ui-v4\.css/);
  assert.match(mainSource, /styles\/settings-ui-v4\.css/);
  assert.match(styles, /\.dashboard-card-consumption\s*\{[\s\S]*order:\s*1/);
  assert.match(styles, /\.dashboard-quick-strategy\s*\{[\s\S]*order:\s*2/);
  assert.match(styles, /\.dashboard-card-api\s*\{[\s\S]*order:\s*3/);
  assert.match(styles, /\.dashboard-card-system\s*\{[\s\S]*order:\s*4/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*65fr\)\s+minmax\(280px,\s*35fr\)/);
  assert.match(styles, /\.settings-model-center-route\s*\{[\s\S]*grid-template-columns/);
  assert.match(styles, /\.settings-model-center-directory__tab\s*\{[\s\S]*border-radius:\s*999px/);
  assert.match(modelCenterSource, /filteredPresets\.map/);
  assert.equal((modelCenterSource.match(/settings-model-center-column-title/g) || []).length, 2);
  assert.doesNotMatch(modelCenterSource, /MODEL_CENTER_PRESET_PAGE_SIZE|visiblePresets|settings-model-center-directory__pagination/);
  assert.match(styles, /\.settings-model-center-column-title[\s\S]*font-family:\s*inherit\s*!important/);
  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-preset-list\s*\{[\s\S]*grid-auto-rows:\s*66px\s*!important/);
  assert.match(styles, /:is\(\.settings-model-center-pool, \.settings-model-center-directory\)[\s\S]*background:\s*color-mix\(in srgb, var\(--settings-layer-surface\)/);
});

test('settings v4 fixes the shared switch and risk-icon alignment', () => {
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.doesNotMatch(styles, /var\(--settings-accent\)/);
  assert.match(styles, /\.settings-risk-card__icon\s*\{[\s\S]*place-items:\s*center/);
  assert.match(styles, /\.settings-system-switch::after\s*\{[\s\S]*top:\s*50%/);
  assert.match(styles, /\.settings-system-switch::after\s*\{[\s\S]*content:\s*''/);
  assert.match(styles, /transform:\s*translate\([^)]*,-50%\)/);
  assert.match(styles, /button\.settings-system-switch\.settings-control-toggle[\s\S]*width:\s*44px\s*!important/);
  assert.match(styles, /button\.settings-system-switch\.settings-control-toggle\[data-state='on'\][\s\S]*background:/);
});

test('settings overlays and dashboard cards keep visible hierarchy without clipping controls', () => {
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(styles, /\.settings-section__frame:has\(\.settings-system-control-menu\)[\s\S]*overflow:\s*visible/);
  assert.match(styles, /\.settings-system-control-menu[\s\S]*z-index:\s*var\(--kk-z-dropdown/);
  assert.match(styles, /\.dashboard-card-consumption \.dashboard-panel__body[\s\S]*grid-template-columns:/);
  assert.match(styles, /\.dashboard-card-system \.dashboard-system-topology[\s\S]*grid-template-columns:/);
  assert.match(styles, /\.dashboard-quick-strategy[\s\S]*border-color:\s*var\(--settings-border-strong\)/);
});

test('performance modes stay on one desktop row and canvas tuning remains inside custom performance', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/AppearanceMotionView.tsx');
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(styles, /\.settings-performance-mode-control\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(viewSource, /settings-performance-custom-controls/);
  assert.doesNotMatch(viewSource, /title=\{pick\('画布性能',\s*'Canvas Performance'\)\}/);
});

test('diagnostics use independently probed runtime cards without simulated legacy health', () => {
  const viewSource = readSource('apps/web/src/components/settings/views/DevDiagnosticsView.tsx');

  assert.match(viewSource, /<RuntimeHealthOverview/);
  assert.doesNotMatch(viewSource, /EXCELLENT \(60FPS\)|'1\.5\.9'|'f4d2b09'/);
  assert.doesNotMatch(viewSource, /grid-cols-1 md:grid-cols-2 lg:grid-cols-4/);
  assert.doesNotMatch(viewSource, /decideRoute\(|Sandbox policies verified/);
  assert.match(viewSource, /do not create synthetic route decisions/);
});
