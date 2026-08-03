import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('chat sidebar AI takeover controls stay inside the composer action row', () => {
  const source = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const modeSwitchSource = readSource('apps/web/src/features/ai-takeover/components/AITakeoverToggle.tsx');

  assert.match(source, /kk-chat-sidebar-composer-actions[^"]*min-w-0[^"]*flex-wrap/);
  assert.match(source, /id="btn-desktop-ai-assistant"/);
  assert.match(source, /kk-chat-sidebar-agent-controls[^"]*min-w-0[^"]*flex-1[^"]*flex-wrap/);
  assert.match(source, /<AITakeoverToggle/);
  assert.match(modeSwitchSource, /id:\s*['"]btn-ai-direct-mode['"]/);
  assert.match(modeSwitchSource, /id:\s*['"]btn-ai-assist-mode['"]/);
  assert.match(modeSwitchSource, /id:\s*['"]btn-ai-takeover-toggle['"]/);
  assert.match(source, /currentRun[\s\S]{0,120}agentRunTimeline/);
  assert.match(source, /shouldShowTakeoverTimeline/);
  assert.match(source, /ai-takeover-run-timeline/);
  assert.match(source, /'ai-takeover-composer-input'/);
  assert.match(source, /'ai-assist-composer-input'/);
  assert.match(source, /'chat-composer-input'/);
  assert.match(source, /className="kk-chat-sidebar-send-control shrink-0"/);
});

test('generation tools use the shared notification service instead of raw DOM progress toasts', () => {
  const source = readSource('apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts');

  assert.doesNotMatch(source, /createProgressToast/);
  assert.doesNotMatch(source, /document\.createElement\('div'\)/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /style\.cssText/);
  assert.doesNotMatch(source, /kk-progress-toast/);
  assert.doesNotMatch(source, /linear-gradient\(90deg,\s*#0071e3/);
  assert.match(source, /ctx\.notify\.success\('Audio job submitted'/);
});

test('durable generation retries reuse deterministic canvas nodes', () => {
  const source = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');

  assert.match(source, /takeover_batch_\$\{jobId\}_\$\{promptId\}/);
  assert.match(source, /existingQueueNode/);
  assert.match(source, /useDraft \|\| existingQueueNode/);
  assert.match(source, /hiddenInCanvas: existingTarget\?\.hiddenInCanvas \?\? \(job\?\.outputGroup\?\.includePromptNodes === false\)/);
});

test('assistant generation jobs keep runtime prompt nodes out of the canvas by default', () => {
  const generationTools = readSource('apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts');
  const queue = readSource('apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts');
  const dock = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');
  const takeover = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  const workspace = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');

  assert.match(generationTools, /includePromptNodes: false/);
  assert.match(queue, /isLegacyDefaultAssistantGroup/);
  assert.match(dock, /job\.outputGroup\?\.includePromptNodes === false/);
  assert.match(takeover, /legacyQueuePromptNodeIds/);
  assert.match(takeover, /deletePromptNodeRef/);
  assert.match(workspace, /legacyQueueCardIds/);
  assert.match(workspace, /node\.tags\.some\(\(tag\) => tag\.startsWith\('batch:'\)\)/);
});
