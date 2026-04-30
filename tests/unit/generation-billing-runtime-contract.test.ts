import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('frontend generation flow uses the shared billing coordinator and persists attempt ids on prompt nodes', () => {
  const appSource = readSource('src/App.tsx');
  const generationRuntimeSource = readSource('src/app/useGenerationRuntime.ts');
  const retryHelperSource = readSource('src/app/prepareRetriedExecutionNode.ts');
  const generationHookSource = readSource('src/hooks/useImageGeneration.ts');
  const billingContextSource = readSource('src/context/BillingContext.tsx');
  const typesSource = readSource('src/types.ts');
  const billingAttemptCallCount =
    (appSource.split('buildGenerationBillingAttempt(').length - 1)
    + (generationRuntimeSource.split('buildGenerationBillingAttempt(').length - 1)
    + (retryHelperSource.split('buildGenerationBillingAttempt(').length - 1);

  assert.match(appSource, /from '\.\/services\/billing\/generationBillingCoordinator';/);
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
  assert.match(typesSource, /billingAttemptId\?: string;/);
});

test('system proxy image generation preserves billing metadata through llm and billing contexts', () => {
  const llmAdapterSource = readSource('src/services/llm/LLMAdapter.ts');
  const llmServiceSource = readSource('src/services/llm/LLMService.ts');
  const geminiServiceSource = readSource('src/services/llm/geminiService.ts');
  const billingContextSource = readSource('src/context/BillingContext.tsx');
  const generationHookSource = readSource('src/hooks/useImageGeneration.ts');
  const appSource = readSource('src/App.tsx');

  assert.match(llmAdapterSource, /ledgerId\?: string;/);
  assert.match(llmAdapterSource, /balanceAfter\?: number;/);
  assert.match(llmServiceSource, /ledgerId: response\.ledgerId,/);
  assert.match(llmServiceSource, /balanceAfter: response\.balanceAfter,/);
  assert.match(geminiServiceSource, /ledgerId: result\.ledgerId,/);
  assert.match(geminiServiceSource, /balanceAfter: result\.balanceAfter,/);
  assert.match(billingContextSource, /applyAuthoritativeBalance: \(nextBalance: number\) => void;/);
  assert.match(billingContextSource, /const applyAuthoritativeBalance = useCallback\(\(nextBalance: number\) => \{\s*setBalance\(toDisplayNumber\(nextBalance\)\);\s*\}, \[\]\);/);
  assert.match(generationHookSource, /const \{ refundCreditsByTransaction, refreshBilling, applyAuthoritativeBalance \} = useBilling\(\);/);
  assert.match(generationHookSource, /if \(typeof result\.balanceAfter === 'number'\) \{\s*applyAuthoritativeBalance\(result\.balanceAfter\);\s*\}/);
  assert.match(appSource, /const \{[\s\S]*applyAuthoritativeBalance,[\s\S]*\} = useBilling\(\);/);
  assert.match(appSource, /if \(typeof result\.balanceAfter === 'number'\) \{\s*applyAuthoritativeBalance\(result\.balanceAfter\);\s*\}/);
  assert.match(appSource, /if \(typeof imageResultContext\.balanceAfter === 'number'\) \{\s*applyAuthoritativeBalance\(imageResultContext\.balanceAfter\);\s*\}/);
});
