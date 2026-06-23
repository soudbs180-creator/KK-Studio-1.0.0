import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AI_MANAGEMENT_ACTIONS,
  AI_MANAGEMENT_SKILL_TOOL_OPTIONS,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/aiManagementActions.ts';
import { toolRegistryInstance } from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import { readSource } from '../support/workspacePaths.js';

const runtimeIndexSource = readSource('apps/web/src/features/ai-assistant-runtime/index.ts');
const aiManagementSource = readSource('apps/web/src/components/settings/views/AiManagementView.tsx');

test('AI Management skill tool options mirror real canonical ToolRegistry tools', () => {
  assert.match(runtimeIndexSource, /AI_MANAGEMENT_ACTIONS/);
  assert.match(runtimeIndexSource, /AI_MANAGEMENT_SKILL_TOOL_OPTIONS/);
  assert.match(aiManagementSource, /AI_MANAGEMENT_SKILL_TOOL_OPTIONS/);
  assert.doesNotMatch(aiManagementSource, /SYSTEM_TOOLS_LIST/);
  assert.doesNotMatch(aiManagementSource, /canvas\.createImageCards/);

  const registeredTools = new Map(toolRegistryInstance.getAllTools().map((tool) => [tool.name, tool]));
  const optionValues = AI_MANAGEMENT_SKILL_TOOL_OPTIONS.map((option) => option.value);

  assert.deepEqual(optionValues, Array.from(new Set(optionValues)), 'skill tool option values must be unique');

  for (const option of AI_MANAGEMENT_SKILL_TOOL_OPTIONS) {
    const registeredTool = registeredTools.get(option.value);
    assert.ok(registeredTool, `skill tool option ${option.value} must be registered`);
    assert.notEqual(registeredTool.permission, 'forbidden', `skill tool option ${option.value} must not be forbidden`);
    assert.equal(option.permission, registeredTool.permission);
  }

  for (const legacyAlias of [
    'fillPrompt',
    'locateCard',
    'zipOutputs',
    'startGeneration',
    'startBatchGeneration',
    'submitPromptComposer',
    'fillInputPrompt',
    'openSettings',
    'highlightElement',
    'locateApiCard',
    'changeMode',
    'fillApiKey',
  ]) {
    assert.ok(!optionValues.includes(legacyAlias), `legacy or forbidden tool ${legacyAlias} must not be shown`);
  }

  for (const canonicalTool of [
    'canvas.getState',
    'canvas.getSelectedNodes',
    'canvas.locateNodes',
    'canvas.arrangeNodes',
    'canvas.createPromptCards',
    'assets.resolveOriginals',
    'assets.zipOriginals',
    'generation.submitComposer',
    'generation.createBatchJob',
    'generation.retryJob',
    'ecommerce.createBatchTransformJob',
    'ui.openSettings',
    'browser.getStatus',
    'browser.openAssistant',
    'browser.extractProduct',
    'browser.generateExternal',
    'browser.publishDraft',
    'browser.inspectPage',
    'browser.openDesktopProject',
    'browser.checkLocalLlm',
    'browser.writeBackDom',
    'skills.upsertSkill',
  ]) {
    assert.ok(optionValues.includes(canonicalTool), `canonical tool ${canonicalTool} should be available`);
  }
});

test('AI Management local controls expose one stable action catalog', () => {
  assert.match(aiManagementSource, /AI_MANAGEMENT_ACTIONS/);

  const actionValues = Object.values(AI_MANAGEMENT_ACTIONS).map((action) => action.uiAction);
  assert.deepEqual(actionValues, Array.from(new Set(actionValues)), 'AI Management action names must be unique');

  for (const key of [
    'switchCapabilitiesTab',
    'switchSkillsTab',
    'toggleCapabilitySettings',
    'openCapabilityRoutes',
    'setTemperaturePrecise',
    'setTemperatureBalanced',
    'setTemperatureCreative',
    'createSkill',
    'editSkill',
    'deleteSkill',
    'toggleSkillTool',
    'closeSkillModal',
    'cancelSkillModal',
    'saveSkillModal',
  ] as const) {
    assert.ok(AI_MANAGEMENT_ACTIONS[key], `missing AI Management action ${key}`);
    assert.equal(AI_MANAGEMENT_ACTIONS[key]?.toolName, undefined);
    assert.match(
      aiManagementSource,
      new RegExp(`data-ai-management-action=\\{AI_MANAGEMENT_ACTIONS\\.${key}\\.uiAction\\}`),
      `AiManagementView should mark ${key}`
    );
  }
});

test('AI Management does not own provider capability route writes', () => {
  assert.doesNotMatch(aiManagementSource, /upsertCapabilityRouteAssignment/);
  assert.match(aiManagementSource, /subscribeCapabilityRouteAssignments/);
  assert.match(aiManagementSource, /AI_MANAGEMENT_ACTIONS\.openCapabilityRoutes\.uiAction/);
  assert.match(aiManagementSource, /\/settings\/api-management/);
});
