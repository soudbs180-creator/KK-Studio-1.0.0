import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce framework scheduler actions are owned by useEcommerceRuntime', () => {
  const hookPath = path.join(ROOT_DIR, 'src/app/useEcommerceRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceRuntimeResult \{/);
  assert.match(hookSource, /handleGenerateEcommerceFramework: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleGenerateEcommerceGroup: \(node: PromptNode, phase: 'desktop' \| 'mobile'\) => Promise<void>;/);
  assert.match(hookSource, /enqueueEcommerceFrameworkNodes: \(/);
  assert.match(hookSource, /pumpEcommerceFrameworkQueue: \(frameworkId: string\) => void;/);
  assert.match(hookSource, /cancelEcommerceFrameworkNodeQueue/);
  assert.match(hookSource, /resolveEcommerceFrameworkDispatchPlan/);
  assert.match(hookSource, /resolveFrameworkLane/);

  assert.match(appSource, /import \{ useEcommerceRuntime \} from '\.\/app\/useEcommerceRuntime';/);
  assert.match(appSource, /const \{[\s\S]*?handleGenerateEcommerceFramework,[\s\S]*?handleGenerateEcommerceGroup,[\s\S]*?\} = useEcommerceRuntime\(\{/);
  assert.match(appSource, /updateEcommerceFrameworkRuntime,/);
  assert.match(appSource, /syncEcommerceFrameworkView,/);
  assert.match(appSource, /handleGenerateEcommerceNode,/);
  assert.match(appSource, /handleRetryEcommerceModule,/);

  assert.doesNotMatch(appSource, /const resolveEcommerceFrameworkQueuePhases = useCallback/);
  assert.doesNotMatch(appSource, /const enqueueEcommerceFrameworkNodes = useCallback/);
  assert.doesNotMatch(appSource, /const pumpEcommerceFrameworkQueue = useCallback/);
  assert.doesNotMatch(appSource, /const handleGenerateEcommerceFramework = useCallback/);
  assert.doesNotMatch(appSource, /const handlePauseEcommerceFramework = useCallback/);
  assert.doesNotMatch(appSource, /const handleResumeEcommerceFramework = useCallback/);
  assert.doesNotMatch(appSource, /const handleCancelEcommerceFrameworkNodeQueue = useCallback/);
  assert.doesNotMatch(appSource, /const handleGenerateEcommerceGroup = useCallback/);
});
