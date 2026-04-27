import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt optimizer service reads the dedicated prompt_optimizer capability route before falling back to the global model list', () => {
  const serviceSource = readSource('src/services/llm/promptOptimizerService.ts');
  const routingSource = readSource('src/services/api/capabilityRouteAssignments.ts');

  assert.match(routingSource, /prompt_optimizer/);
  assert.match(serviceSource, /from '\.\.\/api\/capabilityRouteAssignments';/);
  assert.match(serviceSource, /resolveCapabilityRouteAssignment\('prompt_optimizer'\)/);
  assert.match(serviceSource, /preferredKeyId/);
  assert.match(serviceSource, /keyManager\.getGlobalModelList\(\)/);
});
