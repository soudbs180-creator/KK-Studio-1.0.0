import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
//
//
import { test } from 'node:test';

//

test('bootstrap fatal screen localizes startup errors for both document languages', () => {
  const source = readSource('apps/web/src/main.tsx');

  assert.doesNotMatch(
    source,
    /function localizeStartupErrorText[\s\S]*getStoredStartupLanguage\(\) === 'en-US'[\s\S]*return value;/,
  );
  assert.match(source, /return localizeUserFacingText\(value\) \|\| value;/);
});

test('common error boundary localizes captured errors for both document languages', () => {
  const source = readSource('apps/web/src/components/common/ErrorBoundary.tsx');

  assert.match(
    source,
    /const localizeBoundaryErrorText = \(_language: ResolvedLanguage, value\?: string \| null\): string \| undefined =>/,
  );
  assert.doesNotMatch(
    source,
    /const localizeBoundaryErrorText = \(language: ResolvedLanguage, value\?: string \| null\): string \| undefined =>/,
  );
  assert.doesNotMatch(
    source,
    /const localizeBoundaryErrorText[\s\S]*language === 'en-US'[\s\S]*return value \?\? undefined;/,
  );
  assert.match(source, /return localizeUserFacingText\(value\) \|\| value;/);
});
