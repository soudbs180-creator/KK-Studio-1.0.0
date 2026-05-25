import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { shouldUseHistoryBackForSettingsClose } from '../../apps/web/src/app/settingsPageClose.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('settings page close uses history back only for same-origin non-settings referrers', () => {
  assert.equal(shouldUseHistoryBackForSettingsClose({
    currentOrigin: 'http://127.0.0.1:3000',
    currentPathname: '/settings',
    referrer: 'http://127.0.0.1:3000/',
  }), true);

  assert.equal(shouldUseHistoryBackForSettingsClose({
    currentOrigin: 'http://127.0.0.1:3000',
    currentPathname: '/settings/api-management',
    referrer: 'http://127.0.0.1:3000/workspace',
  }), true);
});

test('settings page close falls back to workspace root for blank, cross-origin, and settings-origin referrers', () => {
  assert.equal(shouldUseHistoryBackForSettingsClose({
    currentOrigin: 'http://127.0.0.1:3000',
    currentPathname: '/settings',
    referrer: '',
  }), false);

  assert.equal(shouldUseHistoryBackForSettingsClose({
    currentOrigin: 'http://127.0.0.1:3000',
    currentPathname: '/settings',
    referrer: 'about:blank',
  }), false);

  assert.equal(shouldUseHistoryBackForSettingsClose({
    currentOrigin: 'http://127.0.0.1:3000',
    currentPathname: '/settings',
    referrer: 'https://example.com/settings',
  }), false);

  assert.equal(shouldUseHistoryBackForSettingsClose({
    currentOrigin: 'http://127.0.0.1:3000',
    currentPathname: '/settings',
    referrer: 'http://127.0.0.1:3000/settings/api-management',
  }), false);
});

test('SettingsPageRoot only uses history back when the tab actually has a back entry', () => {
  const source = readSource('src/app/SettingsPageRoot.tsx');

  assert.match(
    source,
    /if \(window\.history\.length > 1 && shouldUseHistoryBackForSettingsClose\(/,
  );
});
