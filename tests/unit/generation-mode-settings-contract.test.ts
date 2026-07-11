import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('generation mode settings are consumed by the canonical provider route engine', () => {
  const settings = fs.readFileSync('apps/web/src/components/settings/views/GenerationModeView.tsx', 'utf8');
  const engine = fs.readFileSync('apps/web/src/core/routing/ProviderRouteEngine.ts', 'utf8');
  const compatibilityPolicy = fs.readFileSync('apps/web/src/features/generation/routePolicies.ts', 'utf8');

  assert.match(engine, /storedPreferredMode === 'auto'/);
  assert.match(engine, /kk_studio_fallback_to_cloud/);
  assert.match(engine, /allowCloudFallback/);
  assert.match(settings, /kk_studio_preferred_generation_mode/);
  assert.match(settings, /kk_studio_fallback_to_cloud/);
  assert.doesNotMatch(settings, /kk_studio_enable_openai_oauth/);
  assert.match(compatibilityPolicy, /core\/routing\/routePolicies/);
});
