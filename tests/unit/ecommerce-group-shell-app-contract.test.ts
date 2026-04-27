import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce analysis confirmation keeps group and task nodes internal to one visible framework card', () => {
  const appSource = readSource('src/App.tsx');
  const runtimeSource = readSource('src/services/ecommerce/frameworkRuntime.ts');
  const typesSource = readSource('src/types.ts');

  assert.match(appSource, /const mainGroupNode = buildEcommerceGroupNode/);
  assert.match(appSource, /const aPlusGroupNode = buildEcommerceGroupNode/);
  assert.match(appSource, /buildEcommerceGroupNode\(\s*analysis\.projectMeta\.productName,\s*'A\+'/s);
  assert.match(appSource, /groupId: mainGroupNode\.id/);
  assert.match(appSource, /groupId: aPlusGroupNode\.id/);
  assert.match(appSource, /groupIds: \{[\s\S]*'A\+': aPlusGroupNode\.id,/);
  assert.match(typesSource, /hiddenInCanvas\?: boolean/);
  assert.match(appSource, /hiddenInCanvas: Boolean\(frameworkId\)/);
  assert.match(appSource, /hiddenInCanvas: Boolean\(params\.frameworkId\)/);
  assert.match(runtimeSource, /hiddenInCanvas: true/);
  assert.match(appSource, /n\.hiddenInCanvas/);
  assert.match(appSource, /n\.ecommerce\?\.frameworkId/);
  assert.match(appSource, /n\.ecommerce\.kind !== 'framework'/);
});
