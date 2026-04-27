import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('capability routing cards keep their toggles inside a dedicated inner container', () => {
  const source = readSource('src/components/settings/apiWorkbenchSections.tsx');
  const uiSource = readSource('src/components/settings/ui/index.tsx');

  assert.match(source, /settings-capability-grid/);
  assert.match(source, /settings-capability-card/);
  assert.match(source, /settings-capability-card__controls/);
  assert.doesNotMatch(source, /<div key=\{item\.role\} className="rounded-\[18px\] border p-3"/);
  assert.match(
    source,
    /<div className="settings-capability-card__toggle" style=\{SETTINGS_OVERLAY_STYLE\}>\s*<SettingToggle/s,
  );
  assert.match(
    uiSource,
    /className="settings-toggle-button relative h-7 w-12 shrink-0 overflow-hidden rounded-full border/,
  );
});
