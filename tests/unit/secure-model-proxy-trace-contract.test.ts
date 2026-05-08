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
  const localSystemProxySource = readSource('apps/api/src/modules/model-proxy/application/local-system-proxy-service.ts');
  const localUserRouteSource = readSource('apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts');
  const localUserRouteTaskTokenSource = readSource('apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts');

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
  assert.match(localSystemProxySource, /requestId\?: string;/);
  assert.match(localSystemProxySource, /attemptId\?: string;/);
  assert.match(localSystemProxySource, /type SystemTaskPayload = \{[\s\S]*requestId\?: string;[\s\S]*attemptId\?: string;[\s\S]*\};/);
  assert.match(localSystemProxySource, /const requestId = String\(input\.requestId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localSystemProxySource, /const attemptId = String\(input\.attemptId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localSystemProxySource, /requestId,[\s\S]*attemptId,[\s\S]*\}\),/);
  assert.match(localSystemProxySource, /requestId: taskPayload\.requestId \|\| input\.requestId,/);
  assert.match(localSystemProxySource, /attemptId: taskPayload\.attemptId \|\| input\.attemptId,/);
  assert.match(localUserRouteTaskTokenSource, /export type LocalUserRouteTaskPayload = \{[\s\S]*requestId\?: string;[\s\S]*attemptId\?: string;[\s\S]*\};/);
  assert.match(localUserRouteSource, /requestId: taskResponse\.requestId \|\| requestId,/);
  assert.match(localUserRouteSource, /attemptId: taskResponse\.attemptId \|\| attemptId,/);
});
