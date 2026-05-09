import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('admin login page exposes a polished operator login surface', () => {
  const pageSource = readSource('apps/admin/src/pages/AdminLoginPage.tsx');
  const cssSource = readSource('apps/admin/src/styles/admin.css');
  const testsConfigSource = readSource('tsconfig.tests.json');

  assert.match(testsConfigSource, /tests\/unit\/admin-login-page-surface\.test\.ts/);
  assert.match(pageSource, /ShieldCheck/);
  assert.match(pageSource, /Mail/);
  assert.match(pageSource, /LockKeyhole/);
  assert.match(pageSource, /LogIn/);
  assert.match(pageSource, /className="admin-login-page"/);
  assert.match(pageSource, /className="admin-login-brand"/);
  assert.match(pageSource, /className="admin-login-form"/);
  assert.match(pageSource, /htmlFor="admin-login-email"/);
  assert.match(pageSource, /id="admin-login-email"/);
  assert.match(pageSource, /id="admin-login-password"/);
  assert.match(pageSource, /id="admin-login-admin-password"/);
  assert.match(pageSource, /autoComplete="email"/);
  assert.match(pageSource, /autoComplete="current-password"/);
  assert.match(pageSource, /aria-invalid=\{!!error\}/);
  assert.match(pageSource, /role="alert"/);
  assert.match(pageSource, /登录管理后台/);
  assert.match(pageSource, /运营控制台/);

  assert.match(cssSource, /\.admin-login-page\s*\{/);
  assert.match(cssSource, /\.admin-login-card\s*\{/);
  assert.match(cssSource, /\.admin-login-field\s*\{/);
  assert.match(cssSource, /\.admin-login-input\s*\{/);
  assert.match(cssSource, /\.admin-login-submit\s*\{/);
  assert.match(cssSource, /@media \(max-width: 760px\)/);
});
