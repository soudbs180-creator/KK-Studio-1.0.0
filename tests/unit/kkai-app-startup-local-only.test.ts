import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

test('AppStartupProvider skips canonical cloud warnings in KKAI local-only mode', () => {
  const startupSource = readSource('src/context/AppStartupContext.tsx');

  assert.match(startupSource, /import \{ KKAI_FEATURE_FLAGS \} from '\.\.\/app\/kkaiFeatureFlags';/);
  assert.match(
    startupSource,
    /const localOnlyRuntime = !KKAI_FEATURE_FLAGS\.admin\s*&& !KKAI_FEATURE_FLAGS\.workspaceCloudSync\s*&& !KKAI_FEATURE_FLAGS\.cloudProfileFallback;/,
  );
  assert.match(startupSource, /if \(localOnlyRuntime\) \{/);
  assert.match(startupSource, /setHealthState\('ready'\);/);
  assert.match(startupSource, /setLastStartupWarning\(null\);/);
});
