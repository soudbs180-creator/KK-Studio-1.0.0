import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const sourcePath = path.join(process.cwd(), 'apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');
const source = readFileSync(sourcePath, 'utf8');

test('mobile more sheet keeps language, favorites, and project in a compact 22/22/56 top row', () => {
  assert.match(source, /grid-cols-\[22fr_22fr_56fr\]/);

  const topRowStart = source.indexOf('grid-cols-[22fr_22fr_56fr]');
  const topRowEnd = source.indexOf('{showProjectList ?', topRowStart);
  assert.notEqual(topRowStart, -1);
  assert.notEqual(topRowEnd, -1);

  const topRow = source.slice(topRowStart, topRowEnd);
  const languageIndex = topRow.indexOf('onClick={toggleLanguage}');
  const favoritesIndex = topRow.indexOf('data-testid="mobile-more-menu-favorites"');
  const projectIndex = topRow.indexOf('onClick={() => setShowProjectList');

  assert.doesNotMatch(topRow, /toggleTheme/);
  assert.ok(languageIndex >= 0, 'language action should start the top row');
  assert.ok(favoritesIndex > languageIndex, 'favorites action should move into the compact top-row slot');
  assert.ok(projectIndex > favoritesIndex, 'project action should remain the final half-width top-row item');
});

test('mobile more sheet lower actions remain a 2x2 grid after favorites moves to the top row', () => {
  const lowerGridStart = source.indexOf('<div className="grid grid-cols-2 gap-2.5">');
  const settingsIndex = source.indexOf('data-testid="mobile-more-menu-settings"', lowerGridStart);
  assert.notEqual(lowerGridStart, -1);
  assert.notEqual(settingsIndex, -1);

  const lowerGrid = source.slice(lowerGridStart, settingsIndex);
  assert.doesNotMatch(lowerGrid, /data-testid="mobile-more-menu-favorites"/);
  assert.equal([...lowerGrid.matchAll(/<button type="button"/g)].length, 3);
});
