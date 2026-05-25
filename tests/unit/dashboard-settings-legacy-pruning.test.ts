import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('DashboardView.localized removes the hidden legacy overview header block after hero migration', () => {
  const source = readSource('src/components/settings/views/DashboardView.localized.tsx');

  assert.doesNotMatch(source, /\{false && \(/);
  assert.match(source, /<SettingsHero/);
  assert.match(source, /Traffic overview/);
  assert.match(source, /Operational health/);
  assert.match(source, /Quick routes/);
  assert.match(source, /Recent signals/);
  assert.doesNotMatch(source, /Quick access/);
  assert.doesNotMatch(source, /Status and next step/);
  assert.doesNotMatch(source, /System overview/);
});
