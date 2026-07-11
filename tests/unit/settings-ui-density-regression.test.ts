import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('settings console uses the specified compact density scale', () => {
  const cssSource = readSource('apps/web/src/styles/settings-console.css');

  assert.match(cssSource, /--console-radius: 8px;/);
  assert.match(cssSource, /--console-control-radius: 6px;/);
  assert.match(cssSource, /--console-module-gap: 16px;/);
  assert.match(cssSource, /\.settings-console-nav__item \{[\s\S]*min-height: 40px;/);
  assert.match(cssSource, /\.console-page-header h2 \{[\s\S]*font-size: 20px !important;/);
  assert.match(cssSource, /\.console-card :where\([\s\S]*font-size: 15px !important;/);
});

test('mobile settings keeps a grouped full-width home and compact 2x2 profile metrics', () => {
  const cssSource = readSource('apps/web/src/styles/settings-console.css');
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');

  assert.match(shellSource, /SettingsConsoleMobileHome/);
  assert.match(cssSource, /\.settings-console-mobile-list button,[\s\S]*width: 100%;/);
  assert.match(cssSource, /@media \(max-width: 767px\) \{[\s\S]*\.console-profile-metrics \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(cssSource, /\.settings-console-content--mobile \{[\s\S]*padding: 14px 12px/);
});

test('desktop console grids adapt before content becomes cramped', () => {
  const cssSource = readSource('apps/web/src/styles/settings-console.css');

  assert.match(cssSource, /@media \(max-width: 1180px\) \{[\s\S]*\.console-grid,[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(cssSource, /@media \(max-width: 767px\) \{[\s\S]*\.console-recharge-layout,[\s\S]*grid-template-columns: 1fr;/);
  assert.match(cssSource, /\.console-data-table__head,[\s\S]*grid-template-columns: 150px minmax\(180px, 1fr\) 92px 96px;/);
});
