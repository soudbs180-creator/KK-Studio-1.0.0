import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('PromptBar loads LLM chat only when PPT outline AI actions run', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.doesNotMatch(promptBarSource, /import \{ llmService \} from '\.\.\/\.\.\/services\/llm\/LLMService';/);
  assert.match(promptBarSource, /const chatWithLlm: LlmServiceModule\['llmService'\]\['chat'\]/);
  assert.match(promptBarSource, /await import\('\.\.\/\.\.\/services\/llm\/LLMService'\)/);
  assert.match(promptBarSource, /const responseText = await chatWithLlm\(\{/);
});
