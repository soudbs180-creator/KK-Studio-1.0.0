import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('API management exposes CLIProxyAPI as a loopback runtime source', () => {
  const source = readSource('apps/web/src/components/settings/views/CapabilitySourcesView.tsx');
  const catalogSource = readSource('apps/web/src/services/runtime/cliProxyModelCatalog.ts');

  assert.match(source, /getRuntimeHealthSnapshot/);
  assert.match(source, /getCliProxyModelCatalog/);
  assert.match(source, /CLIProxyAPI/);
  assert.match(source, /serviceId === 'cliproxyapi'/);
  assert.match(catalogSource, /127\.0\.0\.1:9099\/api\/provider-runtime\/models/);
  assert.match(catalogSource, /getModelCapabilities/);
  assert.match(catalogSource, /authorization: `Bearer \$\{token\}`/);
});

test('AI agent settings explain the one authoritative execution pipeline', () => {
  const source = readSource('apps/web/src/components/settings/views/AiTakeoverView.tsx');

  assert.match(source, /IntentGate/);
  assert.match(source, /Planner/);
  assert.match(source, /ToolRegistry/);
  assert.match(source, /Verification/);
  assert.match(source, /Checkpoint/);
  assert.match(source, /RouteEngine \+ CapabilityGraph/);
  assert.match(source, /KK Agent Runtime/);
});

test('provider cards remain one horizontal card per row at desktop widths', () => {
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');
  const modelCenterSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const capabilitySources = readSource('apps/web/src/components/settings/views/CapabilitySourcesView.tsx');

  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*65fr\) minmax\(280px,\s*35fr\)\s*!important/);
  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-route-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.doesNotMatch(styles, /@media \(min-width:\s*1500px\)[\s\S]*settings-model-center-route-grid[\s\S]*repeat\(2/);
  assert.match(styles, /--settings-model-center-column-height:\s*min\(640px,\s*calc\(100vh - 250px\)\)/);
  assert.match(styles, /\.settings-panel \.settings-console-content :is\(\.settings-model-center-pool, \.settings-model-center-directory\)\s*\{[\s\S]*height:\s*var\(--settings-model-center-column-height\)\s*!important;[\s\S]*min-height:\s*var\(--settings-model-center-column-height\)\s*!important;[\s\S]*max-height:\s*var\(--settings-model-center-column-height\)\s*!important/);
  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-route-grid\s*\{[\s\S]*grid-auto-rows:\s*92px\s*!important/);
  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-route\s*\{[\s\S]*height:\s*92px\s*!important;[\s\S]*min-height:\s*92px\s*!important;[\s\S]*max-height:\s*92px\s*!important/);
  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-route__summary\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*transparent\s*!important/);
  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-route__metric \+ \.settings-model-center-route__metric\s*\{[\s\S]*border-left:\s*0\s*!important/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.settings-panel \.settings-console-content \.settings-model-center-route-grid\s*\{[\s\S]*grid-auto-rows:\s*minmax\(224px,\s*auto\)\s*!important/);
  assert.match(modelCenterSource, /settings-model-center-toolbar settings-model-center-column-header/);
  assert.match(modelCenterSource, /settings-model-center-directory__header settings-model-center-column-header/);
  assert.doesNotMatch(capabilitySources, /密钥与通道配置 \(原 API 设置\)|Keys & Channels/);
  assert.match(capabilitySources, /className="settings-capability-api-embed settings-capability-api-embed--model-center"/);
});

test('preset directory exposes six complete rows and scrolls the remaining presets', () => {
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');
  const modelCenterSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(modelCenterSource, /\{filteredPresets\.map\(\(preset\) => \(/);
  assert.doesNotMatch(modelCenterSource, /visiblePresets|presetPage|settings-model-center-directory__pagination/);
  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-preset-list\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[\s\S]*grid-auto-rows:\s*68px\s*!important;[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(styles, /\.settings-panel \.settings-console-content \.settings-model-center-preset-row\s*\{[\s\S]*height:\s*68px\s*!important;[\s\S]*min-height:\s*68px\s*!important;[\s\S]*max-height:\s*68px\s*!important/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.settings-panel \.settings-console-content \.settings-model-center-preset-list\s*\{[\s\S]*max-height:\s*468px\s*!important/);
});
