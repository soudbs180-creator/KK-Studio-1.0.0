import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_MOBILE_RETENTION_MODE,
  MOBILE_RETENTION_PREFERENCE_KEY,
  ensureMobileRetentionPreference,
  getMobileRetentionPreference,
  setMobileRetentionPreference,
} from '../../src/services/storage/mobileRetentionPreference.ts';

test('mobile retention preference defaults new phone-first sessions to 7d', () => {
  const storage = new Map<string, string>();

  assert.equal(DEFAULT_MOBILE_RETENTION_MODE, '7d');
  assert.equal(MOBILE_RETENTION_PREFERENCE_KEY, 'kk_mobile_retention_mode');
  assert.equal(getMobileRetentionPreference(storage), null);

  const ensuredMode = ensureMobileRetentionPreference(storage);

  assert.equal(ensuredMode, '7d');
  assert.equal(getMobileRetentionPreference(storage), '7d');

  setMobileRetentionPreference(storage, 'manual');
  assert.equal(ensureMobileRetentionPreference(storage), 'manual');
});
