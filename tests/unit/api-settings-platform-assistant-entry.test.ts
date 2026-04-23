import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ApiSettingsView keeps Platform Assistant AI as one dedicated entry outside the local API editor', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');
  const sectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /const handleOpenPlatformAssistant = useCallback/);
  assert.match(source, /notify\.info\(/);
  assert.match(source, /from '\.\/apiWorkbenchSections';/);
  assert.match(sectionsSource, /type PlatformAssistantEntryCardProps = \{/);
  assert.match(sectionsSource, /const PlatformAssistantEntryCard: React\.FC<PlatformAssistantEntryCardProps> = \(\{/);
  assert.match(sectionsSource, /title=\{pick\('平台入口', 'Platform entry'\)\}/);
  assert.match(sectionsSource, /<SettingsActionButton icon=\{Wand2\} tone="secondary" onClick=\{onOpen\}>/);
  assert.match(sectionsSource, /className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"/);
  assert.match(sectionsSource, /className="min-w-0 flex-1 space-y-2 text-left"/);
  assert.doesNotMatch(sectionsSource, /max-w-\[320px\] rounded-\[20px\] border p-4/);
  assert.match(sectionsSource, /<InfoCell label=\{localApiLabel\} value=\{localApiValue\} helper=\{localApiHelper\} \/>/);
  assert.match(sectionsSource, /<InfoCell label=\{platformLabel\} value=\{platformValue\} helper=\{platformHelper\} \/>/);
  assert.match(sectionsSource, /entryContextLabel=\{pick\([^)]*'Platform-managed entry'\)\}/);
  assert.match(sectionsSource, /localApiLabel=\{pick\([^)]*'Local APIs'\)\}/);
  assert.match(sectionsSource, /localApiValue=\{pick\([^)]*'Continue below'\)\}/);
  assert.match(sectionsSource, /platformValue=\{pick\([^)]*'Separate platform entry'\)\}/);
  assert.match(
    sectionsSource,
    /platformHelper=\{pick\([\s\S]*'Platform assistant capabilities enter here without mixing with local API keys, routing, or budget rules\.'[\s\S]*\)\}/,
  );
  assert.match(source, /onOpenPlatformAssistant=\{handleOpenPlatformAssistant\}/);

  const cardUsages = source.match(/^\s*<PlatformAssistantEntryCard/gm) ?? [];
  assert.equal(cardUsages.length, 0, 'Expected PlatformAssistantEntryCard to stay delegated through ApiWorkbenchPlatformSection only');
  assert.doesNotMatch(source, /\{showOfficialEditor \? \(\s*<SettingsSection[\s\S]*<PlatformAssistantEntryCard/);
});
