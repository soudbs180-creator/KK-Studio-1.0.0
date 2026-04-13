import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('premium settings tokens expose shared typography, radius, and motion scales for both themes', () => {
  const cssSource = readSource('src/index.css');

  assert.match(cssSource, /--type-display:/);
  assert.match(cssSource, /--type-title-1:/);
  assert.match(cssSource, /--type-title-2:/);
  assert.match(cssSource, /--type-title-3:/);
  assert.match(cssSource, /--type-body-1:/);
  assert.match(cssSource, /--type-body-2:/);
  assert.match(cssSource, /--type-caption:/);
  assert.match(cssSource, /--type-micro:/);
  assert.match(cssSource, /--radius-control-sm:/);
  assert.match(cssSource, /--radius-control-md:/);
  assert.match(cssSource, /--radius-surface-md:/);
  assert.match(cssSource, /--radius-surface-lg:/);
  assert.match(cssSource, /--motion-hover:/);
  assert.match(cssSource, /--motion-toggle:/);
  assert.match(cssSource, /--motion-panel:/);
  assert.match(cssSource, /--motion-theme:/);
  assert.match(cssSource, /--settings-state-info-bg:/);
  assert.match(cssSource, /--settings-state-success-bg:/);
  assert.match(cssSource, /--settings-state-warning-bg:/);
  assert.match(cssSource, /--settings-state-danger-bg:/);
});

test('shared settings primitives consume the premium token contract instead of hard-coded sizes', () => {
  const scaffoldSource = readSource('src/components/settings/SettingsScaffold.tsx');
  const uiSource = readSource('src/components/settings/ui/index.tsx');
  const headerSource = readSource('src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');

  assert.match(scaffoldSource, /var\(--radius-control-md\)/);
  assert.match(scaffoldSource, /var\(--settings-state-info-bg\)/);
  assert.match(scaffoldSource, /var\(--settings-state-warning-bg\)/);
  assert.match(scaffoldSource, /var\(--settings-state-danger-bg\)/);
  assert.match(uiSource, /var\(--radius-control-md\)/);
  assert.match(uiSource, /var\(--type-body-2\)/);
  assert.match(headerSource, /var\(--type-title-1\)/);
  assert.match(headerSource, /var\(--type-caption\)/);
  assert.doesNotMatch(uiSource, /rounded-\[16px\]/);
  assert.doesNotMatch(headerSource, /text-\[28px\]/);
});
