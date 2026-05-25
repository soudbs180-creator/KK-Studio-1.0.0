import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildAdminLoginUrl } from '../../apps/web/src/services/admin/adminEntry.ts';

test('buildAdminLoginUrl keeps the admin app external and lands on /login', () => {
  assert.equal(
    buildAdminLoginUrl({
      configuredBaseUrl: 'https://admin.example.com/',
      currentUrl: 'https://kk.example.com/login',
    }),
    'https://admin.example.com/login?from=https%3A%2F%2Fkk.example.com%2Flogin',
  );
});

test('LoginScreen source contains a dedicated administrator redirect button', () => {
  const source = readFileSync('src/components/auth/LoginScreen.tsx', 'utf8');

  assert.match(source, /buildAdminLoginUrl/);
  assert.match(source, /readRuntimeEnv\('VITE_KK_ADMIN_URL'\)/);
  assert.match(source, /window\.location\.assign/);
});

test('LoginScreen keeps manual local access beside the administrator entry', () => {
  const source = readFileSync('src/components/auth/LoginScreen.tsx', 'utf8');

  assert.match(source, /className="auth-aux-actions"/);
  assert.match(source, /handleTempUserEntry/);
  assert.match(source, /handleAdminEntry/);
  assert.doesNotMatch(source, /!\s*hostedRuntime\s*\?\s*<button[\s\S]*handleTempUserEntry/);
});
