import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readFullCssSource(): string {
  try {
    const indexCss = readSource('apps/web/src/index.css');
    const tokensCss = readSource('apps/web/src/styles/tokens.css');
    const baseCss = readSource('apps/web/src/styles/base.css');
    const canvasCss = readSource('apps/web/src/styles/canvas.css');
    const vendorCss = readSource('apps/web/src/styles/vendor-overrides.css');
    return [indexCss, tokensCss, baseCss, canvasCss, vendorCss].join('\n');
  } catch (e) {
    return readSource('apps/web/src/index.css');
  }
}



test('shared settings ui primitives use a calmer desktop density scale', () => {
  const source = readSource('apps/web/src/components/settings/ui/index.tsx');
  const cssSource = readSource('apps/web/src/styles/settings.css');

  assert.match(source, /borderRadius: 'var\(--radius-control-md\)'/);
  assert.match(source, /fontSize: 'var\(--type-body-2\)'/);
  assert.match(source, /fontSize: 'var\(--type-caption\)'/);
  assert.match(source, /minHeight: 'var\(--ui-control-height-default\)'/);
  assert.match(
    cssSource,
    /\.settings-panel \.settings-icon-button \{[\s\S]*min-height:\s*var\(--ui-control-height-compact\);/,
  );
  assert.doesNotMatch(source, /rounded-\[22px\]/);
  assert.doesNotMatch(source, /rounded-\[20px\]/);
});

test('settings workbench compacts mobile surfaces instead of stacking oversized cards', () => {
  const cssSource = readFullCssSource() + '\n' + readSource('apps/web/src/styles/settings.css');
  const panelSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');

  assert.match(
    cssSource,
    /--clay-mobile-shell-padding: 12px 8px calc\(env\(safe-area-inset-bottom, 0px\) \+ 14px\);/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 767px\) \{[\s\S]*\.settings-panel \.settings-shell-mobile__topbar \{[\s\S]*left: 24px !important;[\s\S]*right: 24px !important;[\s\S]*width: auto !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 767px\) \{[\s\S]*\.settings-panel \.settings-shell-page--mobile \{[\s\S]*padding-left: 8px !important;[\s\S]*padding-right: 8px !important;/,
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

test('API workbench overview uses a compact 2x2 mobile card grid', () => {
  const workbenchSectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(
    workbenchSectionsSource,
    /className="api-workbench-overview-grid grid grid-cols-2 gap-3 xl:grid-cols-4"/,
  );
  assert.match(
    workbenchSectionsSource,
    /@media \(max-width: 767px\) \{[\s\S]*\.api-workbench-overview-grid \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    workbenchSectionsSource,
    /\.api-workbench-overview-grid \.premium-info-card \{[\s\S]*min-height: 128px;[\s\S]*flex-direction: column;/,
  );
  assert.match(workbenchSectionsSource, /premium-info-card__value/);
  assert.match(workbenchSectionsSource, /premium-info-card__helper/);
});

test('settings workbench uses frosted glass tokens and blur layers', () => {
  const cssSource = readFullCssSource() + '\n' + readSource('apps/web/src/styles/settings.css');

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

test('settings desktop grids adapt before cards and field copy become cramped', () => {
  const cssSource = readSource('apps/web/src/styles/settings.css');
  const baseCssSource = readSource('apps/web/src/styles/base.css');
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');

  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page \{[\s\S]*min-width:\s*0;[\s\S]*overflow-x:\s*hidden;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-view-shell,[\s\S]*\.settings-panel \.settings-reference-stack \{[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*100%;/,
  );
  assert.match(
    cssSource,
    /@media \(min-width: 768px\) \{[\s\S]*\.settings-panel \.settings-system-field \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(
    cssSource,
    /@media \(min-width: 1024px\) \{[\s\S]*\.settings-panel \.settings-system-grid > \.settings-system-card--wide \.settings-system-field \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(180px,\s*240px\);/,
  );
  assert.match(
    dashboardSource,
    /\.dashboard-command-center \{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*280px\),\s*1fr\)\);/,
  );
  assert.match(
    dashboardSource,
    /\.dashboard-panel \{[\s\S]*box-sizing:\s*border-box;/,
  );
  assert.match(
    dashboardSource,
    /@media \(min-width: 760px\) and \(max-width: 1179px\) \{[\s\S]*\.dashboard-command-center \{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    dashboardSource,
    /@media \(min-width: 1180px\) \{[\s\S]*\.dashboard-command-center \{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /@media \(min-width: 900px\) \{[\s\S]*\.dashboard-command-center \{[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(
    dashboardSource,
    /\.dashboard-command-center > \.dashboard-panel \{[\s\S]*height:\s*auto\s*!important;[\s\S]*max-height:\s*none\s*!important;/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /\.dashboard-panel__glow \{[^}]*inset:\s*-\d+px\s+-\d+px\s+auto\s+auto;/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /\.dashboard-panel__glow \{[^}]*transform:\s*translate\(/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /\.dashboard-panel__glow \{[^}]*filter:\s*blur\(/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /\.dashboard-panel__glow \{[^}]*height:\s*180px;/,
  );

  for (const rowSpan of ['2', '3', '4']) {
    const rowSelector = `\\.dashboard-grid-card\\.a-card-span-${rowSpan}-row`;
    assert.doesNotMatch(
      baseCssSource,
      new RegExp(`${rowSelector}\\s*\\{[\\s\\S]*?(?:^|\\n)\\s*height:\\s*\\d+px\\s*!important;`),
    );
    assert.doesNotMatch(
      baseCssSource,
      new RegExp(`${rowSelector}\\s*\\{[\\s\\S]*?max-height:\\s*\\d+px\\s*!important;`),
    );
  }
});
