import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('provider list cards stay compact and keep edit, refresh, pause, and delete actions on the list surface', () => {
  const source = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const sectionSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /modelCenterRoutes[\s\S]*thirdPartyProviders\.map\(\(provider\)/);
  assert.match(sectionSource, /settings-model-center-route/);
  assert.match(sectionSource, /settings-model-center-route__actions/);
  assert.match(sectionSource, /<Pause size=\{15\}/);
  assert.match(sectionSource, /<Edit3 size=\{15\}/);
  assert.match(sectionSource, /<RefreshCw size=\{15\}/);
  assert.match(sectionSource, /<Trash2 size=\{15\}/);
  assert.match(sectionSource, /onClick=\{route\.onDelete\}/);
  assert.match(sectionSource, /aria-label=\{toggleLabel\}/);
  assert.match(sectionSource, /aria-label=\{editLabel\}/);
  assert.match(sectionSource, /aria-label=\{refreshLabel\}/);
  assert.match(sectionSource, /aria-label=\{deleteLabel\}/);
  assert.match(source, /confirmModelCenterRouteDelete/);
  assert.match(source, /Delete \"\$\{title\}\"\? You will need to add the API key again to restore it\./);
  assert.match(source, /void deleteOfficial\(slot\.id\)/);
  assert.match(source, /void deleteProvider\(provider\.id\)/);
  assert.doesNotMatch(source, /<SettingsActionButton icon=\{Wand2\} size="sm"[\s\S]*provider-price:\$\{provider\.id\}/);
});

test('default local API cards use the model center list and keep advanced metric details behind advanced mode', () => {
  const source = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(source, /modelCenterRoutes[\s\S]*officialSlots\.map\(\(slot\)/);
  assert.match(source, /<ApiWorkbenchOverviewSection/);
  assert.match(source, /<ApiWorkbenchRoutePoolSection/);
  assert.match(cssSource, /\.settings-panel \.settings-model-center-route__metrics \{/);
  assert.match(cssSource, /\.settings-panel \.settings-model-center-route__metric-value \{[\s\S]*font-variant-numeric: tabular-nums;/);
  assert.match(cssSource, /\.settings-panel \.settings-model-center-route__actions \{[\s\S]*flex-wrap: nowrap;/);
  assert.match(cssSource, /@media \(max-width: 720px\) \{[\s\S]*\.settings-panel \.settings-model-center-route__actions \{[\s\S]*grid-template-columns: repeat\(4, 32px\);/);
  assert.doesNotMatch(source, /min-h-\[132px\]/);
});

test('provider editor advanced tools expose model sync, price sync, and a custom pricing endpoint fallback', () => {
  const source = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /自动获取模型/);
  assert.match(source, /自动获取价格/);
  assert.match(source, /价格地址/);
  assert.match(source, /showPricingEndpointOverride/);
  assert.match(source, /providerPricingEndpointDraft/);
  assert.match(source, /如果默认价格地址失败，可以在这里输入自定义价格地址。/);
});

test('capability role cards use a provider-card-like compact assignment surface', () => {
  const sectionSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(sectionSource, /settings-capability-card settings-reference-card--soft/);
  assert.match(sectionSource, /settings-capability-card__avatar/);
  assert.match(sectionSource, /role="switch"/);
  assert.match(sectionSource, /aria-checked=\{item\.enabled\}/);
  assert.match(cssSource, /\.settings-panel \.settings-capability-grid \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(260px, 1fr\)\);/);
  assert.match(cssSource, /\.settings-panel \.settings-capability-card \{[\s\S]*padding: 10px;/);
  assert.match(cssSource, /\.settings-panel \.settings-capability-card__controls select \{[\s\S]*min-height: var\(--ui-control-height-compact\);/);
});
