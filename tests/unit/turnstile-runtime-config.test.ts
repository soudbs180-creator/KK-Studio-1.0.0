import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
//
//
import { test } from 'node:test';

//

test('turnstile local bypass is opt-in instead of auto-enabled on localhost', () => {
  const source = readSource('apps/web/src/config/turnstile.ts');

  assert.match(source, /readRuntimeBooleanEnv\(\s*'VITE_TURNSTILE_LOCAL_BYPASS',\s*false,\s*\)/);
  assert.match(source, /TURNSTILE_LOCAL_BYPASS_ACTIVE\s*=\s*[\s\S]*TURNSTILE_LOCAL_BYPASS_ENABLED && TURNSTILE_LOCAL_HOST/);
});

test('turnstile site key must come from explicit runtime configuration', () => {
  const source = readSource('apps/web/src/config/turnstile.ts');

  assert.doesNotMatch(source, /DEFAULT_TURNSTILE_SITE_KEY/);
  assert.match(source, /TURNSTILE_SITE_KEY\s*=\s*TURNSTILE_ENV_SITE_KEY/);
  assert.match(source, /TURNSTILE_HAS_SITE_KEY\s*=\s*TURNSTILE_HAS_ENV_SITE_KEY/);
});

test('turnstile uses Cloudflare-supported lowercase Chinese locale code', () => {
  const source = readSource('apps/web/src/components/auth/TurnstileWidget.tsx');

  assert.match(source, /language === 'en-US' \? 'en' : 'zh-cn'/);
  assert.doesNotMatch(source, /language === 'en-US' \? 'en' : 'zh-CN'/);
});

test('turnstile script loader keeps failures retryable and reports stable error codes', () => {
  const source = readSource('apps/web/src/components/auth/TurnstileWidget.tsx');

  assert.match(source, /const TURNSTILE_SCRIPT_LOAD_ERROR = 'Failed to load Turnstile script';/);
  assert.match(source, /const TURNSTILE_TIMEOUT_ERROR = 'Timed out while waiting for Turnstile';/);
  assert.match(source, /throw new Error\(TURNSTILE_TIMEOUT_ERROR\);/);
  assert.match(source, /script\.dataset\.turnstileLoadState = 'loading';/);
  assert.match(source, /script\.dataset\.turnstileLoadState = 'error';[\s\S]*script\.remove\(\);[\s\S]*reject\(new Error\(TURNSTILE_SCRIPT_LOAD_ERROR\)\);/);
  assert.match(source, /existingScript\.dataset\.turnstileLoadState === 'error'[\s\S]*existingScript\.remove\(\);/);
});
