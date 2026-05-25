import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce import panel uses stable empty file arrays and avoids no-op preview state loops', () => {
  const source = readSource('src/components/ecommerce/EcommerceImportPanel.tsx');

  assert.match(source, /const EMPTY_FILES: File\[\] = \[\];/);
  assert.match(source, /productFiles = EMPTY_FILES,/);
  assert.match(source, /extraReferenceFiles = EMPTY_FILES,/);
  assert.match(source, /const resolvedProductFiles = React\.useMemo\(\(\) => productFiles\.slice\(0, MAX_VISIBLE_PREVIEWS\), \[productFiles\]\);/);
  assert.match(source, /const resolvedExtraReferenceFiles = React\.useMemo\(\(\) => extraReferenceFiles\.slice\(0, MAX_VISIBLE_PREVIEWS\), \[extraReferenceFiles\]\);/);
  assert.match(source, /files\.length === 0/);
  assert.match(source, /setUrls\(\(current\) => \(current\.length === 0 \? current : \[\]\)\);/);
  assert.doesNotMatch(source, /productFiles = \[\]/);
  assert.doesNotMatch(source, /extraReferenceFiles = \[\]/);
});
