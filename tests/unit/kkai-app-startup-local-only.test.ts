import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

test('AppStartupProvider skips canonical cloud warnings in KKAI local-only mode', () => {
  const startupSource = readFileSync(
    path.join(ROOT_DIR, 'src', 'context', 'AppStartupContext.tsx'),
    'utf-8',
  );

  assert.match(startupSource, /import \{ KKAI_FEATURE_FLAGS \} from '\.\.\/app\/kkaiFeatureFlags';/);
  assert.match(startupSource, /const localOnlyRuntime = !KKAI_FEATURE_FLAGS\.billing/);
  assert.match(startupSource, /if \(localOnlyRuntime\) \{/);
  assert.match(startupSource, /setHealthState\('ready'\);/);
  assert.match(startupSource, /setLastStartupWarning\(null\);/);
});
