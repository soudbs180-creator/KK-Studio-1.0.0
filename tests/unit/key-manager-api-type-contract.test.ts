import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type DetectApiType = (apiKey: string, baseUrl?: string) => 'google-official' | 'openai' | 'proxy' | 'unknown';



async function loadApiTypeHelper(): Promise<{ detectApiType: DetectApiType }> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/services/auth/keyManagerApiType.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/services/auth/keyManagerApiType.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerApiType.ts') as { detectApiType: DetectApiType };
}

test('keyManager API type detection boundary lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const helperSource = readSource('apps/web/src/services/auth/keyManagerApiType.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-api-type-contract\.test\.ts/);
  assert.match(keyManagerSource, /import \{ detectApiType \} from '\.\/keyManagerApiType(?:\.ts)?';/);
  assert.match(keyManagerSource, /export \{ detectApiType \} from '\.\/keyManagerApiType(?:\.ts)?';/);
  assert.doesNotMatch(keyManagerSource, /export function detectApiType/);
  assert.match(keyManagerSource, /const apiType = detectApiType\(apiKey, baseUrl\);/);
  assert.match(helperSource, /export function detectApiType/);
  assert.doesNotMatch(helperSource, /from ['"]\.\/keyManager(?:['"]|\.ts['"])/);
  assert.doesNotMatch(helperSource, /fetch\(|localStorage|providerPersistence|cloudSync|keyStorage|createBrowserDirectProviderChecksDisabledError/);
});

test('keyManager API type detection preserves historical string matching behavior', async () => {
  const { detectApiType } = await loadApiTypeHelper();

  assert.equal(detectApiType('AIza-test'), 'google-official');
  assert.equal(detectApiType('anything', 'https://generativelanguage.googleapis.com'), 'google-official');
  assert.equal(detectApiType('anything', 'https://api.googleapis.com/custom'), 'google-official');
  assert.equal(detectApiType('sk-test'), 'openai');
  assert.equal(detectApiType('sk-test', 'https://api.openai.com/v1'), 'openai');
  assert.equal(detectApiType('sk-test', 'https://proxy.example.com/v1'), 'proxy');
  assert.equal(detectApiType('anything', 'https://proxy.example.com/v1'), 'proxy');
  assert.equal(detectApiType('anything', '   '), 'proxy');
  assert.equal(detectApiType('', ''), 'unknown');
  assert.equal(detectApiType('sk-test', 'HTTPS://API.OPENAI.COM'), 'proxy');
  assert.equal(detectApiType('anything', 'HTTPS://GENERATIVELANGUAGE.GOOGLEAPIS.COM'), 'proxy');
});
