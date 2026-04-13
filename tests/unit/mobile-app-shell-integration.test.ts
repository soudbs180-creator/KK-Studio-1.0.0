import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('App delegates mobile rendering to MobileWorkspaceSurface instead of assembling mobile header/feed/composer inline', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /MobileWorkspaceSurface/);
  assert.match(appSource, /<MobileWorkspaceSurface/);
  assert.doesNotMatch(appSource, /const mobileHeader = isMobile \?/);
  assert.doesNotMatch(appSource, /const mobileFeed = isMobile \?/);
  assert.doesNotMatch(appSource, /const mobileComposer = isMobile \?/);
});

test('mobile component barrel exports the dedicated mobile surface entry', () => {
  const mobileIndexSource = readSource('src/components/mobile/index.ts');

  assert.match(mobileIndexSource, /export \{ default as MobileWorkspaceSurface \} from '\.\/MobileWorkspaceSurface';/);
});

test('App prepares mobile result entries before the blocking hydration guard to keep hook order stable', () => {
  const appSource = readSource('src/App.tsx');
  const guardIndex = appSource.indexOf('if (!isReady) {');
  const mobileResultEntriesIndex = appSource.indexOf('const mobileResultEntries = React.useMemo<MobileResultEntry[]>(');

  assert.notEqual(guardIndex, -1);
  assert.notEqual(mobileResultEntriesIndex, -1);
  assert.ok(
    mobileResultEntriesIndex < guardIndex,
    'mobileResultEntries useMemo must be declared before the blocking hydration guard',
  );
});
