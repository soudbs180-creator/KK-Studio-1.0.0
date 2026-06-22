import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('password reset request is a typed KK API flow instead of a login placeholder', () => {
  const dtoSource = readSource('packages/shared/src/contracts/dto/auth.ts');
  const clientSource = readSource('packages/shared/src/contracts/client/kk-api-client.ts');
  const loginSource = readSource('apps/web/src/components/auth/LoginScreen.tsx');
  const serverSource = readSource('server/routes/user.js');
  const migrationSource = readSource('migrations/013_password_reset_tokens.sql');

  assert.match(dtoSource, /export interface PasswordResetRequestDto/);
  assert.match(dtoSource, /export interface PasswordResetRequestResponseDto/);
  assert.match(dtoSource, /export interface PasswordResetConfirmDto/);
  assert.match(dtoSource, /export interface PasswordResetConfirmResponseDto/);
  assert.match(clientSource, /requestPasswordReset\(/);
  assert.match(clientSource, /confirmPasswordReset\(/);
  assert.match(clientSource, /api\/v1\/auth\/password-reset\/request/);
  assert.match(clientSource, /api\/v1\/auth\/password-reset\/confirm/);

  assert.match(loginSource, /kkWebApiClient\.requestPasswordReset/);
  assert.match(loginSource, /kkWebApiClient\.confirmPasswordReset/);
  assert.match(loginSource, /passwordResetToken/);
  assert.match(loginSource, /auth-mode=reset-password/);
  assert.doesNotMatch(loginSource, /AUTH_RESET_PASSWORD_UNAVAILABLE/);
  assert.doesNotMatch(loginSource, /当前仅保留占位入口，等待后端接入重置密码接口/);

  assert.match(serverSource, /router\.post\('\/v1\/auth\/password-reset\/request'/);
  assert.match(serverSource, /router\.post\('\/v1\/auth\/password-reset\/confirm'/);
  assert.match(serverSource, /AUTH_PASSWORD_RESET_REQUESTED/);
  assert.match(serverSource, /AUTH_PASSWORD_RESET_COMPLETED/);
  assert.match(serverSource, /hashPasswordResetToken/);
  assert.match(serverSource, /token_hash/);
  assert.match(serverSource, /UPDATE public\.users SET password_hash = \$1, updated_at = NOW\(\) WHERE id = \$2/);
  assert.match(serverSource, /privacy-preserving/);
  assert.doesNotMatch(serverSource, /SELECT id FROM public\.users WHERE email = \$1[\s\S]{0,220}AUTH_USER_NOT_FOUND/);

  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.password_reset_tokens/);
  assert.match(migrationSource, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(migrationSource, /expires_at TIMESTAMPTZ NOT NULL/);
  assert.match(migrationSource, /consumed_at TIMESTAMPTZ/);
});
