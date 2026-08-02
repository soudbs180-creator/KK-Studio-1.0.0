import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('shared settings sections use semantic, content-sized responsive regions', () => {
  const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');

  assert.match(scaffoldSource, /settings-section__frame/);
  assert.match(scaffoldSource, /settings-section__header/);
  assert.match(scaffoldSource, /settings-section__copy/);
  assert.match(scaffoldSource, /settings-section__action/);
  assert.match(scaffoldSource, /settings-section__body/);
  assert.doesNotMatch(scaffoldSource, /console-section flex flex-col \$\{isPlain \? '' : 'h-full'\}/);
  assert.doesNotMatch(scaffoldSource, /console-section__body flex-1 min-h-0/);
});

test('capability sources avoid nested card shells and fixed-height overview cards', () => {
  const capabilitySource = readSource('apps/web/src/components/settings/views/CapabilitySourcesView.tsx');
  const apiWorkbenchSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(capabilitySource, /settings-capability-source-grid/);
  assert.match(capabilitySource, /settings-capability-source-card/);
  assert.match(capabilitySource, /settings-capability-api-embed/);
  assert.doesNotMatch(capabilitySource, /h-\[120px\]/);
  assert.doesNotMatch(
    capabilitySource,
    /border border-\[var\(--border-light\)\] rounded-xl overflow-hidden bg-\[var\(--bg-overlay\)\] p-2/,
  );
  assert.match(
    readSource('apps/web/src/styles/settings-v3.css'),
    /@media \(min-width: 768px\) and \(max-width: 1023px\)[\s\S]*?\.settings-capability-source-grid\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    apiWorkbenchSource,
    /testId="settings-model-center"[\s\S]*?surface="plain"/,
  );
});

test('model directory shows six presets before using an internal scroll region', () => {
  const apiWorkbenchSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const settingsStyles = readSource('apps/web/src/styles/settings-v3.css');
  const settingsUiV4Styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(apiWorkbenchSource, /\{filteredPresets\.map\(\(preset\) => \(/);
  assert.doesNotMatch(apiWorkbenchSource, /MODEL_CENTER_PRESET_PAGE_SIZE|presetPage|filteredPresets\.slice\(/);
  assert.doesNotMatch(apiWorkbenchSource, /settings-model-center-directory__pagination/);
  assert.match(settingsStyles, /\.settings-section__copy\s*\{[\s\S]*?flex:\s*1 1 180px/);
  assert.match(settingsUiV4Styles, /\.settings-panel \.settings-console-content \.settings-model-center-preset-list\s*\{[\s\S]*grid-auto-rows:\s*68px\s*!important/);
});

test('provider routing matrix becomes labeled cards instead of compressed columns on phones', () => {
  const providerRoutesSource = readSource('apps/web/src/components/settings/views/ProviderRoutesView.tsx');
  const settingsStyles = readSource('apps/web/src/styles/settings-v3.css');

  assert.match(providerRoutesSource, /settings-route-matrix/);
  assert.match(providerRoutesSource, /data-label=\{pick\('任务类型', 'Task Type'\)\}/);
  assert.match(providerRoutesSource, /data-label=\{pick\('路由决策原因', 'Routing Reason'\)\}/);
  assert.match(
    settingsStyles,
    /\.settings-route-matrix thead\s*\{[\s\S]*?display:\s*none/,
  );
  assert.match(
    settingsStyles,
    /\.settings-route-matrix tbody tr\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  );
});
