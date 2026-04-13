import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ApiSettingsView keeps Platform Assistant AI as a dedicated entry without duplicating it across list and editor contexts', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');
  const sectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /const handleOpenPlatformAssistant = useCallback/);
  assert.match(source, /notify\.info\(/);
  assert.match(source, /from '\.\/apiWorkbenchSections';/);
  assert.match(sectionsSource, /type PlatformAssistantEntryCardProps = \{/);
  assert.match(sectionsSource, /const PlatformAssistantEntryCard: React\.FC<PlatformAssistantEntryCardProps> = \(\{/);
  assert.match(sectionsSource, /<SettingsActionButton icon=\{Wand2\} tone="primary" onClick=\{onOpen\}>/);
  assert.match(sectionsSource, /<InfoCell label=\{localApiLabel\} value=\{localApiValue\} helper=\{localApiHelper\} \/>/);
  assert.match(sectionsSource, /<InfoCell label=\{platformLabel\} value=\{platformValue\} helper=\{platformHelper\} \/>/);
  assert.match(source, /entryContextLabel=\{pick\([^)]*'Platform-managed entry'\)\}/);
  assert.match(source, /localApiValue=\{pick\([^)]*'Keep your BYOK routes'\)\}/);
  assert.match(source, /platformValue=\{pick\([^)]*'Separate platform entry'\)\}/);
  assert.match(
    sectionsSource,
    /platformHelper=\{pick\([\s\S]*'Platform assistant capabilities enter here without mixing with local API keys, routing, or budget rules\.'[\s\S]*\)\}/,
  );
  assert.match(source, /onOpenPlatformAssistant=\{handleOpenPlatformAssistant\}/);

  const cardUsages = source.match(/^\s*<PlatformAssistantEntryCard/gm) ?? [];
  assert.equal(cardUsages.length, 1, 'Expected one direct editor guidance card while the workspace entry is delegated through ApiWorkbenchPlatformSection');
  assert.doesNotMatch(source, /\{activeEditorMode !== null \? \(\s*<PlatformAssistantEntryCard/);
});
