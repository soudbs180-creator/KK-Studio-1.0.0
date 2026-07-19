import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_SHELL_ACTIONS } from '../../apps/web/src/features/ai-assistant-runtime/runtime/chatShellActions.ts';
import { readSource } from '../support/workspacePaths.js';

test('ChatSidebar shell controls expose one stable local action catalog', () => {
  const runtimeIndexSource = readSource('apps/web/src/features/ai-assistant-runtime/index.ts');
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(runtimeIndexSource, /CHAT_SHELL_ACTIONS/);
  assert.match(sidebarSource, /CHAT_SHELL_ACTIONS/);

  const actionValues = Object.values(CHAT_SHELL_ACTIONS).map((action) => action.uiAction);
  assert.equal(new Set(actionValues).size, actionValues.length);

  for (const key of [
    'toggleSidebar',
    'closeMobileSidebar',
    'selectModel',
    'renameCurrentSession',
    'clearCurrentSession',
    'createTemporarySession',
    'createSession',
    'toggleHistoryPanel',
    'exportSessions',
    'importSessions',
    'toggleArchivedSessions',
    'toggleSessionExpand',
    'switchSession',
    'renameSession',
    'duplicateSession',
    'archiveSession',
    'deleteSession',
    'editUserMessage',
    'editPreviousUserMessage',
    'regenerateAssistantMessage',
    'branchFromMessage',
    'copyMessage',
    'removeAttachment',
    'openAttachmentMenu',
    'stopGeneration',
    'sendComposerMessage',
    'toggleImportPreviewAll',
    'toggleImportPreviewExcluded',
    'excludeVisibleImportSessions',
    'clearImportExcludedSessions',
    'importSessionsSmartMerge',
    'importSessionsAppend',
    'importSessionsReplace',
    'cancelSessionImportPreview',
  ] as const) {
    assert.ok(CHAT_SHELL_ACTIONS[key], `missing chat shell action ${key}`);
    assert.equal(CHAT_SHELL_ACTIONS[key]?.toolName, undefined);
    assert.match(
      sidebarSource,
      new RegExp(`data-chat-shell-action=\\{CHAT_SHELL_ACTIONS\\.${key}\\.uiAction\\}`),
      `ChatSidebar should mark ${key}`,
    );
  }
});

test('ChatSidebar composer send is a chat shell action, not a takeover-only action', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(sidebarSource, /data-chat-shell-action=\{CHAT_SHELL_ACTIONS\.sendComposerMessage\.uiAction\}/);
  assert.doesNotMatch(sidebarSource, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.sendTakeoverMessage\.uiAction\}/);
});

test('ChatSidebar edge toggles and model picker carry chat shell markers in every rendered state', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(
    sidebarSource,
    /<button\s+onClick=\{onToggle\}[\s\S]*?data-chat-shell-action=\{CHAT_SHELL_ACTIONS\.toggleSidebar\.uiAction\}[\s\S]*?className="kk-workspace-edge-toggle fixed/,
    'collapsed edge toggle should expose the chat sidebar toggle action',
  );
  assert.match(
    sidebarSource,
    /<button[\s\S]*?onClick=\{\(\) => onSelect\(model\)\}[\s\S]*?data-chat-shell-action=\{CHAT_SHELL_ACTIONS\.selectModel\.uiAction\}/,
    'model picker rows should expose the chat model selection action',
  );
});

test('ChatSidebar action links require an explicit user click and are never auto-executed from assistant text', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(sidebarSource, /handleActionClick/);
  assert.doesNotMatch(sidebarSource, /executedMessageIdsRef/);
  assert.doesNotMatch(sidebarSource, /lastMessage\.content\.match\(actionRegex\)/);
  assert.doesNotMatch(sidebarSource, /AI接管模式下的动作自动拦截并静默执行/);
});
