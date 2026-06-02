import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('desktop theme tokens expose inverse text and error aliases for shared UI primitives', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const settingsUiSource = readSource('apps/web/src/components/settings/ui/index.tsx');

  assert.match(cssSource, /--text-inverse:/);
  assert.match(cssSource, /--error:/);
  assert.match(cssSource, /--ui-text-display:/);
  assert.match(cssSource, /--ui-text-title-1:/);
  assert.match(cssSource, /--ui-text-title-2:/);
  assert.match(cssSource, /--ui-text-title-3:/);
  assert.match(cssSource, /--ui-text-body-1:/);
  assert.match(cssSource, /--ui-text-body-2:/);
  assert.match(cssSource, /--ui-text-caption:/);
  assert.match(cssSource, /--ui-text-micro:/);
  assert.match(cssSource, /--ui-radius-control:/);
  assert.match(cssSource, /--ui-radius-card:/);
  assert.match(cssSource, /--ui-radius-panel:/);
  assert.match(cssSource, /--radius-control-md:/);
  assert.match(cssSource, /--type-body-2:/);
  assert.match(cssSource, /--ui-duration-hover:/);
  assert.match(cssSource, /--ui-duration-panel:/);
  assert.match(settingsUiSource, /var\(--text-inverse\)/);
  assert.match(settingsUiSource, /var\(--error\)/);
  assert.match(settingsUiSource, /var\(--radius-control-md\)/);
  assert.match(settingsUiSource, /var\(--type-body-2\)/);
});
