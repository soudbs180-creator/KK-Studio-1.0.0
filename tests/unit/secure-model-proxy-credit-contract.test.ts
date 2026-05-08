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
  const localSystemProxySource = readSource('apps/api/src/modules/model-proxy/application/local-system-proxy-service.ts');

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
    localSystemProxySource,
    /const idempotencyKey = requestId \|\| attemptId \|\| `\$\{baseModelId\}:\$\{Date\.now\(\)\}`;/,
  );
  assert.match(
    localSystemProxySource,
    /const debit = await this\.creditAccountService\.debitCredits\(/,
  );
  assert.match(
    localSystemProxySource,
    /businessRefType: "system_model_proxy",/,
  );
  assert.match(
    localSystemProxySource,
    /businessRefId,/,
  );
  assert.match(
    localSystemProxySource,
    /creditAmount: selected\.requiredCredits,/,
  );
  assert.match(
    localSystemProxySource,
    /modelCode: baseModelId,/,
  );
  assert.match(
    localSystemProxySource,
    /idempotencyKey,/,
  );
  assert.match(
    localSystemProxySource,
    /enrichTransportWithDebit\(\s*response,\s*debitData\.ledgerId,\s*debitData\.balanceAfter,\s*\)/,
  );
  assert.match(
    localSystemProxySource,
    /const refund = await this\.refundCredits\(userId, debitData\.ledgerId, "system_route_request_failed"\);/,
  );
  assert.match(
    localSystemProxySource,
    /refundApplied: refund\.applied,/,
  );
  assert.match(
    localSystemProxySource,
    /refundBalanceAfter: refund\.balanceAfter,/,
  );
  assert.match(
    localSystemProxySource,
    /const shouldRefundOnFailure = \(/,
  );
  assert.match(
    localSystemProxySource,
    /"system_route_task_cancelled" : "system_route_task_failed"/,
  );
  assert.match(
    localSystemProxySource,
    /appendRefundMetadata\(billedResponse, refund\)/,
  );
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
