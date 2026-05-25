import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('capability routing cards keep their toggles in a compact card header state area', () => {
  const source = readSource('src/components/settings/apiWorkbenchSections.tsx');
  const uiSource = readSource('src/components/settings/ui/index.tsx');
  const cssSource = readSource('src/index.css');

  assert.match(source, /settings-capability-grid/);
  assert.match(source, /settings-capability-card/);
  assert.match(source, /settings-capability-card__identity/);
  assert.match(source, /settings-capability-card__avatar/);
  assert.match(source, /settings-capability-card__state/);
  assert.match(source, /settings-capability-card__switch/);
  assert.match(source, /settings-capability-card__switch-thumb/);
  assert.match(source, /settings-capability-card__controls/);
  assert.doesNotMatch(source, /<div key=\{item\.role\} className="rounded-\[18px\] border p-3"/);
  assert.doesNotMatch(source, /settings-capability-card__toggle/);
  assert.match(
    uiSource,
    /settings-control-toggle settings-toggle-button relative h-7 w-12 shrink-0 overflow-hidden rounded-\[var\(--radius-control-md\)\] border/,
  );
  assert.match(cssSource, /\.settings-panel \.settings-capability-card__switch \{/);
  assert.match(cssSource, /\.settings-panel \.settings-capability-card__switch--on \{/);
});
