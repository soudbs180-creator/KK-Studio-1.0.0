import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type ChannelConfigSecretsModule = {
  getRedactedChannelConfigApiKey: () => '';
};

type KeyUpdateDiagnosticsModule = {
  buildKeyUpdateDiagnosticPayload: (
    id: string,
    updates: Record<string, unknown>,
    supportedModelsBefore: unknown,
  ) => {
    id: string;
    updatedFields: string[];
    hasKeyUpdate: boolean;
    hasSupportedModelsUpdate: boolean;
    supportedModelsBefore: unknown;
  };
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

async function loadKeyUpdateDiagnostics(): Promise<KeyUpdateDiagnosticsModule> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerUpdateDiagnostics.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerUpdateDiagnostics.ts must exist');
  return await import('../../src/services/auth/keyManagerUpdateDiagnostics.ts') as KeyUpdateDiagnosticsModule;
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

test('updateKey diagnostic payload does not expose raw secret updates', async () => {
  const { buildKeyUpdateDiagnosticPayload } = await loadKeyUpdateDiagnostics();

  const payload = buildKeyUpdateDiagnosticPayload(
    'slot-1',
    {
      key: 'sk-live-secret',
      apiKey: 'vendor-secret',
      provider: 'OpenAI',
      supportedModels: ['gpt-4o'],
    },
    ['old-model'],
  );
  const serialized = JSON.stringify(payload);

  assert.deepEqual(payload.updatedFields, ['apiKey', 'key', 'provider', 'supportedModels']);
  assert.equal(payload.hasKeyUpdate, true);
  assert.equal(payload.hasSupportedModelsUpdate, true);
  assert.deepEqual(payload.supportedModelsBefore, ['old-model']);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'updates'), false);
  assert.equal(serialized.includes('sk-live-secret'), false);
  assert.equal(serialized.includes('vendor-secret'), false);
});

test('updateKey diagnostic payload classifies every supported secret field without logging values', async () => {
  const { buildKeyUpdateDiagnosticPayload } = await loadKeyUpdateDiagnostics();
  const secretFields = ['key', 'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken'];

  for (const field of secretFields) {
    const payload = buildKeyUpdateDiagnosticPayload('slot-1', { [field]: `${field}-value` }, []);
    const serialized = JSON.stringify(payload);

    assert.equal(payload.hasKeyUpdate, true);
    assert.deepEqual(payload.updatedFields, [field]);
    assert.equal(serialized.includes(`${field}-value`), false);
  }
});

test('updateKey logs only the redacted diagnostic payload', () => {
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const updateKeyBodyMatch = keyManagerSource.match(/async updateKey\(id: string, updates: Partial<KeySlot>\): Promise<void> \{[\s\S]*?const slot = this\.state\.slots\.find/);

  assert.ok(updateKeyBodyMatch, 'updateKey body must remain source-contractable');
  assert.match(keyManagerSource, /from '\.\/keyManagerUpdateDiagnostics';/);
  assert.match(updateKeyBodyMatch[0], /buildKeyUpdateDiagnosticPayload\(/);
  assert.doesNotMatch(updateKeyBodyMatch[0], /updates,\s*[\r\n]+\s*supportedModelsBefore/);
});
