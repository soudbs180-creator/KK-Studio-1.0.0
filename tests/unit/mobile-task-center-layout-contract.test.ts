import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('mobile workspace mounts an inline task summary instead of the desktop fixed tray', () => {
  const workspace = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const shell = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');

  assert.match(workspace, /taskCenter=\{\([\s\S]{0,100}<TaskCenterTray[\s\S]{0,80}variant="mobile"/);
  assert.match(workspace, /!isMobile && !isLargeProject && \(/);
  assert.match(workspace, /<TaskCenterTray[\s\S]{0,160}variant="desktop"/);
  assert.match(shell, /taskCenter\?: ReactNode/);
  assert.match(shell, /\{taskCenter \? \([\s\S]{0,180}data-slot="task-center"/);
});

test('mobile task summary has a 44px target and opens a safe-area bottom sheet on token layers', () => {
  const tray = readSource('apps/web/src/components/workspace/TaskCenterTray.tsx');

  assert.match(tray, /data-testid="mobile-task-center-summary"/);
  assert.match(tray, /data-testid="desktop-task-center"/);
  assert.match(tray, /min-h-11 w-full/);
  assert.match(tray, /data-testid="mobile-task-center-sheet"/);
  assert.match(tray, /createPortal\(/);
  assert.match(tray, /document\.body/);
  assert.match(tray, /style=\{\{ zIndex: KK_LAYER\.modal \}\}/);
  assert.match(tray, /pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(tray, /aria-label="复制任务错误"/);
  assert.match(tray, /aria-label="去配置 API"/);
  assert.match(tray, /aria-label="清理任务记录"/);
  assert.match(tray, /isSetupRequiredError/);
  assert.doesNotMatch(tray, /z-\[1000\]/);
  assert.match(tray, /variant === 'desktop'/);
});
