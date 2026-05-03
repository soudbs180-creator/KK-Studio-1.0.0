import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type ChannelConfigSecretsModule = {
  getRedactedChannelConfigApiKey: () => '';
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadChannelConfigSecrets(): Promise<ChannelConfigSecretsModule> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerChannelConfigSecrets.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerChannelConfigSecrets.ts must exist');
  return await import('../../src/services/auth/keyManagerChannelConfigSecrets.ts') as ChannelConfigSecretsModule;
}

test('channel config api key redaction lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const helperSource = readSource('src/services/auth/keyManagerChannelConfigSecrets.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-channel-config-secrets-contract\.test\.ts/);
  assert.match(helperSource, /export function getRedactedChannelConfigApiKey/);
  assert.match(keyManagerSource, /from '\.\/keyManagerChannelConfigSecrets';/);
  assert.doesNotMatch(keyManagerSource, /apiKey:\s*'',/);
  assert.equal((keyManagerSource.match(/apiKey: getRedactedChannelConfigApiKey\(\),/g) || []).length, 2);
});

test('channel config api key redaction never exposes stored secrets', async () => {
  const { getRedactedChannelConfigApiKey } = await loadChannelConfigSecrets();

  assert.equal(getRedactedChannelConfigApiKey(), '');
});
