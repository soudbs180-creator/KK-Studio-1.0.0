import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  WUYIN_PRESET_LOGO_URL,
  WUYIN_PRESET_MODELS,
} from '../../apps/web/src/services/auth/keyManagerProviderPresets.ts';
import {
  buildCanonicalApiRecordId,
  canonicalizeApiRecordsForLatestRequirements,
  isCanonicalApiRecordId,
  upgradeUserApisEnvelopeForLatestRequirements,
} from '../../apps/web/src/services/auth/keyManagerCanonicalIds.ts';

test('canonical API ids accept hyphenated channel names and generate stable channel ids', () => {
  assert.equal(isCanonicalApiRecordId('wuyinkeji-google-omni-1015-1'), true);
  assert.equal(
    buildCanonicalApiRecordId({
      name: '速创 API',
      provider: 'Wuyin',
      baseUrl: 'https://api.wuyinkeji.com',
    }),
    'wuyinkeji-google-omni-1015-1',
  );
  assert.equal(
    buildCanonicalApiRecordId({
      name: 'Google',
      provider: 'Google',
      baseUrl: 'https://generativelanguage.googleapis.com',
    }),
    'google-1017-1',
  );
});

test('latest API requirements upgrade legacy Wuyin provider metadata without exposing secrets', () => {
  const result = canonicalizeApiRecordsForLatestRequirements(
    [
      {
        id: 'provider_wuyin',
        name: '五音科技',
        baseUrl: 'https://api.wuyinkeji.com/v1',
        apiKey: 'sk-readonly-0000',
        models: ['image_custom'],
      },
    ],
    'provider',
  );

  const provider = result.records[0] as Record<string, unknown>;
  assert.equal(result.changed, true);
  assert.equal(provider.id, 'wuyinkeji-google-omni-1015-1');
  assert.deepEqual(provider.legacyIds, ['provider_wuyin']);
  assert.equal(provider.name, '速创 API');
  assert.equal(provider.baseUrl, 'https://api.wuyinkeji.com');
  assert.equal(provider.format, 'openai');
  assert.equal(provider.icon, WUYIN_PRESET_LOGO_URL);
  assert.equal((provider.models as string[])[0], WUYIN_PRESET_MODELS[0]);
  assert.equal((provider.models as string[]).includes('image_custom'), true);
  assert.equal(provider.apiKey, 'sk-readonly-0000');
});

test('latest API requirements upgrade legacy slot ids but preserve unrelated stable ids', () => {
  const result = canonicalizeApiRecordsForLatestRequirements(
    [
      {
        id: 'key_1700000000000_abcd',
        name: 'Google',
        provider: 'Google',
        baseUrl: 'https://generativelanguage.googleapis.com',
        key: 'sk-readonly-0000',
      },
      {
        id: 'provider-1',
        name: 'Custom Provider',
        baseUrl: 'https://example.com/v1',
      },
    ],
    'slot',
  );

  const [googleSlot, customSlot] = result.records as Array<Record<string, unknown>>;
  assert.equal(googleSlot.id, 'google-1017-1');
  assert.deepEqual(googleSlot.legacyIds, ['key_1700000000000_abcd']);
  assert.equal(customSlot.id, 'provider-1');
});

test('user API envelopes upgrade Wuyin slots and providers together', () => {
  const result = upgradeUserApisEnvelopeForLatestRequirements({
    version: 2,
    slots: [
      {
        id: 'slot_wuyin',
        name: '速创',
        provider: 'Wuyin',
        baseUrl: 'https://api.wuyinkeji.com',
        key: 'sk-readonly-0000',
      },
    ],
    providers: [
      {
        id: 'provider_wuyin',
        name: '速创',
        baseUrl: 'https://api.wuyinkeji.com',
        apiKey: 'sk-readonly-0000',
      },
    ],
    entries: [],
  });

  const slot = result.payload.slots[0] as Record<string, unknown>;
  const provider = result.payload.providers[0] as Record<string, unknown>;
  assert.equal(slot.id, 'wuyinkeji-google-omni-1015-1');
  assert.deepEqual(slot.legacyIds, ['slot_wuyin']);
  assert.equal(slot.provider, 'Wuyin');
  assert.equal(provider.id, 'wuyinkeji-google-omni-1015-1');
  assert.deepEqual(provider.legacyIds, ['provider_wuyin']);
  assert.deepEqual(result.idMap.slots, { slot_wuyin: 'wuyinkeji-google-omni-1015-1' });
  assert.deepEqual(result.idMap.providers, { provider_wuyin: 'wuyinkeji-google-omni-1015-1' });
});
