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

test('ecommerce partial redraw runtime owns ecommerce inheritance and finalization helpers', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommercePartialRedrawRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommercePartialRedrawRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommercePartialRedrawRuntime.ts');

  assert.match(appSource, /import \{[\s\S]*?useEcommercePartialRedrawRuntime[\s\S]*?\} from '\.\/app\/useEcommercePartialRedrawRuntime';/);
  assert.match(appSource, /const \{[\s\S]*?resolveEcommercePartialRedrawContext,[\s\S]*?finalizeEcommercePartialRedrawResult,[\s\S]*?\} = useEcommercePartialRedrawRuntime\(\{/);

  const depsBlock = readInterfaceBlock(hookSource, 'UseEcommercePartialRedrawRuntimeDeps');
  const resultBlock = readInterfaceBlock(hookSource, 'UseEcommercePartialRedrawRuntimeResult');

  assert.match(depsBlock, /activeCanvasRef: RefObject<EcommercePartialRedrawCanvasSnapshot \| null \| undefined>;/);
  assert.match(depsBlock, /updateImageNode: UpdateImageNode;/);
  assert.match(depsBlock, /updatePromptNode: UpdatePromptNode;/);
  assert.match(depsBlock, /deletePromptNode: DeletePromptNode;/);
  assert.match(resultBlock, /resolveEcommercePartialRedrawContext:\s*\(\s*sourceImage: GeneratedImage,\s*parentPrompt: PromptNode \| null \| undefined,\s*\)\s*=> EcommercePartialRedrawContext;/);
  assert.match(resultBlock, /finalizeEcommercePartialRedrawResult: \(params: FinalizeEcommercePartialRedrawResultParams\) => Promise<void>;/);
});

test('handlePartialRedrawRequest delegates ecommerce inheritance and redraw finalization to the hook', () => {
  const appSource = readSource('src/App.tsx');
  const handlePartialRedrawIndex = appSource.indexOf('const handlePartialRedrawRequest = useCallback((image: GeneratedImage, request: RedrawRequest) => {');
  const handleMobilePartialRedrawIndex = appSource.indexOf('const handleMobileResultPartialRedraw = useCallback((entry: MobileResultEntry, request: RedrawRequest) => {');

  assert.notEqual(handlePartialRedrawIndex, -1, 'expected App.tsx to declare handlePartialRedrawRequest');
  assert.notEqual(handleMobilePartialRedrawIndex, -1, 'expected App.tsx to declare handleMobileResultPartialRedraw');

  const handlePartialRedrawSource = appSource.slice(handlePartialRedrawIndex, handleMobilePartialRedrawIndex);

  assert.match(handlePartialRedrawSource, /const ecommercePartialRedrawContext = resolveEcommercePartialRedrawContext\(sourceImage, parentPrompt\);/);
  assert.match(handlePartialRedrawSource, /await finalizeEcommercePartialRedrawResult\(\{/);
  assert.doesNotMatch(handlePartialRedrawSource, /const inheritedTaskState = parentPrompt\?\.ecommerce\?\.editableTask/);
  assert.doesNotMatch(handlePartialRedrawSource, /const inheritedDisplayLabel = parentPrompt\?\.ecommerce\?\.displayLabel/);
  assert.doesNotMatch(handlePartialRedrawSource, /const inheritedDeliveryKind = sourceImage\.ecommerceDeliveryKind/);
  assert.doesNotMatch(handlePartialRedrawSource, /if \(parentPrompt\?\.mode === GenerationMode\.ECOMMERCE && redrawResultImage\) \{/);
});

test('partial redraw runtime resolves ecommerce inheritance and finalizes ecommerce redraw ownership', () => {
  const hookSource = readSource('src/app/useEcommercePartialRedrawRuntime.ts');

  assert.match(hookSource, /sourceImage\.redraw\?\.inheritedTaskState/);
  assert.match(hookSource, /sourceImage\.partialRedraw\?\.inheritedTaskState/);
  assert.match(hookSource, /sourceImage\.redraw\?\.inheritedDisplayLabel/);
  assert.match(hookSource, /sourceImage\.partialRedraw\?\.inheritedDisplayLabel/);
  assert.match(hookSource, /sourceImage\.redraw\?\.inheritedDeliveryKind/);
  assert.match(hookSource, /sourceImage\.partialRedraw\?\.inheritedDeliveryKind/);
  assert.match(hookSource, /parentPrompt\?\.ecommerce\?\.editableTask/);
  assert.match(hookSource, /parentPrompt\?\.ecommerce\?\.displayLabel/);
  assert.match(hookSource, /parentPrompt\?\.ecommerce\?\.activeDeliveryKind/);
  assert.match(hookSource, /await updateImageNode\(redrawResultImage\.id,/);
  assert.match(hookSource, /await updatePromptNode\(\{/);
  assert.match(hookSource, /deletePromptNode\(redrawNode\.id\);/);
});
