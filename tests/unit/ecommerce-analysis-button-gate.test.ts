import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce analysis button unlocks once a requirement file is present', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const requirementRuntimeSource = readSource('apps/web/src/app/useEcommerceRequirementAnalysisRuntime.ts');
  const importPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceImportPanel.tsx');

  assert.match(appSource, /useEcommerceRequirementAnalysisRuntime\(\{/);
  assert.match(requirementRuntimeSource, /if \(!requirementFile\) \{/);
  assert.match(importPanelSource, /const hasRequirementFile = Boolean\(requirementFileName\);/);
  assert.match(importPanelSource, /disabled=\{isAnalyzing \|\| !hasRequirementFile\}/);
  assert.doesNotMatch(importPanelSource, /disabled=\{isAnalyzing \|\| !hasRequirementFile \|\| !hasProductFiles\}/);
});
