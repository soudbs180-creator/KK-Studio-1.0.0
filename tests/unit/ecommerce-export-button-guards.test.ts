import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce group export warns when no generated deliverables are available instead of exporting an empty zip', () => {
  const groupExportRuntimeSource = readSource('src/app/useEcommerceGroupExportRuntime.ts');

  assert.match(groupExportRuntimeSource, /if \(exportables\.length === 0\) \{/);
  assert.match(groupExportRuntimeSource, /notify\.warning\('无可导出图片',/);
  assert.doesNotMatch(groupExportRuntimeSource, /导出完成'.*\$\{packageLabel\}已导出，共 0 张图片/);
});
