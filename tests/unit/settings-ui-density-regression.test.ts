import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('shared settings ui primitives use a calmer desktop density scale', () => {
  const source = readSource('src/components/settings/ui/index.tsx');

  assert.match(source, /borderRadius: 'var\(--radius-control-md\)'/);
  assert.match(source, /fontSize: 'var\(--type-body-2\)'/);
  assert.match(source, /fontSize: 'var\(--type-caption\)'/);
  assert.match(source, /minHeight: 'var\(--ui-control-height-default\)'/);
  assert.match(source, /minHeight: 'var\(--ui-control-height-compact\)'/);
  assert.doesNotMatch(source, /rounded-\[22px\]/);
  assert.doesNotMatch(source, /rounded-\[20px\]/);
});

test('settings workbench compacts mobile surfaces instead of stacking oversized cards', () => {
  const cssSource = readSource('src/index.css');
  const panelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');

  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \{[\s\S]*padding: 12px 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ 14px\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-reference-grid-4 \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-reference-mini-metric \{[\s\S]*padding: 10px 12px;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-hero \{[\s\S]*display: grid;[\s\S]*gap: 12px;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-hero \.settings-hero-card__header \{[\s\S]*display: grid;[\s\S]*grid-template-columns: 1fr;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-hero \.settings-hero-card__actions \{[\s\S]*display: grid;[\s\S]*grid-template-columns: 1fr;[\s\S]*margin-top: 4px;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-overview-grid \{[\s\S]*grid-template-columns: minmax\(0, 1\.55fr\) minmax\(320px, 0\.95fr\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \{[\s\S]*padding: 16px 28px 18px;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-overview-grid \{[\s\S]*display: flex;[\s\S]*flex-direction: column;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-reference-rings \{[\s\S]*display: grid;[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(220px, 1fr\)\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-secondary-grid \{[\s\S]*display: none;/,
  );
  assert.match(
    cssSource,
    /@media \(min-width: 768px\) and \(max-height: 940px\) \{[\s\S]*\.settings-panel \.settings-shell-nav__title \{[\s\S]*margin-bottom: 12px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(min-width: 768px\) and \(max-height: 940px\) \{[\s\S]*\.settings-panel \.settings-shell-nav__title p \{[\s\S]*display: none;/,
  );
  assert.match(
    cssSource,
    /@media \(min-width: 768px\) and \(max-height: 940px\) \{[\s\S]*\.settings-panel \.settings-sidebar-item \{[\s\S]*padding: 10px 12px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(min-width: 768px\) and \(max-height: 940px\) \{[\s\S]*\.settings-panel \.settings-sidebar-item__icon \{[\s\S]*width: 32px !important;[\s\S]*height: 32px !important;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-reference-chart__frame \{[\s\S]*height: 92px;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-cockpit__status,[\s\S]*\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-live-bars \{[\s\S]*min-height: 88px;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-live-bars__track \{[\s\S]*height: 44px;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-chart-metrics,[\s\S]*\.settings-panel \.settings-shell-page--desktop \.settings-dashboard-storage-pressure \{[\s\S]*display: none !important;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-chart-metrics \{[\s\S]*display: grid;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-reference-rings \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(120px, 1fr\)\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-reference-ring \{[\s\S]*width: 58px;[\s\S]*min-width: 58px;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-reference-rings \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(152px, 1fr\)\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-cockpit__flow \{[\s\S]*display: grid;[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(148px, 1fr\)\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-mobile-flow-strip \{[\s\S]*display: grid;[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(148px, 1fr\)\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-mobile__title \{[\s\S]*font-size: 22px;/,
  );
  assert.match(
    panelSource,
    /inline-flex min-h-\[32px\] items-center gap-1 rounded-full px-3 py-1\.5 text-xs font-medium/,
  );
});

test('settings workbench uses frosted glass tokens and blur layers', () => {
  const cssSource = readSource('src/index.css');

  assert.match(
    cssSource,
    /body\.dark-mode \.settings-panel \{[\s\S]*--settings-shell-bg: rgb\(12 12 14 \/ 0\.72\);/,
  );
  assert.match(
    cssSource,
    /body\.dark-mode \.settings-panel \{[\s\S]*--settings-section-bg: rgb\(29 29 31 \/ 0\.72\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-desktop,[\s\S]*\.settings-panel \.settings-shell-mobile \{[\s\S]*backdrop-filter: blur\(30px\) saturate\(1\.22\);/,
  );
  assert.doesNotMatch(
    cssSource,
    /\.settings-panel \.settings-shell,[\s\S]*\.settings-panel \.settings-shell-page--desktop,[\s\S]*backdrop-filter: blur\(30px\) saturate\(1\.22\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-reference-card,[\s\S]*\.settings-panel \.settings-provider-card \{[\s\S]*backdrop-filter: blur\(24px\) saturate\(1\.18\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-reference-mini-metric,[\s\S]*\.settings-panel \.settings-log-entry \{[\s\S]*backdrop-filter: blur\(18px\) saturate\(1\.12\);/,
  );
});
