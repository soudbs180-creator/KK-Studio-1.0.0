import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('PromptBar loads LLM chat only when PPT outline AI actions run', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.doesNotMatch(promptBarSource, /import \{ generationService \} from '\.\.\/\.\.\/features\/generation\/generateService';/);
  assert.match(promptBarSource, /const chatWithLlm: LlmServiceModule\['generationService'\]\['chat'\]/);
  assert.match(promptBarSource, /await import\('\.\.\/\.\.\/features\/generation\/generateService'\)/);
  assert.match(promptBarSource, /const responseText = await chatWithLlm\(\{/);
});
