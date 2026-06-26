import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('App delegates mobile rendering to MobileWorkspaceSurface instead of assembling mobile header/feed/composer inline', () => {
  const workspacePageSource = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const appMobileWorkspaceSource = readSource('apps/web/src/app/AppMobileWorkspace.tsx');

  assert.match(workspacePageSource, /AppMobileWorkspace/);
  assert.match(workspacePageSource, /<AppMobileWorkspace/);
  assert.match(appMobileWorkspaceSource, /import \{[\s\S]*?MobileWorkspaceSurface[\s\S]*?\} from '\.\.\/components\/mobile';/);
  assert.match(appMobileWorkspaceSource, /<MobileWorkspaceSurface/);
  assert.doesNotMatch(workspacePageSource, /const mobileHeader = isMobile \?/);
  assert.doesNotMatch(workspacePageSource, /const mobileFeed = isMobile \?/);
  assert.doesNotMatch(workspacePageSource, /const mobileComposer = isMobile \?/);
});

test('mobile component barrel exports the dedicated mobile surface entry', () => {
  const mobileIndexSource = readSource('apps/web/src/components/mobile/index.ts');

  assert.match(mobileIndexSource, /export \{ default as MobileWorkspaceSurface \} from '\.\/MobileWorkspaceSurface';/);
});

test('App prepares mobile result entries before the blocking hydration guard to keep hook order stable', () => {
  const appMobileWorkspaceSource = readSource('apps/web/src/app/AppMobileWorkspace.tsx');
  const guardIndex = appMobileWorkspaceSource.indexOf('if (!isMobile) {');
  const mobileResultEntriesIndex = appMobileWorkspaceSource.indexOf('const resultEntries = React.useMemo<MobileResultEntry[]>(');

  assert.notEqual(guardIndex, -1);
  assert.notEqual(mobileResultEntriesIndex, -1);
  assert.ok(
    mobileResultEntriesIndex < guardIndex,
    'resultEntries useMemo must be declared before the mobile shell short-circuit guard',
  );
});
