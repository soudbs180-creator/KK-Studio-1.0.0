import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';
import {
  requestTaskCenterOpen,
  TASK_CENTER_OPEN_EVENT,
} from '../../apps/web/src/components/workspace/taskCenterEvents.ts';

test('mobile composer uses the shared three-layer input hierarchy and keeps an active draft expanded', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const modePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const countFieldSource = readSource('apps/web/src/components/layout/prompt-bar/ComposerGenerationCountField.tsx');

  assert.match(promptBarSource, /data-mobile-composer-layer="references"/);
  assert.match(promptBarSource, /data-mobile-composer-layer="prompt"/);
  assert.match(promptBarSource, /data-mobile-composer-layer="actions"/);
  assert.match(
    promptBarSource,
    /data-mobile-composer-layer="actions"[\s\S]*ReferenceImage[\s\S]*model[\s\S]*settings[\s\S]*PromptVoiceInputButton[\s\S]*CreditSendButton/,
  );
  assert.doesNotMatch(
    promptBarSource,
    /void onGenerate\(\);\s*setIsExpanded\(false\)/,
  );
  assert.match(promptBarSource, /mobileComposerShouldStayExpanded/);
  assert.doesNotMatch(promptBarSource, /<DesktopComposerCountControl/);
  assert.match(countFieldSource, /kk-composer-parameter-count/);
  assert.match(modePanelSource, /onParallelCountChange/);
});

test('settings mobile shell uses the data-rich dashboard and a three-section account hierarchy', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const profileSource = readSource('apps/web/src/components/settings/views/UserProfileView.tsx');

  assert.match(shellSource, /<SettingsMobileDashboard/);
  assert.doesNotMatch(shellSource, /<SettingsConsoleMobileHome/);
  assert.match(profileSource, /账户资料/);
  assert.match(profileSource, /账单余额/);
  assert.match(profileSource, /安全设置/);
  assert.doesNotMatch(profileSource, /充值积分/);
  assert.doesNotMatch(profileSource, /资料编辑/);
});

test('mobile ecommerce controls share one compact hierarchy with voice input and a white arrow send action', () => {
  const ecommerceSource = readSource('apps/web/src/components/mobile/MobileEcommercePanel.tsx');

  assert.match(ecommerceSource, /mobile-ecommerce-header/);
  assert.match(ecommerceSource, /mobile-ecommerce-inspiration/);
  assert.match(ecommerceSource, /grid-cols-3/);
  assert.match(ecommerceSource, /PromptVoiceInputButton/);
  assert.match(ecommerceSource, /mobile-ecommerce-voice/);
  assert.match(ecommerceSource, /<ArrowUp/);
  assert.match(ecommerceSource, /aria-pressed=\{activeRatio === item\.ratio\}/);
});

test('mobile overlays are full-screen while task progress opens through the shared task center', () => {
  const workspaceStyles = readSource('apps/web/src/styles/workspace-ui-v3.css');
  const resultFeedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const traySource = readSource('apps/web/src/components/workspace/TaskCenterTray.tsx');

  assert.match(workspaceStyles, /#ai-assistant-sidebar[\s\S]*height:\s*100dvh/);
  assert.match(workspaceStyles, /\.workspace-favorites-panel\.is-mobile[\s\S]*height:\s*100dvh/);
  assert.match(workspaceStyles, /\.kk-mobile-more-action[\s\S]*grid-template-columns/);
  assert.match(resultFeedSource, /requestTaskCenterOpen/);
  assert.match(traySource, /TASK_CENTER_OPEN_EVENT/);
});

test('task center open requests use one shared event contract', () => {
  const target = new EventTarget();
  let requestCount = 0;
  target.addEventListener(TASK_CENTER_OPEN_EVENT, () => {
    requestCount += 1;
  });

  requestTaskCenterOpen(target);

  assert.equal(requestCount, 1);
});
