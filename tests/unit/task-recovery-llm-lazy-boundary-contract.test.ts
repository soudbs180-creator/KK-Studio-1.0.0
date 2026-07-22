import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('task recovery loads LLM service only for pending provider task preflight', () => {
  const source = readSource('apps/web/src/hooks/useTaskRecovery.ts');

  assert.doesNotMatch(source, /import \{ generationService \} from '\.\.\/features\/generation\/generateService';/);
  assert.match(source, /const checkTaskStatuses: LlmServiceModule\['generationService'\]\['checkTaskStatuses'\]/);
  assert.match(source, /await import\('\.\.\/features\/generation\/generateService'\)/);
  assert.match(source, /await checkTaskStatuses\(/);
});

test('task recovery owns one abortable generation v3 SSE observer per pending task', () => {
  const source = readSource('apps/web/src/hooks/useTaskRecovery.ts');

  assert.match(source, /import \{ resumeGenerationTask \} from '\.\.\/services\/generation\/generationJobRecovery';/);
  assert.match(source, /activeRecoveryControllersRef = useRef\(new Map<string, AbortController>\(\)\)/);
  assert.match(source, /activeRecoveryControllersRef\.current\.has\(task\.taskId\)/);
  assert.match(source, /resumeGenerationTask\(node, task\.taskId, pollTaskFn, \{/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /controller\.abort\(\)/);
});
