import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce mode runtime owns mode guard and reset effect', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceModeRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceModeRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceModeRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceModeRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceModeRuntimeResult \{/);
  assert.match(hookSource, /configMode: GenerationConfig\['mode'\];/);
  assert.match(hookSource, /configThinkingMode: GenerationConfig\['thinkingMode'\];/);
  assert.match(hookSource, /setEcommerceRatioOverride:/);
  assert.match(hookSource, /setEcommerceModeRuntimeState:/);
  assert.match(hookSource, /if \(configMode !== GenerationMode\.ECOMMERCE\) \{/);
  assert.match(hookSource, /setEcommerceRatioOverride\(undefined\);/);
  assert.match(hookSource, /activeTaskNodeId: null,/);
  assert.match(hookSource, /activeTaskState: null,/);
  assert.match(hookSource, /if \(configThinkingMode !== 'high'\) \{/);
  assert.match(hookSource, /thinkingMode: 'high'/);

  assert.match(appSource, /import \{[\s\S]*?useEcommerceModeRuntime[\s\S]*?\} from '\.\/app\/useEcommerceModeRuntime';/);
  assert.match(appSource, /useEcommerceModeRuntime\(\{/);
  assert.match(appSource, /setEcommerceModeRuntimeState: updateEcommerceModeRuntimeState,/);
  assert.doesNotMatch(appSource, /if \(config\.mode !== GenerationMode\.ECOMMERCE\) \{/);
  assert.doesNotMatch(appSource, /if \(config\.thinkingMode !== 'high'\) \{/);
});
