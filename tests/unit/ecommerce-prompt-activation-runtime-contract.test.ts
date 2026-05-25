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

test('ecommerce prompt activation runtime is extracted from App before shared prompt action wiring', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommercePromptActivationRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommercePromptActivationRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommercePromptActivationRuntime.ts');

  assert.match(appSource, /import \{[\s\S]*?useEcommercePromptActivationRuntime[\s\S]*?\} from '\.\/app\/useEcommercePromptActivationRuntime';/);
  assert.match(appSource, /const \{[\s\S]*?syncPromptNodeEcommerceSelection,[\s\S]*?resolvePromptNodeFrameworkStatus,[\s\S]*?\} = useEcommercePromptActivationRuntime\(\{/);
  assert.doesNotMatch(appSource, /const resolvePromptNodeFrameworkStatus = useCallback/);

  const depsBlock = readInterfaceBlock(hookSource, 'UseEcommercePromptActivationRuntimeDeps');
  const resultBlock = readInterfaceBlock(hookSource, 'UseEcommercePromptActivationRuntimeResult');

  assert.match(depsBlock, /activeCanvasRef: RefObject<EcommercePromptActivationCanvasSnapshot \| null \| undefined>;/);
  assert.match(depsBlock, /ecommerceFrameworkRuntimeRef: RefObject<Record<string, EcommerceFrameworkRuntimeState>>;/);
  assert.match(depsBlock, /setEcommercePromptActivationRuntimeState: SetEcommercePromptActivationRuntimeState;/);
  assert.match(depsBlock, /setEcommerceRatioOverride: \(ratioOverride: AspectRatio\[\] \| undefined\) => void;/);
  assert.match(depsBlock, /resolveEcommerceFrameworkId: ResolveEcommerceFrameworkId;/);
  assert.match(depsBlock, /syncEcommerceFrameworkView: SyncEcommerceFrameworkView;/);

  assert.match(resultBlock, /syncPromptNodeEcommerceSelection: \(clickedNode: PromptNode\) => void;/);
  assert.match(resultBlock, /resolvePromptNodeFrameworkStatus: \(node: PromptNode\) => ReturnType<typeof resolveEcommerceFrameworkSummary> \| null;/);
});

test('handlePromptClick delegates ecommerce activation state to the dedicated runtime hook', () => {
  const appSource = readSource('src/App.tsx');
  const handlePromptClickIndex = appSource.indexOf(
    'const handlePromptClick = useCallback((clickedNode: PromptNode, isOptimizedView?: boolean) => {',
  );
  const sharedActionPropsIndex = appSource.indexOf(
    'const getSharedPromptNodeActionProps = useCallback((node: PromptNode): SharedPromptNodeActionProps => ({',
  );

  assert.notEqual(handlePromptClickIndex, -1, 'expected App.tsx to declare handlePromptClick');
  assert.notEqual(sharedActionPropsIndex, -1, 'expected App.tsx to declare shared prompt action props');

  const handlePromptClickSource = appSource.slice(handlePromptClickIndex, sharedActionPropsIndex);

  assert.match(handlePromptClickSource, /syncPromptNodeEcommerceSelection\(clickedNode\);/);
  assert.doesNotMatch(handlePromptClickSource, /const ecommerceTaskState = clickedNode\.ecommerce\?\.editableTask/);
  assert.doesNotMatch(handlePromptClickSource, /setEcommerceRatioOverride\(clickedNode\.ecommerce\?\.allowedAspectRatios\);/);
  assert.doesNotMatch(handlePromptClickSource, /const nextFrameworkId = clickedNode\.mode === GenerationMode\.ECOMMERCE/);
  assert.doesNotMatch(handlePromptClickSource, /syncEcommerceFrameworkView\(nextFrameworkId, nextActiveSheet\);/);
  assert.doesNotMatch(handlePromptClickSource, /setEcommerceState\(\(previousState\) => \(\{/);
});

test('prompt activation runtime owns ecommerce task focus and framework summary resolution', () => {
  const hookSource = readSource('src/app/useEcommercePromptActivationRuntime.ts');

  assert.match(hookSource, /resolveEcommerceFrameworkSummary\(/);
  assert.match(hookSource, /clickedNode\.ecommerce\?\.editableTask/);
  assert.match(hookSource, /clickedNode\.partialRedraw\?\.inheritedTaskState/);
  assert.match(hookSource, /setEcommerceRatioOverride\(clickedNode\.ecommerce\?\.allowedAspectRatios\);/);
  assert.match(hookSource, /activeTaskNodeId: clickedNode\.mode === GenerationMode\.ECOMMERCE && clickedNode\.ecommerce\?\.kind !== 'framework'/);
  assert.match(hookSource, /activeFrameworkId: nextFrameworkId,/);
  assert.match(hookSource, /syncEcommerceFrameworkView\(nextFrameworkId, nextActiveSheet\);/);
});
