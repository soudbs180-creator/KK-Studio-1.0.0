import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce node generation runtime owns node state patches and single-card generation handlers', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceNodeGenerationRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceNodeGenerationRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceNodeGenerationRuntime.ts');
  const ecommerceRuntimeSource = readSource('src/app/useEcommerceRuntime.ts');

  assert.match(hookSource, /export interface EcommerceNodeGenerationRuntimeState \{/);
  assert.match(hookSource, /export type SetEcommerceNodeGenerationRuntimeState = /);
  assert.match(hookSource, /export interface UseEcommerceNodeGenerationRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceNodeGenerationRuntimeResult \{/);
  assert.match(hookSource, /updateEcommerceNodeState: UpdateEcommerceNodeState;/);
  assert.match(hookSource, /runEcommerceNodeGeneration: \(/);
  assert.match(hookSource, /handleGenerateEcommerceNode: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleOptimizeEcommerceTaskPrompt: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleRegenerateUnsatisfiedEcommerceNode: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /handleConfirmEcommerceDesktop: \(node: PromptNode\) => void;/);
  assert.match(hookSource, /handleRetryEcommerceModule: \(node: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /optimizeGenerationPrompt\(\{/);
  assert.match(hookSource, /getModelCapabilities\(latestNode\.model\)/);
  assert.match(hookSource, /buildEcommerceRenderTask\(\{/);
  assert.match(hookSource, /mergeEcommerceTaskState\(\{/);
  assert.match(hookSource, /await handleRetryNode\(executionNode\)/);
  assert.match(hookSource, /desktopStage: 'confirmed'/);
  assert.match(hookSource, /mobileStage: 'pending'/);
  assert.match(hookSource, /generationTarget: 'mobile'/);
  assert.match(hookSource, /promptAssistMode\?: 'auto' \| 'disabled' \| 'regenerate-feedback';/);
  assert.match(hookSource, /resolveLatestGeneratedFeedbackReference/);
  assert.match(hookSource, /regenerateFeedbackPromptSuffix/);
  assert.match(hookSource, /promptAssistMode: node\.ecommerce\.stage === 'failed' \? 'disabled' : undefined/);
  assert.match(hookSource, /promptAssistMode: 'regenerate-feedback'/);
  assert.match(hookSource, /const handleOptimizeEcommerceTaskPrompt = useCallback/);
  assert.match(hookSource, /promptOverride: optimizedPrompt/);
  assert.match(hookSource, /source: optimizedSource/);

  assert.match(appSource, /import \{[\s\S]*?useEcommerceNodeGenerationRuntime,[\s\S]*?type SetEcommerceNodeGenerationRuntimeState[\s\S]*?\} from '\.\/app\/useEcommerceNodeGenerationRuntime';/);
  assert.match(appSource, /const updateEcommerceNodeGenerationRuntimeState = useCallback<SetEcommerceNodeGenerationRuntimeState>/);
  assert.match(appSource, /useEcommerceNodeGenerationRuntime\(\{/);
  assert.match(appSource, /setEcommerceNodeGenerationRuntimeState: updateEcommerceNodeGenerationRuntimeState/);
  assert.match(appSource, /const \{[\s\S]*?updateEcommerceNodeState,[\s\S]*?handleGenerateEcommerceNode,[\s\S]*?handleOptimizeEcommerceTaskPrompt,[\s\S]*?handleRegenerateUnsatisfiedEcommerceNode,[\s\S]*?handleConfirmEcommerceDesktop,[\s\S]*?handleRetryEcommerceModule,[\s\S]*?\} = useEcommerceNodeGenerationRuntime\(\{/);
  assert.match(appSource, /updateEcommerceNodeState,/);
  assert.match(appSource, /handleGenerateEcommerceNode,/);
  assert.match(appSource, /onOptimizeEcommerceTaskPrompt: handleOptimizeEcommerceTaskPrompt/);
  assert.match(appSource, /onRegenerateUnsatisfiedEcommerceNode: handleRegenerateUnsatisfiedEcommerceNode/);
  assert.match(appSource, /handleRetryEcommerceModule,/);
  assert.doesNotMatch(appSource, /const updateEcommerceNodeState = useCallback/);
  assert.doesNotMatch(appSource, /const runEcommerceNodeGeneration = useCallback/);
  assert.doesNotMatch(appSource, /const syncActiveEcommerceTask = useCallback/);
  assert.doesNotMatch(appSource, /const handleOptimizeEcommerceTaskPrompt = useCallback/);
  assert.doesNotMatch(appSource, /const handleGenerateEcommerceNode = useCallback/);
  assert.doesNotMatch(appSource, /const handleConfirmEcommerceDesktop = useCallback/);
  assert.doesNotMatch(appSource, /const handleRetryEcommerceModule = useCallback/);
  assert.doesNotMatch(ecommerceRuntimeSource, /optimizeGenerationPrompt|buildEcommerceRenderTask|mergeEcommerceTaskState/);
});
