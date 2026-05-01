import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function readInterfaceBlock(source: string, interfaceName: string): string {
  const match = source.match(new RegExp(`export interface ${interfaceName} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${interfaceName} should be exported`);
  return match[0];
}

test('ecommerce framework runtime state/view helper is extracted from App before runtime wiring', () => {
  const hookPath = path.join(ROOT_DIR, 'src/app/useEcommerceFrameworkRuntimeState.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceFrameworkRuntimeState.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceFrameworkRuntimeState.ts');

  assert.match(appSource, /import \{ useEcommerceFrameworkRuntimeState,[\s\S]*?\} from '\.\/app\/useEcommerceFrameworkRuntimeState';/);

  const depsBlock = readInterfaceBlock(hookSource, 'UseEcommerceFrameworkRuntimeStateDeps');
  const resultBlock = readInterfaceBlock(hookSource, 'UseEcommerceFrameworkRuntimeStateResult');
  assert.match(depsBlock, /activeCanvasRef: RefObject<EcommerceFrameworkCanvasSnapshot \| null \| undefined>;/);
  assert.match(depsBlock, /ecommerceState: EcommerceFrameworkRuntimeStateSnapshot;/);
  assert.match(depsBlock, /setEcommerceState: SetEcommerceFrameworkRuntimeState;/);
  assert.match(depsBlock, /updatePromptNode: UpdateFrameworkPromptNode;/);
  assert.match(hookSource, /node\.mode === GenerationMode\.ECOMMERCE\s*&&\s*node\.ecommerce\?\.kind === 'framework'/);
  assert.match(resultBlock, /ecommerceFrameworkRuntimeRef: RefObject<Record<string, EcommerceFrameworkRuntimeState>>;/);
  assert.match(resultBlock, /resolveEcommerceFrameworkId: ResolveEcommerceFrameworkId;/);
  assert.match(resultBlock, /updateEcommerceFrameworkRuntime: UpdateEcommerceFrameworkRuntime;/);
  assert.match(resultBlock, /syncEcommerceFrameworkView: SyncEcommerceFrameworkView;/);
  assert.match(resultBlock, /handleActivateEcommerceGroupSheet: \(sheet: EcommerceGroupSheet\) => void;/);

  const stateIndex = appSource.indexOf('const [ecommerceState, setEcommerceState]');
  const frameworkStateIndex = appSource.indexOf('useEcommerceFrameworkRuntimeState({');
  const runtimeIndex = appSource.indexOf('useEcommerceRuntime({');
  assert.notEqual(stateIndex, -1);
  assert.notEqual(frameworkStateIndex, -1);
  assert.notEqual(runtimeIndex, -1);
  assert.ok(stateIndex < frameworkStateIndex, 'ecommerce state must exist before framework runtime state hook');
  assert.ok(frameworkStateIndex < runtimeIndex, 'framework runtime state hook must initialize before useEcommerceRuntime');

  assert.doesNotMatch(appSource, /const ecommerceFrameworkRuntimeRef = useRef<Record<string, EcommerceFrameworkRuntimeState>>\(\{\}\);/);
  assert.doesNotMatch(appSource, /const resolveEcommerceFrameworkId = useCallback/);
  assert.doesNotMatch(appSource, /const resolveEcommerceFrameworkNode = useCallback/);
  assert.doesNotMatch(appSource, /const updateEcommerceFrameworkMeta = useCallback/);
  assert.doesNotMatch(appSource, /const updateEcommerceFrameworkRuntime = useCallback/);
  assert.doesNotMatch(appSource, /const syncEcommerceFrameworkView = useCallback/);
  assert.doesNotMatch(appSource, /const handleActivateEcommerceGroupSheet = useCallback/);
});

test('useEcommerceRuntime consumes a framework state/view boundary object', () => {
  const appSource = readSource('src/App.tsx');
  const runtimeSource = readSource('src/app/useEcommerceRuntime.ts');

  const depsBlock = readInterfaceBlock(runtimeSource, 'UseEcommerceRuntimeDeps');
  assert.match(depsBlock, /frameworkStateView: EcommerceFrameworkRuntimeStateView;/);
  assert.doesNotMatch(depsBlock, /\bupdateEcommerceFrameworkRuntime:/);
  assert.doesNotMatch(depsBlock, /\bresolveEcommerceFrameworkId:/);
  assert.doesNotMatch(depsBlock, /\bsyncEcommerceFrameworkView:/);

  const runtimeCall = appSource.match(/useEcommerceRuntime\(\{[\s\S]*?\n  \}\);/)?.[0] ?? '';
  assert.ok(runtimeCall, 'App should call useEcommerceRuntime');
  assert.match(runtimeCall, /\bframeworkStateView,/);
  assert.doesNotMatch(runtimeCall, /\bupdateEcommerceFrameworkRuntime,/);
  assert.doesNotMatch(runtimeCall, /\bresolveEcommerceFrameworkId,/);
  assert.doesNotMatch(runtimeCall, /\bsyncEcommerceFrameworkView,/);
});

test('framework runtime state hook preserves runtime-before-meta and sheet activation ordering', () => {
  const hookSource = readSource('src/app/useEcommerceFrameworkRuntimeState.ts');

  const updateRuntimeStart = hookSource.indexOf('const updateEcommerceFrameworkRuntime = useCallback');
  const syncStart = hookSource.indexOf('const syncEcommerceFrameworkView = useCallback');
  assert.notEqual(updateRuntimeStart, -1);
  assert.notEqual(syncStart, -1);

  const updateRuntimeBody = hookSource.slice(updateRuntimeStart, syncStart);
  const updateRuntimeIndex = updateRuntimeBody.indexOf('ecommerceFrameworkRuntimeRef.current =');
  const setStateIndex = updateRuntimeBody.indexOf('setEcommerceState((previousState)');
  assert.notEqual(updateRuntimeIndex, -1);
  assert.notEqual(setStateIndex, -1);
  assert.ok(updateRuntimeIndex < setStateIndex, 'runtime ref should update before React state');

  const syncBody = hookSource.match(/const syncEcommerceFrameworkView = useCallback[\s\S]*?\n  \}, \[/)?.[0] ?? '';
  assert.ok(syncBody, 'syncEcommerceFrameworkView should be defined in the hook');
  assert.ok(
    syncBody.indexOf('updateEcommerceFrameworkRuntime') < syncBody.indexOf('updateEcommerceFrameworkMeta'),
    'sync should update runtime before framework meta',
  );

  const activateBody = hookSource.match(/const handleActivateEcommerceGroupSheet = useCallback[\s\S]*?\n  \}, \[/)?.[0] ?? '';
  assert.ok(activateBody, 'handleActivateEcommerceGroupSheet should be defined in the hook');
  assert.ok(
    activateBody.indexOf('setEcommerceState') < activateBody.indexOf('syncEcommerceFrameworkView'),
    'sheet activation should update active task/sheet state before syncing framework view',
  );
});
