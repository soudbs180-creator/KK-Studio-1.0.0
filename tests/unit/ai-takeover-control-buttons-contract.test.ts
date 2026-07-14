import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_CONTROL_ACTIONS } from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentControlActions.ts';
import { readSource } from '../support/workspacePaths.js';

test('AI Takeover confirmation buttons declare the AgentRuntime action they trigger', () => {
  const dockSource = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const runtimeIndexSource = readSource('apps/web/src/features/ai-assistant-runtime/index.ts');

  assert.match(runtimeIndexSource, /AGENT_CONTROL_ACTIONS/);

  for (const source of [dockSource, sidebarSource]) {
    assert.match(source, /AGENT_CONTROL_ACTIONS/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.cancelPlan\.uiAction\}/);
    assert.match(source, /data-agent-runtime-action=\{AGENT_CONTROL_ACTIONS\.cancelPlan\.runtimeAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.confirmPlan\.uiAction\}/);
    assert.match(source, /data-agent-runtime-action=\{AGENT_CONTROL_ACTIONS\.confirmPlan\.runtimeAction\}/);
  }

  const takeoverContext = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  assert.match(takeoverContext, /agentRuntimeInstance\.executePendingRun/);
  assert.match(takeoverContext, /agentRuntimeInstance\.cancelPendingRun/);
  assert.doesNotMatch(takeoverContext, /executeAction/);
});

test('AI Takeover durable queue buttons map to one shared action and tool contract', () => {
  const dockSource = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.equal(AGENT_CONTROL_ACTIONS.pauseGenerationJob?.toolName, 'generation.pauseJob');
  assert.equal(AGENT_CONTROL_ACTIONS.resumeGenerationJob?.toolName, 'generation.resumeJob');
  assert.equal(AGENT_CONTROL_ACTIONS.retryGenerationJob?.toolName, 'generation.retryJob');
  assert.equal(AGENT_CONTROL_ACTIONS.cancelGenerationJob?.toolName, 'generation.cancelJob');
  assert.equal(AGENT_CONTROL_ACTIONS.archiveFinishedGenerationJobs?.toolName, undefined);
  assert.equal(AGENT_CONTROL_ACTIONS.locateGenerationJobOutputs?.toolName, undefined);

  for (const source of [dockSource, sidebarSource]) {
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.archiveFinishedGenerationJobs\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.pauseGenerationJob\.uiAction\}/);
    assert.match(source, /data-agent-tool=\{AGENT_CONTROL_ACTIONS\.pauseGenerationJob\.toolName\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.resumeGenerationJob\.uiAction\}/);
    assert.match(source, /data-agent-tool=\{AGENT_CONTROL_ACTIONS\.resumeGenerationJob\.toolName\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.retryGenerationJob\.uiAction\}/);
    assert.match(source, /data-agent-tool=\{AGENT_CONTROL_ACTIONS\.retryGenerationJob\.toolName\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.locateGenerationJobOutputs\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.cancelGenerationJob\.uiAction\}/);
    assert.match(source, /data-agent-tool=\{AGENT_CONTROL_ACTIONS\.cancelGenerationJob\.toolName\}/);
  }
});

test('AI Takeover composer and resource buttons share stable local action names', () => {
  const dockSource = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const smokeSource = readSource('scripts/test/verify-ai-takeover-smoke.mjs');

  for (const key of [
    'compressContext',
    'sendTakeoverMessage',
    'importTakeoverImage',
    'importTakeoverFolder',
    'connectTakeoverFile',
    'toggleTakeoverResources',
    'closeTakeoverResources',
    'removeTakeoverImage',
    'removeTakeoverFile',
  ] as const) {
    assert.equal(AGENT_CONTROL_ACTIONS[key]?.toolName, undefined);
  }

  for (const source of [dockSource, sidebarSource]) {
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.compressContext\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.importTakeoverImage\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.importTakeoverFolder\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.connectTakeoverFile\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.toggleTakeoverResources\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.closeTakeoverResources\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.removeTakeoverImage\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.removeTakeoverFile\.uiAction\}/);
  }

  assert.match(dockSource, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.sendTakeoverMessage\.uiAction\}/);
  assert.match(dockSource, /id="ai-takeover-dock-composer-input"/);
  assert.match(smokeSource, /id="ai-takeover-dock-composer-input"/);
  assert.doesNotMatch(sidebarSource, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.sendTakeoverMessage\.uiAction\}/);
});

test('AI Takeover shell controls share stable local action names', () => {
  const dockSource = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const modeSwitchSource = readSource('apps/web/src/features/ai-takeover/components/AITakeoverToggle.tsx');

  for (const key of [
    'runInlineActionLink',
    'closeTakeoverMode',
    'toggleTakeoverMode',
    'toggleTakeoverHistory',
  ] as const) {
    assert.ok(AGENT_CONTROL_ACTIONS[key]);
    assert.equal(AGENT_CONTROL_ACTIONS[key]?.toolName, undefined);
  }

  for (const source of [dockSource, sidebarSource]) {
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.runInlineActionLink\.uiAction\}/);
    assert.match(source, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.toggleTakeoverHistory\.uiAction\}/);
  }

  assert.match(dockSource, /data-agent-action=\{AGENT_CONTROL_ACTIONS\.closeTakeoverMode\.uiAction\}/);
  assert.match(sidebarSource, /<AITakeoverToggle/);
  for (const key of ['setDirectMode', 'setAssistMode', 'setTakeoverMode'] as const) {
    assert.ok(AGENT_CONTROL_ACTIONS[key]);
    assert.equal(AGENT_CONTROL_ACTIONS[key]?.toolName, undefined);
    assert.match(modeSwitchSource, new RegExp(`AGENT_CONTROL_ACTIONS\\.${key}\\.uiAction`));
  }
});
