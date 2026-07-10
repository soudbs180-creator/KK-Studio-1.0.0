import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('mobile workspace omits task-center chrome while desktop keeps the fixed tray', () => {
  const workspace = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const shell = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');
  const mobileWorkspace = readSource('apps/web/src/app/AppMobileWorkspace.tsx');
  const mobileSurface = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');

  assert.doesNotMatch(workspace, /taskCenter=\{/);
  assert.match(workspace, /!isMobile && !isLargeProject && \(/);
  assert.match(workspace, /<TaskCenterTray[\s\S]{0,160}onOpenSettings=/);
  assert.doesNotMatch(shell, /taskCenter/);
  assert.doesNotMatch(mobileWorkspace, /taskCenter/);
  assert.doesNotMatch(mobileSurface, /taskCenter/);
  assert.match(shell, /gridTemplateRows:\s*'minmax\(0, 1fr\) auto'/);
});

test('task center remains desktop-only and does not retain mobile summary or sheet markup', () => {
  const tray = readSource('apps/web/src/components/workspace/TaskCenterTray.tsx');

  assert.match(tray, /data-testid="desktop-task-center"/);
  assert.doesNotMatch(tray, /mobile-task-center/);
  assert.doesNotMatch(tray, /variant\?:\s*'desktop'\s*\|\s*'mobile'/);
  assert.doesNotMatch(tray, /createPortal\(/);
  assert.match(tray, /zIndex:\s*KK_LAYER\.floatingPanel/);
  assert.match(tray, /isSetupRequiredError/);
  assert.doesNotMatch(tray, /z-\[1000\]/);
});
