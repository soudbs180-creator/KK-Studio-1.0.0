import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce build runtime creates both main-image and A+ group shells before child module cards', () => {
  const buildRuntimeSource = readSource('src/app/useEcommerceBuildRuntime.ts');

  assert.match(buildRuntimeSource, /const buildEcommerceGroupNode = useCallback\(\(/);
  assert.match(buildRuntimeSource, /sourceSheet: '[^']+' \| 'A\+'/);
  assert.match(buildRuntimeSource, /const mainGroupNode = buildEcommerceGroupNode/);
  assert.match(buildRuntimeSource, /const aPlusGroupNode = buildEcommerceGroupNode/);
  assert.match(buildRuntimeSource, /groupId: mainGroupNode\.id/);
  assert.match(buildRuntimeSource, /groupId: aPlusGroupNode\.id/);
  assert.match(buildRuntimeSource, /groupIds: \{[\s\S]*mainGroupNode\.id,[\s\S]*'A\+': aPlusGroupNode\.id,/);
});
