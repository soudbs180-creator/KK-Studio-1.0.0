import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce import file cards keep readable density inside the prompt bar', () => {
  const source = readSource('src/components/ecommerce/EcommerceImportPanel.tsx');

  assert.match(source, /const chipClass = 'inline-flex items-center whitespace-nowrap/);
  assert.match(source, /const cardClass = 'rounded-\[16px\] border px-3 py-2\.5'/);
  assert.match(source, /const importGridStyle: React\.CSSProperties = \{/);
  assert.match(source, /gridTemplateColumns: 'repeat\(auto-fit, minmax\(min\(100%, 210px\), 1fr\)\)'/);
  assert.match(source, /data-ecommerce-import-grid/);
  assert.match(source, /className="grid gap-2"/);
  assert.doesNotMatch(source, /md:col-span-2/);
  assert.doesNotMatch(source, /min-h-\[132px\]/);
  assert.doesNotMatch(source, /md:grid-cols-\[1\.08fr_1fr_1fr\]/);
  assert.match(source, /className="mb-2 rounded-\[18px\] border px-3 py-2\.5"/);
  assert.match(source, /className="flex flex-col gap-2"/);
  assert.doesNotMatch(source, /leading-5/);
  assert.match(source, /className="flex h-9 w-9 shrink-0 items-center justify-center rounded-\[12px\] border"/);
  assert.match(source, /const thumbClass = 'relative h-14 w-14 overflow-hidden rounded-\[12px\] border'/);
  assert.match(source, /className="inline-flex h-9 items-center justify-center whitespace-nowrap/);
  assert.match(source, /className="ml-auto inline-flex h-9 !min-w-\[132px\] items-center justify-center gap-2 whitespace-nowrap/);
  assert.doesNotMatch(source, /className="ml-auto inline-flex h-9 min-w-\[132px\] /);
});
