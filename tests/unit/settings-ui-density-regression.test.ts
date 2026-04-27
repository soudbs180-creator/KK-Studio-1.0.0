import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

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
    /\.settings-panel \.settings-shell-page--mobile \.settings-dashboard-overview-grid \{[\s\S]*display: flex;[\s\S]*flex-direction: column;/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-reference-rings \{[\s\S]*display: grid;[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(220px, 1fr\)\);/,
  );
  assert.match(
    cssSource,
    /\.settings-panel \.settings-shell-page--desktop \.settings-reference-rings \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(210px, 1fr\)\);/,
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
});
