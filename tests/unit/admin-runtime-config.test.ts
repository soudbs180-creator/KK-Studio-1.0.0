import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolveAdminApiBaseUrl,
  resolveAdminAppBaseUrl,
} from '../../apps/admin/src/config/adminRuntime.ts';

test('resolveAdminAppBaseUrl trims trailing slashes and falls back to current origin', () => {
  assert.equal(
    resolveAdminAppBaseUrl({
      configuredAdminUrl: 'https://admin.example.com///',
      runtimeOrigin: 'http://127.0.0.1:4174',
    }),
    'https://admin.example.com',
  );

  assert.equal(
    resolveAdminAppBaseUrl({
      configuredAdminUrl: '',
      runtimeOrigin: 'http://127.0.0.1:4174',
    }),
    'http://127.0.0.1:4174',
  );
});

test('resolveAdminApiBaseUrl defaults to same-origin api when no explicit api base is configured', () => {
  assert.equal(
    resolveAdminApiBaseUrl({
      configuredApiUrl: '',
      adminAppBaseUrl: 'https://admin.example.com',
    }),
    'https://admin.example.com',
  );
});
