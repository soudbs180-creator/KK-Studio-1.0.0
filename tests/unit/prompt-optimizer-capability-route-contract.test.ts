import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('prompt optimizer service only uses explicit prompt_optimizer AI enhancement routes', () => {
  const serviceSource = readSource('apps/web/src/services/llm/promptOptimizerService.ts');
  const routingSource = readSource('apps/web/src/services/api/capabilityRouteAssignments.ts');

  assert.match(routingSource, /prompt_optimizer/);
  assert.match(serviceSource, /from '\.\.\/api\/capabilityRouteAssignments';/);
  assert.match(serviceSource, /isCustomRoutingEnabled/);
  assert.match(serviceSource, /resolveCapabilityRouteAssignment\('prompt_optimizer'\)/);
  assert.match(serviceSource, /const optimizerRoute = resolveExplicitOptimizerAiRoute\(\);/);
  assert.match(serviceSource, /usedModelId: LOCAL_RULEBOOK_MODEL_ID/);
  assert.match(serviceSource, /if \(!optimizerRoute\) \{\s*return localResult;\s*\}/);
  assert.match(serviceSource, /if \(!modelId\) \{\s*return localResult;\s*\}/);
  assert.match(serviceSource, /preferredKeyId/);
  assert.match(serviceSource, /keyManager\.getGlobalModelList\(\)/);
  assert.doesNotMatch(serviceSource, /resolveEnabledCapabilityRouteAssignment\('prompt_optimizer'\)/);
});
