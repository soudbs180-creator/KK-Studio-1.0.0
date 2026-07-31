import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('desktop and mobile reuse the same persistent task-center projection', () => {
  const workspace = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const shell = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');
  const mobileWorkspace = readSource('apps/web/src/app/AppMobileWorkspace.tsx');
  const mobileSurface = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');

  assert.doesNotMatch(workspace, /taskCenter=\{/);
  assert.match(workspace, /!isLargeProject && \(/);
  assert.match(workspace, /<TaskCenterTray[\s\S]{0,240}isMobile=\{isMobile\}/);
  assert.doesNotMatch(shell, /taskCenter/);
  assert.doesNotMatch(mobileWorkspace, /taskCenter/);
  assert.doesNotMatch(mobileSurface, /taskCenter/);
  assert.match(shell, /gridTemplateRows:\s*'minmax\(0, 1fr\) auto'/);
});

test('task center projects Queue and Agent Run state without a second mobile store', () => {
  const tray = readSource('apps/web/src/components/workspace/TaskCenterTray.tsx');
  const tokens = readSource('apps/web/src/styles/kk-ui-tokens.css');

  assert.match(tray, /data-testid="desktop-task-center"/);
  assert.match(tray, /className="kk-task-center-host/);
  assert.match(tray, /data-state=\{isOpen \? ['"]open['"] : ['"]collapsed['"]\}/);
  assert.match(tray, /\{!isOpen && !isMobile && \(/);
  assert.match(tray, /aria-label="展开任务状态列表"/);
  assert.match(tray, /className="kk-task-center-rail"/);
  assert.match(tray, /document\.activeElement/);
  const transientTaskHandler = tray.match(/const handleAddTask[\s\S]*?const handleUpdateTask/)?.[0] || '';
  assert.doesNotMatch(transientTaskHandler, /setIsOpen\(true\)/);
  assert.match(tray, /TASK_CENTER_OPEN_EVENT/);
  assert.doesNotMatch(tray, /kk_custom_tasks/);
  assert.match(tray, /agentRunStore\.subscribe/);
  assert.match(tray, /durableGenerationQueue\.archiveJob\(task\.id\)/);
  assert.match(tray, /agentRunStore\.archiveRun\(task\.id\)/);
  assert.match(tray, /data-mobile=\{isMobile \? ['"]true['"] : ['"]false['"]\}/);
  assert.doesNotMatch(tray, /mobile-task-center/);
  assert.doesNotMatch(tray, /variant\?:\s*'desktop'\s*\|\s*'mobile'/);
  assert.doesNotMatch(tray, /createPortal\(/);
  assert.match(tray, /zIndex:\s*KK_LAYER\.floatingPanel/);
  assert.match(tray, /isSetupRequiredError/);
  assert.doesNotMatch(tray, /z-\[1000\]/);
  assert.match(tokens, /\.kk-task-center-morph\[data-state='open'\]/);
  assert.match(tokens, /\.kk-task-center-rail[\s\S]{0,320}background: var\(--state-info-text\)/);
  assert.doesNotMatch(
    tokens.match(/\.kk-task-center-morph\[data-state='open'\][\s\S]*?\n\}/)?.[0] || '',
    /backdrop-filter|frost-card-framework/,
  );
  assert.match(tokens, /\.kk-task-center-panel[\s\S]{0,180}kk-task-center-panel-enter/);
  assert.match(tokens, /\.kk-task-center-host\[data-mobile='true'\]/);
});
