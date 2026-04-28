import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('canonical design manuals define the Airtable-first glass UI system', () => {
  assert.equal(existsSync(path.join(ROOT_DIR, 'DESIGN.md')), true);

  const rootManual = readSource('DESIGN.md');
  const docsManual = readSource('docs/DESIGN.md');
  const agentRules = readSource('.agent/rules/skills/SKILL.md');

  for (const source of [rootManual, docsManual, agentRules]) {
    assert.match(source, /Airtable/i);
    assert.match(source, /#181d26/i);
    assert.match(source, /#1b61c9/i);
    assert.match(source, /controlled frosted glass|受控磨砂玻璃/i);
    assert.match(source, /radius|圆角/i);
    assert.match(source, /shadow|阴影/i);
    assert.match(source, /motion|动画/i);
  }
});

test('global tokens use Airtable light-first colors and capped glass depth', () => {
  const cssSource = readSource('src/index.css');

  assert.match(cssSource, /--airtable-navy:\s*#181d26;/i);
  assert.match(cssSource, /--airtable-blue:\s*#1b61c9;/i);
  assert.match(cssSource, /--ui-glass-shell-bg:/);
  assert.match(cssSource, /--ui-glass-card-bg:/);
  assert.match(cssSource, /--ui-glass-shell-shadow:\s*0 16px 36px rgb\(24 29 38 \/ 0\.10\)/);
  assert.match(cssSource, /--ui-glass-card-shadow:\s*0 10px 24px rgb\(24 29 38 \/ 0\.08\)/);
  assert.match(cssSource, /--settings-card-shadow:\s*var\(--ui-glass-card-shadow\);/);
  assert.match(cssSource, /--settings-subcard-shadow:\s*0 4px 12px rgb\(24 29 38 \/ 0\.06\);/);
  assert.match(cssSource, /--motion-duration-standard:\s*180ms;/);
  assert.match(cssSource, /--motion-ease-standard:\s*cubic-bezier\(0\.2, 0, 0, 1\);/);
});

test('search palette uses shared Airtable tokens without heavy shadows or inline focus mutation', () => {
  const source = readSource('src/components/layout/SearchPalette.tsx');

  assert.doesNotMatch(source, /shadow-2xl|shadow-xl|shadow-lg/);
  assert.doesNotMatch(source, /bg-indigo|text-indigo|border-indigo/);
  assert.doesNotMatch(source, /parentElement!\.style\.boxShadow|style\.boxShadow/);
  assert.doesNotMatch(source, /animate-bounce-in/);
  assert.match(source, /var\(--search-palette-shadow\)/);
  assert.match(source, /var\(--search-palette-selected-bg\)/);
  assert.match(source, /var\(--search-palette-focus-ring\)/);
  assert.match(source, /var\(--state-info-text\)/);
});

test('settings controls share motion and overflow-safe Airtable sizing primitives', () => {
  const scaffoldSource = readSource('src/components/settings/SettingsScaffold.tsx');
  const primitiveSource = readSource('src/components/settings/ui/index.tsx');

  assert.match(scaffoldSource, /SETTINGS_CONTROL_MOTION_CLASSNAME/);
  assert.doesNotMatch(scaffoldSource, /transition-opacity duration-150 hover:opacity-70 active:opacity-50/);
  assert.doesNotMatch(scaffoldSource, /borderRadius:\s*tone === 'primary' \? '980px'/);
  assert.match(scaffoldSource, /boxShadow:\s*'var\(--settings-button-primary-shadow\)'/);

  assert.match(primitiveSource, /SETTINGS_CONTROL_MOTION_CLASSNAME/);
  assert.match(primitiveSource, /settings-control-toggle/);
  assert.match(primitiveSource, /translateX\(20px\)/);
  assert.doesNotMatch(primitiveSource, /duration-200 active:scale-95/);
  assert.match(primitiveSource, /var\(--settings-input-shadow\)/);
});

test('API settings default view gives action modules more weight than repeated info modules', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const cssSource = readSource('src/index.css');

  assert.match(viewSource, /settings-api-action-stage/);
  assert.match(viewSource, /settings-api-info-stage/);
  assert.match(cssSource, /settings-api-default-layout[\s\S]*grid-template-columns:\s*minmax\(340px, 1\.35fr\) minmax\(260px, 0\.65fr\);/);
  assert.match(cssSource, /settings-api-action-stage[\s\S]*min-height:\s*180px;/);
  assert.match(cssSource, /settings-api-info-stage[\s\S]*opacity:\s*0\.82;/);
  assert.match(viewSource, /showAdvancedWorkbench \? \(/);
});
