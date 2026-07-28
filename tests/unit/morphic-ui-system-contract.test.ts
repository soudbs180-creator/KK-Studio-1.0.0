import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UI_SYSTEM_TOKENS } from '@kk/ui/core';
import { readSource } from '../support/workspacePaths.js';

test('Morphic workspace geometry is published by the shared UI package', () => {
  assert.deepEqual(UI_SYSTEM_TOKENS.color, {
    canvas: '#000000',
    page: '#171717',
    panel: 'oklch(0.235 0 0)',
    control: 'oklch(0.2603 0 0)',
    hover: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.06)',
    textPrimary: 'oklch(0.97 0 0)',
    textSecondary: 'oklch(0.708 0 0)',
    textMuted: 'oklch(0.556 0 0)',
    textDisabled: 'oklch(0.439 0 0)',
    actionPrimary: 'oklch(0.5926 0.2236 258.42)',
  });

  assert.equal(UI_SYSTEM_TOKENS.typography.fontFamily, 'Inter, sans-serif');
  const layoutSource = readSource('packages/ui/src/core/layout.ts');
  assert.match(layoutSource, /topBarHeight:\s*48/);
  assert.match(layoutSource, /leftPanelWidth:\s*262/);
  assert.match(layoutSource, /composerMaxWidth:\s*570/);
  assert.match(layoutSource, /dialogWidth:\s*412/);
  assert.match(layoutSource, /mobileDrawerMaxWidth:\s*320/);
});

test('shared web package exports the complete Morphic primitive set', () => {
  const webIndexSource = readSource('packages/ui/src/web/index.ts');

  for (const component of [
    'KkSurface',
    'KkTabs',
    'KkComposerShell',
    'KkSheet',
    'KkTooltip',
  ]) {
    assert.match(
      webIndexSource,
      new RegExp(`export \\* from './${component}(?:\\.tsx)?'`),
      `missing ${component} export`,
    );
  }

  const surfaceSource = readSource('packages/ui/src/web/KkSurface.tsx');
  assert.match(surfaceSource, /'canvas' \| 'panel' \| 'control' \| 'dialog' \| 'sheet'/);
});

test('shared controls consume CSS classes without legacy Frost or Clay appearance', () => {
  for (const fileName of [
    'KkButton.tsx',
    'KkInput.tsx',
    'KkModal.tsx',
    'KkSelect.tsx',
    'KkDropdown.tsx',
  ]) {
    const source = readSource(`packages/ui/src/web/${fileName}`);
    assert.doesNotMatch(source, /frost|clay/i, `${fileName} still references a legacy theme`);
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i, `${fileName} still contains a raw color`);
  }
});

test('sheet locks background scrolling and exposes a readable close control', () => {
  const sheetSource = readSource('packages/ui/src/web/KkSheet.tsx');

  assert.match(sheetSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(sheetSource, /document\.body\.style\.overflow = previousBodyOverflow/);
  assert.match(sheetSource, /aria-label="关闭"/);
  assert.match(sheetSource, />\s*×\s*<\/button>/);
});

test('the web app exposes the dark workspace system and responsive safe-area rules', () => {
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');
  const mainSource = readSource('apps/web/src/main.tsx');
  const bootstrapSource = readSource('apps/web/src/bootstrap.tsx');

  for (const token of [
    '--kk-morphic-canvas',
    '--kk-morphic-page',
    '--kk-morphic-panel',
    '--kk-morphic-control',
    '--kk-morphic-action',
    '--kk-morphic-topbar-height',
    '--kk-morphic-composer-width',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-surface',
    '.kk-tabs',
    '.kk-composer-shell',
    '.kk-sheet',
    '.kk-tooltip',
    '.kk-morphic-workspace',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }

  assert.match(cssSource, /safe-area-inset-top/);
  assert.match(cssSource, /safe-area-inset-bottom/);
  assert.match(cssSource, /@media\s*\(max-width:\s*768px\)/);
  assert.match(mainSource, /import '\.\/styles\/morphic-ui\.css';/);
  assert.match(bootstrapSource, /import '\.\/styles\/morphic-ui\.css';/);
});
