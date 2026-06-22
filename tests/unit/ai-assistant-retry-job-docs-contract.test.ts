import test from 'node:test';
import assert from 'node:assert/strict';
import { readSource } from '../support/workspacePaths.js';

test('AI assistant retry job docs contract: registry and runbooks expose generation.retryJob', () => {
  const generationToolsSource = readSource('apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts');
  const toolRegistryDocs = readSource('docs/ai-assistant/tool-registry.md');
  const batchSkillDocs = readSource('docs/ai-assistant/skills/batch-generate-to-canvas.md');
  const runbooksDocs = readSource('docs/ai-assistant/RUNBOOKS.md');
  const skillsIndexDocs = readSource('docs/ai-assistant/skills.md');

  assert.match(generationToolsSource, /name: 'generation\.retryJob'/);
  assert.match(generationToolsSource, /permission: 'safe'/);
  assert.match(generationToolsSource, /target\?: 'latest_failed'/);
  assert.match(generationToolsSource, /resolveRetryJob/);
  assert.match(generationToolsSource, /retryFailedPrompts\(resolvedJob\.id\)/);

  for (const docsSource of [toolRegistryDocs, batchSkillDocs, runbooksDocs, skillsIndexDocs]) {
    assert.match(docsSource, /`generation\.retryJob`/);
    assert.match(docsSource, /latest_failed|最近失败|latest failed/i);
  }
});
