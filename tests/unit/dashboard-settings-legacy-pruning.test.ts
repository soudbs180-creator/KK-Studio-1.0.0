import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('DashboardView.localized removes the hidden legacy overview header block after hero migration', () => {
  const source = readSource('src/components/settings/views/DashboardView.localized.tsx');

  assert.doesNotMatch(source, /\{false && \(/);
  assert.match(source, /SettingsViewShell/);
  assert.match(source, /dashboard-grid-container/);
  assert.match(source, /dashboard-grid-card/);
  assert.doesNotMatch(source, /Quick routes/);
  assert.doesNotMatch(source, /Recent signals/);
});
