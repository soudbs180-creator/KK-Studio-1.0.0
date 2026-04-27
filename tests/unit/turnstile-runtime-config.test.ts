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

test('turnstile site key must come from explicit runtime configuration', () => {
  const source = readFileSync(path.join(ROOT_DIR, 'src/config/turnstile.ts'), 'utf-8');

  assert.doesNotMatch(source, /DEFAULT_TURNSTILE_SITE_KEY/);
  assert.match(source, /TURNSTILE_SITE_KEY\s*=\s*TURNSTILE_ENV_SITE_KEY/);
  assert.match(source, /TURNSTILE_HAS_SITE_KEY\s*=\s*TURNSTILE_HAS_ENV_SITE_KEY/);
});
