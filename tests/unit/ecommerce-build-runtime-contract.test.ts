import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce build runtime owns confirmation and node builders', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceBuildRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceBuildRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceBuildRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceBuildRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceBuildRuntimeResult \{/);
  assert.match(hookSource, /buildEcommerceFrameworkNode/);
  assert.match(hookSource, /buildEcommerceGroupNode/);
  assert.match(hookSource, /buildEcommercePromptNode/);
  assert.match(hookSource, /handleConfirmEcommerceAnalysis:/);
  assert.match(hookSource, /const currentUploadReferences = await buildCurrentEcommerceUploadReferences\(\);/);
  assert.match(hookSource, /buildEcommerceCanvasGroupLayout\(\{/);
  assert.match(hookSource, /buildInitialEcommerceGroupSlotState\(\{/);
  assert.match(hookSource, /createEcommerceFrameworkRuntimeState\(\{/);
  assert.match(hookSource, /const referenceAssetIds = params\.item\.referenceAssetIds \|\| \[\];/);
  assert.match(hookSource, /const referenceMentions = params\.item\.referenceMentions \|\| \[\];/);
  assert.match(hookSource, /reviewWarnings: params\.item\.reviewWarnings \|\| \[\]/);
  assert.match(hookSource, /notify\.success\(\s*pickByDocumentLanguage\('建卡完成', 'Build complete'\)/);
  assert.match(hookSource, /notify\.error\(\s*pickByDocumentLanguage\('建卡失败', 'Build failed'\)/);

  assert.match(appSource, /useEcommerceBuildRuntime\(\{/);
  assert.match(appSource, /setEcommerceBuildRuntimeState: updateEcommerceBuildRuntimeState/);
  assert.doesNotMatch(appSource, /const buildEcommerceFrameworkNode = useCallback/);
  assert.doesNotMatch(appSource, /const buildEcommerceGroupNode = useCallback/);
  assert.doesNotMatch(appSource, /const buildEcommercePromptNode = useCallback/);
  assert.doesNotMatch(appSource, /const handleConfirmEcommerceAnalysis = useCallback/);
});

test('ecommerce build runtime remains separate from upload sync and generation runtime', () => {
  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceBuildRuntime.ts');
  const postBuildSyncSource = readSource('src/app/useEcommercePostBuildSyncRuntime.ts');
  const nodeGenerationSource = readSource('src/app/useEcommerceNodeGenerationRuntime.ts');

  assert.match(appSource, /useEcommercePostBuildSyncRuntime\(\{/);
  assert.match(appSource, /useEcommerceNodeGenerationRuntime\(\{/);
  assert.match(postBuildSyncSource, /if \(!ecommerceState\.analysisConfirmed \|\| !analysis \|\| !activeCanvas\?\.promptNodes\.length\) \{/);
  assert.doesNotMatch(hookSource, /activeCanvas\?\.promptNodes/);
  assert.doesNotMatch(hookSource, /runEcommerceNodeGeneration/);
  assert.doesNotMatch(appSource, /const ecommercePromptNodes = activeCanvas\.promptNodes\.filter/);
  assert.doesNotMatch(postBuildSyncSource, /runEcommerceNodeGeneration/);
  assert.match(nodeGenerationSource, /const runEcommerceNodeGeneration = useCallback/);
});

test('ecommerce build confirmation hands off to one visible canvas framework and resets the composer input state', () => {
  const hookSource = readSource('src/app/useEcommerceBuildRuntime.ts');
  const appSource = readSource('src/App.tsx');

  assert.match(hookSource, /requirementFile: File \| null;/);
  assert.match(hookSource, /productFiles: File\[\];/);
  assert.match(hookSource, /extraReferenceFiles: File\[\];/);
  assert.match(hookSource, /itemReferenceFiles: Record<string, EcommerceManualReferenceBinding\[\]>;/);
  assert.match(hookSource, /hiddenInCanvas: Boolean\(params\.frameworkId\),/);
  assert.match(hookSource, /reportBuildSuccess\(1\);/);
  assert.match(hookSource, /const sharedInputSummary = \[/);
  assert.match(hookSource, /analysis\.projectMeta\.projectName \|\| label/);
  assert.match(hookSource, /analysis\.projectMeta\.productName \? `产品：\$\{analysis\.projectMeta\.productName\}` : ''/);
  assert.match(hookSource, /String\(configPrompt \|\| ''\)\.trim\(\) \? `补充要求：\$\{String\(configPrompt \|\| ''\)\.trim\(\)\}` : ''/);
  assert.match(hookSource, /node\.ecommerce\.frameworkMeta\.inputSummary/);
  assert.match(hookSource, /requirementFile: null,/);
  assert.match(hookSource, /productFiles: \[\],/);
  assert.match(hookSource, /extraReferenceFiles: \[\],/);
  assert.match(hookSource, /itemReferenceFiles: \{\},/);
  assert.match(hookSource, /analysis: null,/);
  assert.match(hookSource, /analysisConfirmed: false,/);
  assert.match(hookSource, /selectedItems: \{\},/);
  assert.match(hookSource, /taskStates: \{\},/);
  assert.match(hookSource, /groupSlots: createBuildResetGroupSlots\(\),/);
  assert.match(hookSource, /activeFrameworkId: null,/);
  assert.match(hookSource, /activeGroupSheet: null,/);

  assert.match(appSource, /requirementFile: previousState\.requirementFile,/);
  assert.match(appSource, /productFiles: previousState\.productFiles,/);
  assert.match(appSource, /extraReferenceFiles: previousState\.extraReferenceFiles,/);
  assert.match(appSource, /itemReferenceFiles: previousState\.itemReferenceFiles,/);
});
