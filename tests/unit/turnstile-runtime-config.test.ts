import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

test('turnstile local bypass is opt-in instead of auto-enabled on localhost', () => {
  const source = readFileSync(path.join(ROOT_DIR, 'src/config/turnstile.ts'), 'utf-8');

  assert.match(source, /readRuntimeBooleanEnv\(\s*'VITE_TURNSTILE_LOCAL_BYPASS',\s*false,\s*\)/);
  assert.match(source, /TURNSTILE_LOCAL_BYPASS_ACTIVE\s*=\s*[\s\S]*TURNSTILE_LOCAL_BYPASS_ENABLED && TURNSTILE_LOCAL_HOST/);
});
