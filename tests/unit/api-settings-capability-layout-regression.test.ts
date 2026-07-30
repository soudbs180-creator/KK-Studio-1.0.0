import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('capability routing cards keep their toggles in a compact card header state area', () => {
  const source = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const uiSource = readSource('apps/web/src/components/settings/ui/index.tsx');
  const cssSource = readSource('apps/web/src/index.css');
  const settingsCssSource = readSource('apps/web/src/styles/settings-v3.css');

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
  assert.doesNotMatch(source, /pointer-events-none opacity-0 select-none/);
  assert.match(uiSource, /settings-system-switch settings-control-toggle settings-toggle-button/);
  assert.match(uiSource, /role="switch"/);
  assert.match(settingsCssSource, /\.settings-system-switch[\s\S]*width:\s*42px !important;/);
  assert.match(settingsCssSource, /\.settings-system-switch[\s\S]*height:\s*24px !important;/);
  assert.match(cssSource, /\.settings-panel \.settings-capability-card__switch \{/);
  assert.match(cssSource, /\.settings-panel \.settings-capability-card__switch--on \{/);
});
