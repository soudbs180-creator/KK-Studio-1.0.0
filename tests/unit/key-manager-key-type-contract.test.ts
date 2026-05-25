import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type KeyManagerKeyTypeModule = {
  determineKeyType: (provider: string, baseUrl?: string) => 'official' | 'proxy' | 'third-party';
};



async function loadKeyTypeModule(): Promise<KeyManagerKeyTypeModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/services/auth/keyManagerKeyType.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/services/auth/keyManagerKeyType.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerKeyType.ts') as KeyManagerKeyTypeModule;
}

test('keyManager key type boundary removes the effective-slot back edge', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const helperSource = readSource('apps/web/src/services/auth/keyManagerKeyType.ts');
  const effectiveSlotSource = readSource('apps/web/src/services/auth/keyManagerEffectiveSlot.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-key-type-contract\.test\.ts/);
  assert.match(keyManagerSource, /import \{ determineKeyType \} from '\.\/keyManagerKeyType';/);
  assert.match(keyManagerSource, /export \{ determineKeyType \} from '\.\/keyManagerKeyType';/);
  assert.match(helperSource, /import \{ resolveProviderKeyType \} from '\.\.\/api\/providerStrategy\.ts';/);
  assert.match(helperSource, /export function determineKeyType/);
  assert.doesNotMatch(keyManagerSource, /export function determineKeyType/);
  assert.match(effectiveSlotSource, /import \{ determineKeyType \} from "\.\/keyManagerKeyType";/);
  assert.doesNotMatch(effectiveSlotSource, /from "\.\/keyManager"/);
});

test('keyManager key type helper preserves provider key classification behavior', async () => {
  const { determineKeyType } = await loadKeyTypeModule();

  assert.equal(determineKeyType('Custom', 'https://generativelanguage.googleapis.com/v1beta'), 'official');
  assert.equal(determineKeyType('Google', 'https://api.newapi.pro/v1'), 'proxy');
  assert.equal(determineKeyType('OpenAI Official'), 'official');
  assert.equal(determineKeyType('Custom', 'https://example.com/v1'), 'third-party');
});
