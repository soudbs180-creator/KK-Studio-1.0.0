import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce analysis confirmation keeps unchecked modules as skipped slots instead of dropping them', () => {
  const appSource = readSource('src/App.tsx');

  assert.doesNotMatch(appSource, /if \(ecommerceState\.selectedItems\[item\.itemId\] === false\) \{\s*continue;\s*\}/);
  assert.doesNotMatch(appSource, /if \(ecommerceState\.selectedItems\[item\.moduleId\] === false\) \{\s*continue;\s*\}/);
  assert.match(appSource, /selected:\s*ecommerceState\.selectedItems\[item\.itemId\] !== false/);
  assert.match(appSource, /selected:\s*ecommerceState\.selectedItems\[item\.moduleId\] !== false/);
  assert.match(appSource, /groupId:\s*mainGroupNode\.id/);
  assert.match(appSource, /groupId:\s*aPlusGroupNode\.id/);
});
