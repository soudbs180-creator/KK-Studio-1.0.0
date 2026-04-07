import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('secure system proxy transports expose verifiable billing metadata and the caller requires it', () => {
  const dtoSource = readSource('packages/contracts/src/dto/generation.ts');
  const secureProxyClientSource = readSource('src/services/model/secureModelProxy.ts');
  const modelCallerSource = readSource('src/services/model/modelCaller.ts');
  const edgeProxySource = readSource('supabase/functions/secure-model-proxy/index.ts');

  assert.match(
    dtoSource,
    /export interface SecureProxyTransportResultDto \{[\s\S]*ledgerId\?: string;[\s\S]*balanceAfter\?: number;[\s\S]*\}/,
  );
  assert.match(secureProxyClientSource, /ledgerId\?: string;/);
  assert.match(secureProxyClientSource, /balanceAfter\?: number;/);
  assert.match(
    secureProxyClientSource,
    /ledgerId: typeof data\.ledgerId === 'string' \? data\.ledgerId : undefined,/,
  );
  assert.match(
    secureProxyClientSource,
    /balanceAfter: typeof data\.balanceAfter === 'number' \? data\.balanceAfter : undefined,/,
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
  assert.match(
    secureProxyClientSource,
    /if \(localSessionState !== 'valid' \|\| !shouldUseLocalUserRouteApi\(\)\) \{/,
  );
  assert.match(
    edgeProxySource,
    /const balanceAfter = Number\(consumeResult\?\.new_balance \?\? currentBalance - requiredCredits\);/,
  );
  assert.match(
    edgeProxySource,
    /const billingResult = \{\s*deducted: true,\s*ledgerId: transactionId,\s*balanceAfter: Number\.isFinite\(balanceAfter\) \? balanceAfter : undefined,\s*\};/,
  );
  assert.match(edgeProxySource, /return json\(\{\s*success: true,\s*content,\s*usage,\s*endpointType,\s*\.\.\.billingResult,\s*\}\);/);
  assert.match(
    edgeProxySource,
    /const taskResultNotReady = \(message = 'Task result is not ready yet'\) => \(\s*body\.mode === 'download_task'\s*\?\s*json\(\{ success: false, error: message \}, 409\)\s*:\s*json\(\{ success: true, status: 'pending', \.\.\.billingResult \}\)\s*\);/,
  );
  assert.match(edgeProxySource, /return json\(\{ success: true, status: 'deleted', \.\.\.billingResult \}\);/);
  assert.match(edgeProxySource, /return json\(\{ success: true, status: 'failed', \.\.\.billingResult \}\);/);
  assert.match(edgeProxySource, /return json\(\{ success: true, status: 'success', url: directUrl, \.\.\.billingResult \}\);/);
});
