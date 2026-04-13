import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce analysis confirmation creates both main-image and A+ group shells before child module cards', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const buildEcommerceGroupNode = useCallback\(\(/);
  assert.match(appSource, /sourceSheet: '主图' \| 'A\+'/);
  assert.match(appSource, /const mainGroupNode = buildEcommerceGroupNode/);
  assert.match(appSource, /const aPlusGroupNode = buildEcommerceGroupNode/);
  assert.match(appSource, /'主图'/);
  assert.match(appSource, /'A\+'/);
  assert.match(appSource, /groupId: mainGroupNode\.id/);
  assert.match(appSource, /groupId: aPlusGroupNode\.id/);
});
