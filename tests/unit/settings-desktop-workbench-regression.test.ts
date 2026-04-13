import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('desktop settings shell is split into dedicated workbench primitives with a single calm toolbar', () => {
  const shellSource = readSource('src/components/settings/SettingsPanel.localized.tsx');

  assert.match(
    shellSource,
    /import SettingsDesktopSidebar from '\.\/desktop\/SettingsDesktopSidebar';/,
  );
  assert.match(
    shellSource,
    /import SettingsDesktopWorkbenchHeader, \{ DESKTOP_SETTINGS_VIEW_META \} from '\.\/desktop\/SettingsDesktopWorkbenchHeader';/,
  );
  assert.match(shellSource, /<SettingsDesktopSidebar/);
  assert.match(shellSource, /<SettingsDesktopWorkbenchHeader/);
  assert.match(shellSource, /const headerMeta = DESKTOP_SETTINGS_VIEW_META\[activeView\];/);
  assert.doesNotMatch(shellSource, /settings-toolbar-search/);
  assert.doesNotMatch(shellSource, /System Active/);
});

