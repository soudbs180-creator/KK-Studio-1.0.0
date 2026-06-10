import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const SNAPSHOT_SOURCE_PATH = 'apps/web/src/components/settings/apiUserApiViewSnapshot.ts';
const SNAPSHOT_STORAGE_KEY = 'kk_user_api_view_snapshot:user-1';
const SNAPSHOT_NOW = 1_700_000_000_000;
const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

async function loadSnapshotModule() {
  return await import('../../apps/web/src/components/settings/apiUserApiViewSnapshot.ts');
}

function installWindowStorage() {
  const globalLike = globalThis as unknown as {
    window?: unknown;
  };
  const previousWindow = globalLike.window;
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  globalLike.window = { localStorage, sessionStorage };

  return {
    localStorage,
    sessionStorage,
    restore() {
      if (previousWindow === undefined) {
        delete globalLike.window;
      } else {
        globalLike.window = previousWindow;
      }
    },
  };
}

function freezeDateNow(now: number) {
  const previousDateNow = Date.now;
  Date.now = () => now;

  return () => {
    Date.now = previousDateNow;
  };
}

test('apiUserApiViewSnapshot keeps effective model resolution behind the lightweight helper boundary', () => {
  const snapshotSource = readSource(SNAPSHOT_SOURCE_PATH);

  assert.match(
    snapshotSource,
    /import \{ resolveEffectiveProviderModels \} from '\.\.\/\.\.\/services\/auth\/keyManagerEffectiveProviderModels(?:\.ts)?';/,
  );
  assert.doesNotMatch(
    snapshotSource,
    /import \{ resolveEffectiveProviderModels \} from '\.\.\/\.\.\/services\/auth\/keyManager';/,
  );
});

test('apiUserApiViewSnapshot normalizes numeric-like timestamp strings before date parsing', async () => {
  const { toReadonlyOfficialSlot, toReadonlyProvider } = await loadSnapshotModule();

  const officialSlot = toReadonlyOfficialSlot({
    id: 'official-slot',
    provider: 'OpenAI',
    key: 'sk-live-secret',
    createdAt: '42',
    updatedAt: '9999',
    lastUsed: '1',
  });
  const provider = toReadonlyProvider({
    id: 'third-party-provider',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    apiKey: { __kkUserApiSecret: true },
    createdAt: '42',
    updatedAt: '9999',
    usage: { lastReset: '1' },
    activitySummary: { updatedAt: '1' },
  });

  assert.equal(officialSlot?.createdAt, 42);
  assert.equal(officialSlot?.updatedAt, 9999);
  assert.equal(officialSlot?.lastUsed, 1);
  assert.equal(provider?.createdAt, 42);
  assert.equal(provider?.updatedAt, 9999);
  assert.equal(provider?.usage.lastReset, 1);
  assert.equal(provider?.activitySummary?.updatedAt, 1);
});

test('apiUserApiViewSnapshot write/read stores readonly normalized snapshots with redacted secrets', async () => {
  const restoreDateNow = freezeDateNow(SNAPSHOT_NOW);
  const { localStorage, restore } = installWindowStorage();

  try {
    const { readUserApiViewSnapshot, writeUserApiViewSnapshot } = await loadSnapshotModule();

    writeUserApiViewSnapshot(
      ' user-1 ',
      [{
        id: 'official-slot',
        provider: 'OpenAI',
        key: 'sk-live-secret',
        createdAt: '42',
        updatedAt: '9999',
      }] as never,
      [{
        id: 'third-party-provider',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com',
        apiKey: { __kkUserApiSecret: true },
        createdAt: '42',
        updatedAt: '9999',
      }] as never,
    );

    const stored = JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) ?? '{}');
    assert.equal(stored.updatedAt, SNAPSHOT_NOW);
    assert.equal(stored.officialSlots[0].createdAt, 42);
    assert.equal(stored.officialSlots[0].updatedAt, 9999);
    assert.equal(stored.officialSlots[0].key, READONLY_SECRET_PLACEHOLDER);
    assert.equal(stored.providers[0].createdAt, 42);
    assert.equal(stored.providers[0].updatedAt, 9999);
    assert.equal(stored.providers[0].apiKey, READONLY_SECRET_PLACEHOLDER);

    const restored = readUserApiViewSnapshot('user-1');
    assert.equal(restored?.updatedAt, SNAPSHOT_NOW);
    assert.deepEqual(restored?.officialSlots, stored.officialSlots);
    assert.deepEqual(restored?.providers, stored.providers);
  } finally {
    restore();
    restoreDateNow();
  }
});
