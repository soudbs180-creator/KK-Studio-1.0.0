import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('billing mode buttons expose and lock the active state', () => {
  const source = readSource('apps/web/src/pages/CostEstimation.tsx');

  assert.match(source, /aria-pressed=\{active\}/);
  assert.match(source, /disabled=\{active\}/);
  assert.match(source, /disabled:cursor-default/);
});

test('storage mode actions stop re-triggering the already active mode', () => {
  const source = readSource('apps/web/src/components/settings/views/StorageSettingsView.localized.tsx');

  assert.match(source, /disabled=\{!supportsLocal \|\| mode === 'local'\}/);
  assert.match(source, /disabled=\{mode === 'browser'\}/);
});
