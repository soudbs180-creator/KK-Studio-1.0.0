import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce analysis button unlocks once a requirement file is present', () => {
  const appSource = readSource('src/App.tsx');
  const importPanelSource = readSource('src/components/ecommerce/EcommerceImportPanel.tsx');

  assert.match(appSource, /if \(!ecommerceState\.requirementFile\) \{/);
  assert.match(importPanelSource, /const hasRequirementFile = Boolean\(requirementFileName\);/);
  assert.match(importPanelSource, /disabled=\{isAnalyzing \|\| !hasRequirementFile\}/);
  assert.doesNotMatch(importPanelSource, /disabled=\{isAnalyzing \|\| !hasRequirementFile \|\| !hasProductFiles\}/);
});
