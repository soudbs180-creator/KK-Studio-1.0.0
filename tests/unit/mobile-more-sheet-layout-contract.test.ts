import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const sourcePath = path.join(process.cwd(), 'apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');
const source = readFileSync(sourcePath, 'utf8');

test('mobile more sheet keeps project, theme, and settings in a compact equal top row', () => {
  assert.match(source, /kk-mobile-more-sheet__shortcuts mb-3 grid w-full grid-cols-3 gap-2/);

  const topRowStart = source.indexOf('kk-mobile-more-sheet__shortcuts');
  const topRowEnd = source.indexOf('{showProjectList ?', topRowStart);
  assert.notEqual(topRowStart, -1);
  assert.notEqual(topRowEnd, -1);

  const topRow = source.slice(topRowStart, topRowEnd);
  const projectIndex = topRow.indexOf('onClick={() => setShowProjectList');
  const themeIndex = topRow.indexOf('onClick={toggleTheme}');
  const settingsIndex = topRow.indexOf('data-testid="mobile-more-menu-settings"');

  assert.doesNotMatch(topRow, /toggleLanguage/);
  assert.doesNotMatch(topRow, /mobile-more-menu-favorites/);
  assert.ok(projectIndex >= 0, 'project action should start the top row');
  assert.ok(themeIndex > projectIndex, 'theme action should follow project');
  assert.ok(settingsIndex > themeIndex, 'settings action should finish the top row');
});

test('mobile more sheet lower actions remain a 2x2 grid ordered as favorites, search, ecommerce, and chat', () => {
  const lowerGridStart = source.indexOf('<div className="grid grid-cols-2 gap-2.5">');
  const lowerGridEnd = source.indexOf('</div>\n          </div>', lowerGridStart);
  assert.notEqual(lowerGridStart, -1);
  assert.notEqual(lowerGridEnd, -1);

  const lowerGrid = source.slice(lowerGridStart, lowerGridEnd);
  const favoritesIndex = lowerGrid.indexOf('data-testid="mobile-more-menu-favorites"');
  const searchIndex = lowerGrid.indexOf('runFromMoreSheet(onOpenSearch)');
  const ecommerceIndex = lowerGrid.indexOf("onScreenChange('ecommerce')");
  const chatIndex = lowerGrid.indexOf('runFromMoreSheet(onOpenChat)');

  assert.ok(favoritesIndex >= 0, 'favorites should start the lower action grid');
  assert.ok(searchIndex > favoritesIndex, 'search should follow favorites');
  assert.ok(ecommerceIndex > searchIndex, 'ecommerce should follow search');
  assert.ok(chatIndex > ecommerceIndex, 'chat should finish the lower grid');
  assert.equal([...lowerGrid.matchAll(/<button type="button"/g)].length, 4);
});
