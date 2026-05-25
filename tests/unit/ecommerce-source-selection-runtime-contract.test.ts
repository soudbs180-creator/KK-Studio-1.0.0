import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



function readInterfaceBlock(source: string, interfaceName: string): string {
  const match = source.match(new RegExp(`export interface ${interfaceName} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${interfaceName} should be exported`);
  return match[0];
}

test('ecommerce source selection runtime owns image-source reset behavior', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceSourceSelectionRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceSourceSelectionRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceSourceSelectionRuntime.ts');

  assert.match(appSource, /import \{[\s\S]*?useEcommerceSourceSelectionRuntime[\s\S]*?\} from '\.\/app\/useEcommerceSourceSelectionRuntime';/);
  assert.match(appSource, /const \{[\s\S]*?resetEcommerceSourceSelectionState,[\s\S]*?\} = useEcommerceSourceSelectionRuntime\(\{/);

  const depsBlock = readInterfaceBlock(hookSource, 'UseEcommerceSourceSelectionRuntimeDeps');
  const resultBlock = readInterfaceBlock(hookSource, 'UseEcommerceSourceSelectionRuntimeResult');

  assert.match(depsBlock, /setEcommerceRatioOverride: Dispatch<SetStateAction<AspectRatio\[\] \| undefined>>;/);
  assert.match(depsBlock, /setEcommerceSourceSelectionRuntimeState: SetEcommerceSourceSelectionRuntimeState;/);
  assert.match(resultBlock, /resetEcommerceSourceSelectionState: \(\) => void;/);
});

test('handleImageClick delegates ecommerce reset state to the dedicated runtime hook', () => {
  const appSource = readSource('src/App.tsx');
  const handleImageClickIndex = appSource.indexOf('const handleImageClick = useCallback((imageId: string) => {');
  const handleMobileUseImageAsSourceIndex = appSource.indexOf('const handleMobileUseImageAsSource = useCallback((imageId: string) => {');

  assert.notEqual(handleImageClickIndex, -1, 'expected App.tsx to declare handleImageClick');
  assert.notEqual(handleMobileUseImageAsSourceIndex, -1, 'expected App.tsx to declare handleMobileUseImageAsSource');

  const handleImageClickSource = appSource.slice(handleImageClickIndex, handleMobileUseImageAsSourceIndex);

  assert.match(handleImageClickSource, /resetEcommerceSourceSelectionState\(\);/);
  assert.doesNotMatch(handleImageClickSource, /setEcommerceRatioOverride\(undefined\);/);
  assert.doesNotMatch(handleImageClickSource, /activeFrameworkId: null,/);
  assert.doesNotMatch(handleImageClickSource, /activeGroupSheet: null,/);
  assert.doesNotMatch(handleImageClickSource, /setEcommerceState\(\(previousState\) => \(\{/);
});

test('source selection runtime clears ecommerce task, framework, and sheet focus', () => {
  const hookSource = readSource('src/app/useEcommerceSourceSelectionRuntime.ts');

  assert.match(hookSource, /setEcommerceRatioOverride\(undefined\);/);
  assert.match(hookSource, /activeTaskNodeId: null,/);
  assert.match(hookSource, /activeTaskState: null,/);
  assert.match(hookSource, /activeFrameworkId: null,/);
  assert.match(hookSource, /activeGroupSheet: null,/);
});
