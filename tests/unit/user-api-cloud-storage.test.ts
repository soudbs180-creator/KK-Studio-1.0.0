import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  combineUserApisEnvelopeSources,
  getUserApisPayloadDensity,
} from '../../src/services/api/supabaseUserApiCloudStorage.ts';
import { mergeUserApisPayload } from '../../src/services/api/userApiPayload.ts';

function createEntry(id: string) {
  return {
    id,
    key: `sk-${id}`,
    name: `Entry ${id}`,
    provider: 'Google',
    type: 'official' as const,
    format: 'gemini' as const,
    supportedModels: ['gemini-2.5-flash'],
    disabled: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    status: 'unknown' as const,
    failCount: 0,
    successCount: 0,
    totalCost: 0,
    budgetLimit: -1,
    tokenLimit: -1,
    usedTokens: 0,
    lastUsed: null,
    lastError: null,
  };
}

describe('user api cloud storage helpers', () => {
  test('uses the dedicated user-api endpoint payload when cloud state no longer embeds entries', () => {
    const combined = combineUserApisEnvelopeSources(
      {
        version: 2,
        slots: [{ id: 'slot-1' }],
        providers: [{ id: 'provider-1' }],
        entries: [],
      },
      {
        entries: [createEntry('entry-1')],
      },
    );

    assert.deepEqual(combined.slots, [{ id: 'slot-1' }]);
    assert.deepEqual(combined.providers, [{ id: 'provider-1' }]);
    assert.equal(combined.entries.length, 1);
    assert.equal((combined.entries[0] as { id: string }).id, 'entry-1');
    assert.equal(getUserApisPayloadDensity(combined), 3);
  });

  test('can prefer the explicit user-api write response over derived cloud-state entries', () => {
    const combined = combineUserApisEnvelopeSources(
      {
        version: 2,
        slots: [{ id: 'slot-1' }],
        providers: [],
        entries: [createEntry('slot-1')],
      },
      {
        entries: [createEntry('entry-2')],
      },
      {
        preferUserApiEntries: true,
      },
    );

    assert.equal(combined.entries.length, 1);
    assert.equal((combined.entries[0] as { id: string }).id, 'entry-2');
  });

  test('keeps entries intact when only key-manager slots are updated', () => {
    const merged = mergeUserApisPayload(
      {
        version: 2,
        slots: [{ id: 'slot-1', key: 'slot-secret' }],
        providers: [{ id: 'provider-1' }],
        entries: [createEntry('entry-1')],
      },
      {
        slots: [{ id: 'slot-2', key: 'slot-secret-2' }],
      },
    ) as {
      slots: Array<{ id: string }>;
      providers: Array<{ id: string }>;
      entries: Array<{ id: string }>;
    };

    assert.deepEqual(
      merged.slots.map((slot) => slot.id),
      ['slot-2'],
    );
    assert.deepEqual(
      merged.providers.map((provider) => provider.id),
      ['provider-1'],
    );
    assert.deepEqual(
      merged.entries.map((entry) => entry.id),
      ['entry-1'],
    );
  });
});
