import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('local model proxy services preserve request tracing metadata across hosted and local task paths', () => {
  const localSystemSource = readSource('apps/api/src/modules/model-proxy/application/local-system-proxy-service.ts');
  const localUserRouteSource = readSource('apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts');
  const localUserRouteTaskTokenSource = readSource('apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts');

  assert.match(localSystemSource, /requestId\?: string;/);
  assert.match(localSystemSource, /attemptId\?: string;/);
  assert.match(localSystemSource, /const requestId = String\(input\.requestId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localSystemSource, /const attemptId = String\(input\.attemptId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localSystemSource, /const directRequest: LocalUserRouteProxyRequest = \{[\s\S]*requestId,[\s\S]*attemptId,[\s\S]*\};/);
  assert.match(localSystemSource, /this\.encodeTaskToken\(\{[\s\S]*requestId,[\s\S]*attemptId,[\s\S]*\}\)/);
  assert.match(localSystemSource, /requestId: taskPayload\.requestId \|\| input\.requestId,/);
  assert.match(localSystemSource, /attemptId: taskPayload\.attemptId \|\| input\.attemptId,/);

  assert.match(localUserRouteSource, /requestId\?: string;/);
  assert.match(localUserRouteSource, /attemptId\?: string;/);
  assert.match(localUserRouteTaskTokenSource, /export type LocalUserRouteTaskPayload = \{[\s\S]*requestId\?: string;[\s\S]*attemptId\?: string;[\s\S]*\};/);
  assert.match(localUserRouteSource, /let decodedTask: LocalUserRouteTaskPayload \| undefined;/);
  assert.match(localUserRouteSource, /const requestId = String\(input\.requestId \|\| decodedTask\?\.requestId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localUserRouteSource, /const attemptId = String\(input\.attemptId \|\| decodedTask\?\.attemptId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localUserRouteSource, /taskId: upstreamTaskId \|\| input\.taskId,[\s\S]*requestId,[\s\S]*attemptId,/);
  assert.match(localUserRouteSource, /this\.encodeLocalTaskToken\(\{[\s\S]*requestId: videoResponse\.requestId \|\| requestId,[\s\S]*attemptId: videoResponse\.attemptId \|\| attemptId,[\s\S]*\}\)/);
  assert.match(localUserRouteSource, /requestId: videoResponse\.requestId \|\| requestId,/);
  assert.match(localUserRouteSource, /attemptId: videoResponse\.attemptId \|\| attemptId,/);
  assert.match(localUserRouteSource, /requestId: input\.requestId,/);
  assert.match(localUserRouteSource, /attemptId: input\.attemptId,/);
  assert.match(localUserRouteSource, /requestId: taskResponse\.requestId \|\| requestId,/);
  assert.match(localUserRouteSource, /attemptId: taskResponse\.attemptId \|\| attemptId,/);
  assert.match(localUserRouteSource, /requestId: downloadResponse\.requestId \|\| requestId,/);
  assert.match(localUserRouteSource, /attemptId: downloadResponse\.attemptId \|\| attemptId,/);
});
