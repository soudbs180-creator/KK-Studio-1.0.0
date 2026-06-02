import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('PromptBar routes ecommerce drag and drop through the dedicated ecommerce file router', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.match(promptBarSource, /import \{ routeEcommerceDroppedFiles \} from '\.\/prompt-bar\/ecommerceDropRouting';/);
  assert.match(promptBarSource, /const ecommerceDropRoute = routeEcommerceDroppedFiles\(/);
  assert.match(promptBarSource, /analysisConfirmed:\s*ecommerceAnalysisConfirmed/);
  assert.match(promptBarSource, /ecommerceDropRoute\.requirementFiles\.length && onPickEcommerceRequirementFile/);
  assert.match(promptBarSource, /ecommerceDropRoute\.productFiles\.length && onPickEcommerceProductFiles/);
  assert.match(promptBarSource, /ecommerceDropRoute\.promptReferenceFiles\.length > 0/);
});
