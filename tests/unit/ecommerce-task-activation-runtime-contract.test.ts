import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce task activation runtime owns source-key activation handlers', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceTaskActivationRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceTaskActivationRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceTaskActivationRuntime.ts');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.match(hookSource, /export interface UseEcommerceTaskActivationRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceTaskActivationRuntimeResult \{/);
  assert.match(hookSource, /handleActivateEcommerceTaskBySourceKey: \(sourceKey: string\) => void;/);
  assert.match(hookSource, /node\.ecommerce\?\.sourceRowKey === sourceKey/);
  assert.match(hookSource, /activeTaskState: fallbackTask/);
  assert.match(hookSource, /activeGroupSheet: fallbackTask\.sourceSheet/);

  assert.match(appSource, /import \{[\s\S]*?useEcommerceTaskActivationRuntime[\s\S]*?\} from '\.\/app\/useEcommerceTaskActivationRuntime';/);
  assert.match(appSource, /const \{[\s\S]*?handleActivateEcommerceTaskBySourceKey,[\s\S]*?\} = useEcommerceTaskActivationRuntime\(\{/);
  assert.match(appSource, /onActivateEcommerceTaskBySourceKey: handleActivateEcommerceTaskBySourceKey,/);
  assert.doesNotMatch(appSource, /const handleActivateEcommerceTaskBySourceKey = useCallback/);

  assert.match(promptBarSource, /onActivateEcommerceTaskBySourceKey\?: \(sourceKey: string\) => void;/);
});
