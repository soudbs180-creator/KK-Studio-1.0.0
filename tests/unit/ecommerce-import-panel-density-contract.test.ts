import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce import file cards keep readable density inside the prompt bar', () => {
  const source = readSource('apps/web/src/components/ecommerce/EcommerceImportPanel.tsx');

  assert.match(source, /const chipClass = 'inline-flex items-center whitespace-nowrap/);
  assert.match(source, /const cardClass = 'kk-ecommerce-import-card rounded-\[12px\] border px-3 py-2'/);
  assert.match(source, /const importGridStyle: React\.CSSProperties = \{/);
  assert.match(source, /gridTemplateColumns: 'repeat\(auto-fit, minmax\(min\(100%, 196px\), 1fr\)\)'/);
  assert.match(source, /data-ecommerce-import-grid/);
  assert.match(source, /className="grid gap-2"/);
  assert.doesNotMatch(source, /md:col-span-2/);
  assert.doesNotMatch(source, /min-h-\[132px\]/);
  assert.doesNotMatch(source, /md:grid-cols-\[1\.08fr_1fr_1fr\]/);
  assert.match(source, /className="kk-ecommerce-import-panel mb-2 rounded-\[14px\] border px-2\.5 py-2"/);
  assert.match(source, /className="flex flex-col gap-2"/);
  assert.doesNotMatch(source, /leading-5/);
  assert.match(source, /className="kk-ecommerce-import-card__icon flex h-8 w-8 shrink-0 items-center justify-center rounded-\[10px\] border"/);
  assert.match(source, /const thumbClass = 'kk-ecommerce-import-preview relative h-12 w-12 overflow-hidden rounded-\[10px\] border'/);
  assert.match(source, /className="inline-flex h-9 items-center justify-center whitespace-nowrap/);
  assert.match(source, /className="kk-ecommerce-import-analyze ml-auto inline-flex h-8 !min-w-\[118px\] items-center justify-center gap-1\.5 whitespace-nowrap/);
  assert.doesNotMatch(source, /className="ml-auto inline-flex h-9 min-w-\[132px\] /);
});
