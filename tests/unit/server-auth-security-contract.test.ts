import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readServerRoute(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, 'server', relativePath), 'utf8');
}

test('password auth requires configured salt and uses timing-safe hash comparison', () => {
  const source = readServerRoute('routes/user.js');

  assert.match(source, /function getRequiredPasswordSalt/);
  assert.match(source, /PASSWORD_SALT 未配置/);
  assert.match(source, /crypto\.timingSafeEqual/);
  assert.doesNotMatch(source, /PASSWORD_SALT \|\| ['"]salt['"]/);
  assert.doesNotMatch(source, /user\.password_hash !== computedHash/);
});

test('credit deduction exposes a typed insufficient-credit error for 402 handling', () => {
  const source = readServerRoute('lib/credits.js');

  assert.match(source, /const INSUFFICIENT_CREDITS_CODE = 'INSUFFICIENT_CREDITS'/);
  assert.match(source, /error\.statusCode = 402/);
  assert.match(source, /throw createInsufficientCreditsError\(\)/);
  assert.match(source, /isInsufficientCreditsError/);
});
