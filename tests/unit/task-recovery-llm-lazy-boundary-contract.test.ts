import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('task recovery loads LLM service only for pending provider task preflight', () => {
  const source = readSource('apps/web/src/hooks/useTaskRecovery.ts');

  assert.doesNotMatch(source, /import \{ llmService \} from '\.\.\/services\/llm\/LLMService';/);
  assert.match(source, /const checkTaskStatuses: LlmServiceModule\['llmService'\]\['checkTaskStatuses'\]/);
  assert.match(source, /await import\('\.\.\/services\/llm\/LLMService'\)/);
  assert.match(source, /await checkTaskStatuses\(/);
});
