import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

test('bootstrap fatal screen localizes startup errors for both document languages', () => {
  const source = readFileSync(
    path.join(ROOT_DIR, 'src/main.tsx'),
    'utf-8',
  );

  assert.doesNotMatch(
    source,
    /function localizeStartupErrorText[\s\S]*getStoredStartupLanguage\(\) === 'en-US'[\s\S]*return value;/,
  );
  assert.match(source, /return localizeUserFacingText\(value\) \|\| value;/);
});

test('common error boundary localizes captured errors for both document languages', () => {
  const source = readFileSync(
    path.join(ROOT_DIR, 'src/components/common/ErrorBoundary.tsx'),
    'utf-8',
  );

  assert.doesNotMatch(
    source,
    /const localizeBoundaryErrorText[\s\S]*language === 'en-US'[\s\S]*return value \?\? undefined;/,
  );
  assert.match(source, /return localizeUserFacingText\(value\) \|\| value;/);
});
