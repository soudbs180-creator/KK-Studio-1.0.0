import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('settings shell supports overlay and page presentations while sharing one router shell', () => {
  const source = readSource('src/components/settings/SettingsPanel.localized.tsx');

  assert.match(source, /presentation\?: 'overlay' \| 'page';/);
  assert.match(source, /initialPathname\?: string;/);
  assert.match(source, /presentation = 'overlay'/);
  assert.match(source, /const normalizedInitialPathname = initialPathname && initialPathname\.startsWith\('\/settings'\) \? initialPathname : null;/);
  assert.match(
    source,
    /const safeInitialView = normalizedInitialPathname\s*\?\s*getCurrentSettingsViewId\(normalizedInitialPathname\)\s*:\s*resolveCanonicalSettingsViewId\(initialView\);/,
  );
  assert.match(source, /const initialEntry = normalizedInitialPathname \|\|/);
  assert.match(source, /if \(presentation === 'page'\) \{\s*return content;\s*\}/);
  assert.match(source, /return createPortal\(content, document\.body\);/);
  assert.match(source, /data-testid="settings-page-root"/);
});
