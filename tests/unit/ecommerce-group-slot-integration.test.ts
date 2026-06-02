import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('App wires ecommerce group slot runtime state into preview and canvas surfaces', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const buildRuntimeSource = readSource('apps/web/src/app/useEcommerceBuildRuntime.ts');
  const hookSource = readSource('apps/web/src/app/useEcommerceSlotHistoryRuntime.ts');
  const exportRuntimeSource = readSource('apps/web/src/app/useEcommerceGroupExportRuntime.ts');
  const promptNodeSource = readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');

  assert.match(appSource, /groupSlots/);
  assert.match(buildRuntimeSource, /buildInitialEcommerceGroupSlotState/);
  assert.match(exportRuntimeSource, /applyEcommerceSlotResult/);
  assert.doesNotMatch(appSource, /applyEcommerceSlotResult/);
  assert.match(hookSource, /buildEcommerceSlotPreviewBundle/);
  assert.match(hookSource, /handlePreviewEcommerceSlotHistory/);
  assert.match(appSource, /onPreviewEcommerceSlotHistory/);
  assert.match(appSource, /ecommerceSlotState/);
  assert.match(promptNodeSource, /ecommerceSlotState/);
  assert.match(promptNodeSource, /onPreviewEcommerceSlotHistory/);
  assert.match(promptNodeSource, /ecommerce-slot-version-surface/);
});
