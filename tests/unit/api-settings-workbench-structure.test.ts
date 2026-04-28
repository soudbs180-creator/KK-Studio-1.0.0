import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ApiSettingsView list mode exposes a dedicated workspace snapshot section', () => {
  const source = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /Workspace snapshot/);
});

test('ApiSettingsView keeps the default list-mode hero framed as API setup while advanced workbench sections remain available', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /API setup/);
  assert.match(source, /showAdvancedWorkbench \? \(/);
  assert.doesNotMatch(source, /API workspace/);
});

test('ApiSettingsView keeps platform capabilities as a dedicated section instead of mixing them into provider list content', () => {
  const source = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /Platform entry/);
});

test('ApiSettingsView delegates workbench stages, shared sections, and shared cards to focused modules', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const stageSource = readSource('src/components/settings/apiWorkbenchState.ts');
  const sectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');
  const cardsSource = readSource('src/components/settings/apiWorkbenchCards.tsx');
  const scaffoldSource = readSource('src/components/settings/SettingsScaffold.tsx');

  assert.match(viewSource, /from '\.\/apiWorkbenchState';/);
  assert.match(viewSource, /from '\.\/apiWorkbenchSections';/);
  assert.match(viewSource, /from '\.\/apiWorkbenchCards';/);
  assert.match(scaffoldSource, /surface\?: 'card' \| 'plain';/);

  assert.match(stageSource, /export type ApiSettingsWorkbenchStage = UserApiWorkbenchStage;/);
  assert.match(stageSource, /export function resolveApiWorkbenchDiagnosticsAvailability/);
  assert.match(stageSource, /export function resolveApiWorkbenchStageMeta/);
  assert.doesNotMatch(stageSource, /input\.showDiagnostics \? 'diagnostics' : input\.stage/);

  assert.match(viewSource, /<ApiWorkbenchOverviewSection/);
  assert.match(viewSource, /<ApiWorkbenchCurrentViewSection/);
  assert.match(viewSource, /<ApiWorkbenchStageSection/);
  assert.match(viewSource, /<ApiWorkbenchPlatformSection/);
  assert.match(sectionsSource, /Current view/);
  assert.match(sectionsSource, /Status and next step/);
  assert.match(sectionsSource, /Diagnostics view/);
  assert.match(sectionsSource, /surface="plain"/);
  assert.match(sectionsSource, /testId="settings-workbench-diagnostics"[\s\S]*surface="plain"/);
  assert.match(sectionsSource, /className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"/);
  assert.match(sectionsSource, /className="min-w-0 flex-1 space-y-2 text-left"/);
  assert.doesNotMatch(sectionsSource, /label=\{pick\('当前阶段', 'Stage'\)/);
  assert.doesNotMatch(sectionsSource, /testId="settings-workbench-current-view"[\s\S]*rounded-\[24px\] border p-4/);
  assert.match(cardsSource, /export const ConsoleEndpointCard/);

  assert.doesNotMatch(viewSource, /const InfoCell:/);
  assert.doesNotMatch(viewSource, /const PlatformAssistantEntryCard:/);
  assert.doesNotMatch(viewSource, /const ConsoleEndpointCard:/);
  assert.doesNotMatch(viewSource, /const userApiWorkbenchStage = showDiagnostics \? 'diagnostics' : userApiViewState\.stage;/);
});

test('ApiSettingsView surfaces a compact unified API list and keeps provider creation scoped', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const sectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(viewSource, /const showSimpleProviderList = !showAdvancedWorkbench;/);
  assert.match(viewSource, /data-testid="api-simple-provider-add"/);
  assert.match(viewSource, /data-testid="api-proxy-provider-add"/);
  assert.match(viewSource, /pick\('添加 API', 'Add API'\)/);
  assert.match(viewSource, /thirdPartyProviders\.map\(\(provider\)/);

  assert.match(viewSource, /pick\('本地 API', 'Local APIs'\)/);
  assert.match(viewSource, /pick\('新增本地 API', 'Add local API'\)/);
  assert.match(viewSource, /pick\('本地 API 编辑器', 'Local API editor'\)/);
  assert.match(sectionsSource, /pick\('本地 API 视图', 'Local API view'\)/);
  assert.match(sectionsSource, /value: 'official', label: pick\('本地 API', 'Local APIs'\)/);

  const createOfficialButtonUsages = viewSource.match(/onClick=\{\(\) => beginCreateOfficial\(\)\}/g) ?? [];
  const createProxyAddEntryUsages = viewSource.match(/data-testid="api-proxy-provider-add"/g) ?? [];
  const createProviderButtonUsages = viewSource.match(/onClick=\{beginCreateProvider\}/g) ?? [];

  assert.equal(createOfficialButtonUsages.length, 0, 'Expected official creation to go through the compact API add entry');
  assert.equal(createProxyAddEntryUsages.length, 1, 'Expected simple list mode to expose one proxy provider add entry');
  assert.equal(createProviderButtonUsages.length, 2, 'Expected provider creation to be available from the proxy add entry and advanced empty-state action');
});

test('ApiSettingsView keeps diagnostics and section actions owned by shared modules instead of hidden duplicate controls', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.doesNotMatch(viewSource, /data-testid="api-workbench-diagnostics-toggle"/);
  assert.doesNotMatch(viewSource, /className="hidden"[^\\n]*beginCreateOfficial/);
  assert.doesNotMatch(viewSource, /className="hidden"[^\\n]*beginCreateProvider/);
});
