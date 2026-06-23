import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type {
  EnsureCreditAttemptChargedParams,
  EnsureCreditAttemptChargedResult,
  GenerationCreditAttemptNode,
} from '../../apps/web/src/app/useGenerationRuntime.ts';

const ROOT_DIR = process.cwd();

type GenerationBillingRuntimePublicBoundary = {
  attemptParams: EnsureCreditAttemptChargedParams;
  attemptResult: EnsureCreditAttemptChargedResult;
  attemptNode: GenerationCreditAttemptNode;
}



test('frontend generation flow uses the shared billing coordinator and persists attempt ids on prompt nodes', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const generationRuntimeSource = readSource('apps/web/src/app/useGenerationRuntime.ts');
  const retryHelperSource = readSource('apps/web/src/app/prepareRetriedExecutionNode.ts');
  const generationHookSource = readSource('apps/web/src/hooks/useImageGeneration.ts');
  const billingContextSource = readSource('apps/web/src/context/BillingContext.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');
  const typesSource = readSource('apps/web/src/types.ts');
  const boundaryIsTypechecked: GenerationBillingRuntimePublicBoundary | null = null;
  const billingAttemptCallCount =
    (generationRuntimeSource.split('buildGenerationBillingAttempt(').length - 1)
    + (retryHelperSource.split('buildGenerationBillingAttempt(').length - 1);

  assert.equal(boundaryIsTypechecked, null);
  assert.doesNotMatch(appSource, /from '\.\/services\/billing\/generationBillingCoordinator';/);
  assert.ok(billingAttemptCallCount >= 2);
  assert.match(generationRuntimeSource, /billingAttemptId: params\.billingAttempt\.attemptId,/);
  assert.match(retryHelperSource, /from '\.\.\/services\/billing\/generationBillingCoordinator';/);
  assert.match(retryHelperSource, /billingAttemptId: billingAttempt\.attemptId,/);
  assert.match(generationRuntimeSource, /attemptId: params\.billingAttempt\?\.attemptId,/);
  assert.match(generationRuntimeSource, /businessRefId: params\.billingAttempt\?\.businessRefId,/);
  assert.match(generationRuntimeSource, /idempotencyKey: params\.billingAttempt\?\.idempotencyKey,/);

  assert.match(generationHookSource, /from '\.\.\/services\/billing\/generationBillingCoordinator';/);
  assert.match(generationHookSource, /const currentRequestId = buildGenerationAttemptRequestId\(/);
  assert.match(generationHookSource, /const resolveFailedBillingState = useCallback\(async \(/);
  assert.match(generationHookSource, /const failureState = await resolveGenerationAttemptFailureState\(/);

  assert.match(billingContextSource, /const attemptId = String\(details\?\.attemptId \|\| ''\)\.trim\(\);/);
  assert.match(billingContextSource, /buildGenerationAttemptIdempotencyKey\(attemptId\)/);
  assert.match(generationRuntimeSource, /export interface EnsureCreditAttemptChargedParams \{/);
  assert.match(generationRuntimeSource, /export type EnsureCreditAttemptChargedResult =/);
  assert.match(generationRuntimeSource, /export type GenerationCreditAttemptNode = Pick</);
  assert.match(testConfigSource, /tests\/unit\/generation-billing-runtime-contract\.test\.ts/);
  assert.match(typesSource, /billingAttemptId\?: string;/);
});

test('system proxy image generation preserves billing metadata through llm and billing contexts', () => {
  const llmAdapterSource = readSource('apps/web/src/services/llm/LLMAdapter.ts');
  const llmServiceSource = readSource('apps/web/src/services/llm/generationService.ts');
  const billingContextSource = readSource('apps/web/src/context/BillingContext.tsx');
  const generationHookSource = readSource('apps/web/src/hooks/useImageGeneration.ts');
  const generationRuntimeSource = readSource('apps/web/src/app/useGenerationRuntime.ts');
  const appSource = readSource('apps/web/src/App.tsx');

  assert.match(llmAdapterSource, /ledgerId\?: string;/);
  assert.match(llmAdapterSource, /balanceAfter\?: number;/);
  assert.match(llmServiceSource, /ledgerId: response\.ledgerId,/);
  assert.match(llmServiceSource, /balanceAfter: response\.balanceAfter,/);
  assert.match(llmServiceSource, /ledgerId: result\.ledgerId,/);
  assert.match(llmServiceSource, /balanceAfter: result\.balanceAfter,/);
  assert.match(billingContextSource, /applyAuthoritativeBalance: \(nextBalance: number\) => void;/);
  assert.match(billingContextSource, /const applyAuthoritativeBalance = useCallback\(\(nextBalance: number\) => \{\s*setBalance\(toDisplayNumber\(nextBalance\)\);\s*\}, \[\]\);/);
  assert.match(generationHookSource, /const \{ refundCreditsByTransaction, refreshBilling, applyAuthoritativeBalance \} = useBilling\(\);/);
  assert.match(generationHookSource, /if \(typeof result\.balanceAfter === 'number'\) \{\s*applyAuthoritativeBalance\(result\.balanceAfter\);\s*\}/);
  assert.match(appSource, /const \{[\s\S]*applyAuthoritativeBalance,[\s\S]*\} = useBilling\(\);/);
  assert.match(appSource, /useGenerationRuntime\(\{[\s\S]*applyAuthoritativeBalance,[\s\S]*\}\);/);
  assert.match(generationRuntimeSource, /if \(typeof params\.generatedMediaContext\.balanceAfter === 'number'\) \{\s*params\.applyAuthoritativeBalance\(params\.generatedMediaContext\.balanceAfter\);\s*\}/);
  assert.match(generationRuntimeSource, /if \(typeof result\.balanceAfter === 'number'\) \{\s*applyAuthoritativeBalance\(result\.balanceAfter\);\s*\}/);
  assert.match(generationRuntimeSource, /applyRetryGeneratedMediaAuthoritativeBalance\(\{[\s\S]*generatedMediaContext: requestResult\.generatedMediaContext,[\s\S]*applyAuthoritativeBalance: params\.applyAuthoritativeBalance,[\s\S]*\}\);/);
  assert.match(generationRuntimeSource, /runRetryGeneratedMediaAttempts\(\{[\s\S]*applyAuthoritativeBalance: params\.applyAuthoritativeBalance,[\s\S]*\}\);/);
  assert.match(appSource, /completeRetryGeneratedMediaBatch\(\{[\s\S]*applyAuthoritativeBalance,[\s\S]*\}\);/);
  assert.doesNotMatch(appSource, /runRetryGeneratedMediaAttempts\(\{/);
  assert.doesNotMatch(appSource, /applyRetryGeneratedMediaAuthoritativeBalance\(\{/);
});
