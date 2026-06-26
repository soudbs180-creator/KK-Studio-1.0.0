import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('chat sidebar AI takeover controls stay inside the composer action row', () => {
  const source = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(source, /kk-chat-sidebar-composer-actions[^"]*min-w-0[^"]*flex-wrap/);
  assert.match(source, /kk-chat-sidebar-agent-controls[^"]*min-w-0[^"]*flex-1[^"]*flex-wrap/);
  assert.match(source, /id="btn-ai-takeover-toggle"[\s\S]{0,520}className=\{`shrink-0/);
  assert.match(source, /currentRun[\s\S]{0,120}agentRunTimeline/);
  assert.match(source, /shouldShowTakeoverTimeline/);
  assert.match(source, /ai-takeover-run-timeline/);
  assert.match(source, /id=\{aiTakeoverMode \? 'ai-takeover-composer-input' : 'chat-composer-input'\}/);
  assert.match(source, /className="kk-chat-sidebar-send-control shrink-0"/);
});

test('desktop chrome exposes a stable AI assistant entrypoint wired to the existing chat panel', () => {
  const desktopChromeSource = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const workspaceSource = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');

  assert.match(desktopChromeSource, /id="btn-desktop-ai-assistant"/);
  assert.match(desktopChromeSource, /aria-pressed=\{isChatOpen\}/);
  assert.match(desktopChromeSource, /onClick=\{onToggleChat\}/);
  assert.match(desktopChromeSource, /aria-label="AI assistant"/);
  assert.match(workspaceSource, /isChatOpen=\{isChatOpen\}/);
  assert.match(workspaceSource, /onToggleChat=\{toggleChatPanel\}/);
});

test('generation tools use the shared notification service instead of raw DOM progress toasts', () => {
  const source = readSource('apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts');

  assert.doesNotMatch(source, /createProgressToast/);
  assert.doesNotMatch(source, /document\.createElement\('div'\)/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /style\.cssText/);
  assert.doesNotMatch(source, /kk-progress-toast/);
  assert.doesNotMatch(source, /linear-gradient\(90deg,\s*#0071e3/);
  assert.match(source, /notify\.info\('音频合成中'/);
});
