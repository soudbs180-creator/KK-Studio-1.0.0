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

test('ApiSettingsView keeps platform capabilities as a dedicated section instead of mixing them into provider list content', () => {
  const source = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /Platform entry/);
});

test('ApiSettingsView delegates workbench stages, shared sections, and shared cards to focused modules', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const stageSource = readSource('src/components/settings/apiWorkbenchState.ts');
  const sectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');
  const cardsSource = readSource('src/components/settings/apiWorkbenchCards.tsx');

  assert.match(viewSource, /from '\.\/apiWorkbenchState';/);
  assert.match(viewSource, /from '\.\/apiWorkbenchSections';/);
  assert.match(viewSource, /from '\.\/apiWorkbenchCards';/);

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
  assert.match(cardsSource, /export const ConsoleEndpointCard/);

  assert.doesNotMatch(viewSource, /const InfoCell:/);
  assert.doesNotMatch(viewSource, /const PlatformAssistantEntryCard:/);
  assert.doesNotMatch(viewSource, /const ConsoleEndpointCard:/);
  assert.doesNotMatch(viewSource, /const userApiWorkbenchStage = showDiagnostics \? 'diagnostics' : userApiViewState\.stage;/);
});

test('ApiSettingsView surfaces local APIs as the primary BYOK path and avoids duplicated create buttons in list mode', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const sectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(viewSource, /pick\('本地 API', 'Local APIs'\)/);
  assert.match(viewSource, /pick\('新增本地 API', 'Add local API'\)/);
  assert.match(viewSource, /pick\('本地 API 编辑器', 'Local API editor'\)/);
  assert.match(sectionsSource, /pick\('本地 API 视图', 'Local API view'\)/);
  assert.match(sectionsSource, /value: 'official', label: pick\('本地 API', 'Local APIs'\)/);

  const createOfficialButtonUsages = viewSource.match(/onClick=\{beginCreateOfficial\}/g) ?? [];
  const createProviderButtonUsages = viewSource.match(/onClick=\{beginCreateProvider\}/g) ?? [];

  assert.equal(createOfficialButtonUsages.length, 1, 'Expected only the empty state to keep a direct local API create button');
  assert.equal(createProviderButtonUsages.length, 1, 'Expected only the empty state to keep a direct provider create button');
});
