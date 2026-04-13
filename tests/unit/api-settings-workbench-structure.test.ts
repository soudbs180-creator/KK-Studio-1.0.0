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

  assert.match(source, /Platform capabilities/);
});

test('ApiSettingsView delegates workbench stages, shared sections, and shared cards to focused modules', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const stageSource = readSource('src/components/settings/apiWorkbenchState.ts');
  const sectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');
  const cardsSource = readSource('src/components/settings/apiWorkbenchCards.tsx');

  assert.match(viewSource, /from '\.\/apiWorkbenchState';/);
  assert.match(viewSource, /from '\.\/apiWorkbenchSections';/);
  assert.match(viewSource, /from '\.\/apiWorkbenchCards';/);

  assert.match(stageSource, /export type ApiSettingsWorkbenchStage =/);
  assert.match(stageSource, /'diagnostics'/);
  assert.match(stageSource, /export function resolveApiWorkbenchStageMeta/);

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
  assert.doesNotMatch(viewSource, /title=\{pick\('工作台摘要', 'Workspace snapshot'\)\}/);
  assert.doesNotMatch(viewSource, /title=\{pick\('当前视图', 'Current view'\)\}/);
  assert.doesNotMatch(viewSource, /title=\{pick\('平台能力入口', 'Platform capabilities'\)\}/);
});
