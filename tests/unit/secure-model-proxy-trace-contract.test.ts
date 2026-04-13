import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('secure proxy requests preserve optional request tracing metadata', () => {
  const contractsSource = readFileSync(path.join(ROOT_DIR, 'packages', 'contracts', 'src', 'dto', 'generation.ts'), 'utf-8');
  const secureProxyClientSource = readSource('src/services/model/secureModelProxy.ts');
  const llmServiceSource = readSource('src/services/llm/LLMService.ts');
  const edgeProxySource = readSource('supabase/functions/secure-model-proxy/index.ts');

  assert.match(
    contractsSource,
    /export interface SecureProxyChatRequestDto extends SecureProxyRouteSelectionDto \{\s*modelId: string;\s*messages: SecureProxyChatMessageDto\[];\s*temperature\?: number;\s*maxTokens\?: number;\s*stream\?: boolean;\s*requestId\?: string;\s*attemptId\?: string;\s*\}/,
  );
  assert.match(
    contractsSource,
    /export interface SecureProxyImageRequestDto extends SecureProxyRouteSelectionDto \{\s*modelId: string;\s*prompt: string;\s*aspectRatio\?: string;\s*imageSize\?: string;\s*imageCount\?: number;\s*referenceImages\?: SecureProxyImageReferenceDto\[];\s*requestId\?: string;\s*attemptId\?: string;\s*\}/,
  );
  assert.match(
    contractsSource,
    /export interface SecureProxyTaskTransportDto extends SecureProxyTransportResultDto \{\s*taskId\?: string;\s*status\?: SecureProxyTaskStatus;\s*url\?: string;\s*requestId\?: string;\s*attemptId\?: string;\s*\}/,
  );
  assert.match(secureProxyClientSource, /requestId\?: string;/);
  assert.match(secureProxyClientSource, /attemptId\?: string;/);
  assert.match(secureProxyClientSource, /export interface SecureProxyTaskStatusResponse extends SecureProxyBillingMetadata \{\s*status: 'pending' \| 'success' \| 'failed';\s*url\?: string;\s*requestId\?: string;\s*attemptId\?: string;\s*\}/);
  assert.match(llmServiceSource, /requestId: options\.requestId,/);
  assert.match(llmServiceSource, /attemptId: this\.deriveAttemptId\(options\.requestId\),/);
  assert.match(edgeProxySource, /requestId\?: string;/);
  assert.match(edgeProxySource, /attemptId\?: string;/);
  assert.match(edgeProxySource, /const requestTraceId = String\(body\.requestId \|\| body\.attemptId \|\| ''\)\.trim\(\);/);
  assert.match(edgeProxySource, /type EncodedSystemTask = \{[\s\S]*requestId\?: string;[\s\S]*attemptId\?: string;[\s\S]*\};/);
  assert.match(edgeProxySource, /type EncodedUserTask = \{[\s\S]*requestId\?: string;[\s\S]*attemptId\?: string;[\s\S]*\};/);
  assert.match(edgeProxySource, /requestId: typeof parsed\.requestId === 'string' \? parsed\.requestId : undefined,/);
  assert.match(edgeProxySource, /attemptId: typeof parsed\.attemptId === 'string' \? parsed\.attemptId : undefined,/);
  assert.match(edgeProxySource, /requestId: body\.requestId,\s*attemptId: body\.attemptId,/);
  assert.match(edgeProxySource, /const taskTraceId = String\(taskPayload\.requestId \|\| taskPayload\.attemptId \|\| ''\)\.trim\(\);/);
  assert.match(edgeProxySource, /console\.log\('\[secure-model-proxy\] task trace', \{/);
  assert.match(edgeProxySource, /requestId: taskPayload\.requestId,\s*attemptId: taskPayload\.attemptId,/);
});
