import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type ProviderLinkSlot = {
  id: string;
  key: string;
  name: string;
  baseUrl?: string;
};

type ProviderLinkProvider = {
  baseUrl?: string;
  apiKey?: string;
  name?: string;
};

type KeyManagerProviderLinksModule = {
  findProviderLinkedSlots: <TSlot extends ProviderLinkSlot>(
    slots: TSlot[],
    providers: Array<ProviderLinkProvider | null | undefined>,
    options?: { allowSingleBaseUrlFallback?: boolean },
  ) => TSlot[];
};

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

async function loadProviderLinks(): Promise<KeyManagerProviderLinksModule> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerProviderLinks.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerProviderLinks.ts must exist');
  return await import('../../src/services/auth/keyManagerProviderLinks.ts') as KeyManagerProviderLinksModule;
}

test('provider linked-slot matching lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const providerLinksSource = readSource('src/services/auth/keyManagerProviderLinks.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-provider-links-contract\.test\.ts/);
  assert.match(providerLinksSource, /export function findProviderLinkedSlots/);
  assert.match(keyManagerSource, /findProviderLinkedSlots,/);
  assert.match(
    keyManagerSource,
    /findProviderLinkedSlots\([\s\S]*this\.state\.slots[\s\S]*\[provider, previousProvider\][\s\S]*allowSingleBaseUrlFallback: true[\s\S]*\)/,
  );
  assert.match(keyManagerSource, /findProviderLinkedSlots\([^;]*\[provider\][^;]*\);/);
  assert.doesNotMatch(keyManagerSource, /const candidateProviders = \[provider, previousProvider\]/);
  assert.doesNotMatch(keyManagerSource, /const candidateProviders = \[\{\s*baseUrl: normalizeProviderLinkValue\(provider\.baseUrl\)/);
});

test('provider linked-slot matching preserves key/name matching and single-base-url fallback', async () => {
  const { findProviderLinkedSlots } = await loadProviderLinks();
  const slots: ProviderLinkSlot[] = [
    { id: 'slot-a', key: 'sk-a', name: 'Provider A', baseUrl: 'https://api.example.com/v1/' },
    { id: 'slot-b', key: 'sk-b', name: 'Provider B', baseUrl: 'https://api.example.com/v1' },
    { id: 'slot-c', key: 'sk-c', name: 'Provider C', baseUrl: 'https://other.example.com/v1' },
  ];

  assert.deepEqual(
    findProviderLinkedSlots(slots, [{ baseUrl: 'https://api.example.com/v1', apiKey: 'sk-b', name: 'Different' }]).map((slot) => slot.id),
    ['slot-b'],
  );
  assert.deepEqual(
    findProviderLinkedSlots(slots, [{ baseUrl: 'https://api.example.com/v1', apiKey: 'missing', name: ' Provider A ' }]).map((slot) => slot.id),
    ['slot-a'],
  );
  assert.deepEqual(
    findProviderLinkedSlots(
      [slots[2]],
      [{ baseUrl: 'https://other.example.com/v1', apiKey: 'missing', name: 'missing' }],
      { allowSingleBaseUrlFallback: true },
    ).map((slot) => slot.id),
    ['slot-c'],
  );
  assert.deepEqual(
    findProviderLinkedSlots(
      slots.slice(0, 2),
      [{ baseUrl: 'https://api.example.com/v1', apiKey: 'missing', name: 'missing' }],
      { allowSingleBaseUrlFallback: true },
    ),
    [],
  );
  assert.deepEqual(
    findProviderLinkedSlots(
      [slots[2]],
      [
        { baseUrl: '', apiKey: 'missing-current', name: 'missing-current' },
        { baseUrl: 'https://other.example.com/v1', apiKey: 'missing-previous', name: 'missing-previous' },
      ],
      { allowSingleBaseUrlFallback: true },
    ),
    [],
  );
});
