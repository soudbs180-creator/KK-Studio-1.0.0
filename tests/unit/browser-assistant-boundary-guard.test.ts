import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('browser assistant boundary guard excludes dependency trees from its mobile source scan', () => {
  const guardSource = readSource(
    'scripts/governance/architecture/check-browser-assistant-boundaries.mjs',
  );

  assert.match(guardSource, /ignore:\s*\['apps\/mobile\/node_modules\/\*\*'\]/);
  assert.match(guardSource, /onlyFiles:\s*true/);
});
