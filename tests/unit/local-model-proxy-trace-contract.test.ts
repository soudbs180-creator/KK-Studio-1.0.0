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

  assert.match(localSystemSource, /requestId\?: string;/);
  assert.match(localSystemSource, /attemptId\?: string;/);
  assert.match(localSystemSource, /const requestId = String\(input\.requestId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localSystemSource, /const attemptId = String\(input\.attemptId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localSystemSource, /if \(requestId\) \{\s*payload\.requestId = requestId;\s*\}/);
  assert.match(localSystemSource, /if \(attemptId\) \{\s*payload\.attemptId = attemptId;\s*\}/);

  assert.match(localUserRouteSource, /requestId\?: string;/);
  assert.match(localUserRouteSource, /attemptId\?: string;/);
  assert.match(localUserRouteSource, /type LocalTaskPayload = \{[\s\S]*requestId\?: string;[\s\S]*attemptId\?: string;[\s\S]*\};/);
  assert.match(localUserRouteSource, /let decodedTask: LocalTaskPayload \| undefined;/);
  assert.match(localUserRouteSource, /const requestId = String\(input\.requestId \|\| decodedTask\?\.requestId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localUserRouteSource, /const attemptId = String\(input\.attemptId \|\| decodedTask\?\.attemptId \|\| ""\)\.trim\(\) \|\| undefined;/);
  assert.match(localUserRouteSource, /if \(requestId\) \{\s*payload\.requestId = requestId;\s*\}/);
  assert.match(localUserRouteSource, /if \(attemptId\) \{\s*payload\.attemptId = attemptId;\s*\}/);
  assert.match(localUserRouteSource, /requestId: videoResponse\.requestId \|\| requestId,/);
  assert.match(localUserRouteSource, /attemptId: videoResponse\.attemptId \|\| attemptId,/);
  assert.match(localUserRouteSource, /requestId: input\.requestId,/);
  assert.match(localUserRouteSource, /attemptId: input\.attemptId,/);
  assert.match(localUserRouteSource, /requestId: taskResponse\.requestId \|\| requestId,/);
  assert.match(localUserRouteSource, /attemptId: taskResponse\.attemptId \|\| attemptId,/);
});
