import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('secure system proxy transports expose verifiable billing metadata and the caller requires it', () => {
  const contractsIndexSource = readFileSync(path.join(ROOT_DIR, 'packages', 'contracts', 'src', 'index.ts'), 'utf-8');
  const secureProxyClientSource = readSource('src/services/model/secureModelProxy.ts');
  const modelCallerSource = readSource('src/services/model/modelCaller.ts');
  const llmAdapterSource = readSource('src/services/llm/LLMAdapter.ts');
  const llmServiceSource = readSource('src/services/llm/LLMService.ts');
  const geminiServiceSource = readSource('src/services/llm/geminiService.ts');
  const contractsGenerationSource = readFileSync(path.join(ROOT_DIR, 'packages', 'contracts', 'src', 'dto', 'generation.ts'), 'utf-8');
  const edgeProxySource = readSource('supabase/functions/secure-model-proxy/index.ts');

  assert.match(
    contractsIndexSource,
    /export \* from "\.\/dto\/generation\.ts";/,
  );
  assert.match(secureProxyClientSource, /ledgerId\?: string;/);
  assert.match(secureProxyClientSource, /balanceAfter\?: number;/);
  assert.match(secureProxyClientSource, /refundApplied\?: boolean;/);
  assert.match(secureProxyClientSource, /refundBalanceAfter\?: number;/);
  assert.match(contractsGenerationSource, /refundApplied\?: boolean;/);
  assert.match(contractsGenerationSource, /refundBalanceAfter\?: number;/);
  assert.match(
    secureProxyClientSource,
    /ledgerId: typeof data\.ledgerId === 'string' \? data\.ledgerId : undefined,/,
  );
  assert.match(
    secureProxyClientSource,
    /balanceAfter: typeof data\.balanceAfter === 'number' \? data\.balanceAfter : undefined,/,
  );
  assert.match(
    secureProxyClientSource,
    /refundApplied: data\.refundApplied === true,/,
  );
  assert.match(
    secureProxyClientSource,
    /refundBalanceAfter: typeof data\.refundBalanceAfter === 'number' \? data\.refundBalanceAfter : undefined,/,
  );
  assert.match(
    modelCallerSource,
    /const hasConfirmedCreditSettlement = Boolean\(response\.ledgerId && typeof response\.balanceAfter === 'number'\);/,
  );
  assert.match(modelCallerSource, /if \(!response\.deducted\) \{/);
  assert.match(modelCallerSource, /if \(!hasConfirmedCreditSettlement\) \{\s*console\.warn\(/);
  assert.doesNotMatch(
    modelCallerSource,
    /if \(!response\.deducted \|\| !response\.ledgerId \|\| typeof response\.balanceAfter !== 'number'\) \{/,
  );
  assert.doesNotMatch(secureProxyClientSource, /function getSecureProxyEndpoint\(/);
  assert.doesNotMatch(secureProxyClientSource, /supabaseAnonKey/);
  assert.doesNotMatch(secureProxyClientSource, /if \(localSessionState !== 'valid' \|\| !shouldUseLocalUserRouteApi\(\)\) \{/);
  assert.match(
    edgeProxySource,
    /const debitIdempotencyKey = String\(body\.attemptId \|\| body\.requestId \|\| crypto\.randomUUID\(\)\)\.trim\(\);/,
  );
  assert.match(
    edgeProxySource,
    /serviceClient\.rpc\('api_record_credit_debit_v1', \{/,
  );
  assert.match(
    edgeProxySource,
    /p_ledger_id: crypto\.randomUUID\(\),/,
  );
  assert.match(
    edgeProxySource,
    /p_business_ref_type: 'generation_task',/,
  );
  assert.match(
    edgeProxySource,
    /p_business_ref_id: debitBusinessRefId,/,
  );
  assert.match(
    edgeProxySource,
    /p_idempotency_key: debitIdempotencyKey,/,
  );
  assert.match(
    edgeProxySource,
    /const balanceAfter = Number\(consumePayload\?\.ledger\?\.balance_after \?\? currentBalance - requiredCredits\);/,
  );
  assert.match(
    edgeProxySource,
    /const billingResult = \{\s*deducted: true,\s*ledgerId: transactionId,\s*balanceAfter: Number\.isFinite\(balanceAfter\) \? balanceAfter : undefined,[\s\S]*\};/,
  );
  assert.match(
    edgeProxySource,
    /const refundTaskCredits = async \(\s*reason: string,\s*\): Promise<\{ success: boolean; message\?: string; balanceAfter\?: number \}> => \{/,
  );
  assert.match(
    edgeProxySource,
    /balanceAfter: typeof refundResult\?\.new_balance === 'number' \? refundResult\.new_balance : undefined,/,
  );
  assert.match(
    edgeProxySource,
    /const refundedBillingResult = \(refundResult: \{ success: boolean; message\?: string; balanceAfter\?: number \}\) => \(\{/,
  );
  assert.match(edgeProxySource, /return json\(\{\s*success: true,\s*content,\s*usage,\s*endpointType,\s*\.\.\.billingResult,\s*\}\);/);
  assert.match(
    edgeProxySource,
    /const taskResultNotReady = \(message = 'Task result is not ready yet'\) => \(\s*body\.mode === 'download_task'\s*\?\s*json\(\{ success: false, error: message \}, 409\)\s*:\s*json\(\{ success: true, status: 'pending', \.\.\.billingResult \}\)\s*\);/,
  );
  assert.match(edgeProxySource, /return json\(\{ success: true, status: 'deleted', \.\.\.billingResult \}\);/);
  assert.match(edgeProxySource, /return json\(\{ success: true, status: 'failed', \.\.\.refundedBillingResult\(refundResult\) \}\);/);
  assert.match(edgeProxySource, /return json\(\{ success: true, status: 'success', url: directUrl, \.\.\.billingResult \}\);/);
  assert.match(llmAdapterSource, /deducted\?: boolean;/);
  assert.match(llmAdapterSource, /ledgerId\?: string;/);
  assert.match(llmAdapterSource, /balanceAfter\?: number;/);
  assert.match(
    llmServiceSource,
    /deducted: response\.deducted,\s*ledgerId: response\.ledgerId,\s*balanceAfter: response\.balanceAfter,/,
  );
  assert.match(
    geminiServiceSource,
    /deducted: result\.deducted,\s*ledgerId: result\.ledgerId,\s*balanceAfter: result\.balanceAfter,/,
  );
});
