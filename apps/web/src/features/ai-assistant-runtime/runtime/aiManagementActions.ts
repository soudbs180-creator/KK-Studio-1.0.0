import type { ToolPermission } from '../../ai-takeover/types.ts';
import { TOOL_REGISTRY } from '../tools/ToolRegistry.ts';

type AiManagementActionDefinition = {
  uiAction: `ai-management.${string}`;
  toolName?: undefined;
};

export const AI_MANAGEMENT_ACTIONS = {
  switchCapabilitiesTab: {
    uiAction: 'ai-management.switchCapabilitiesTab',
    toolName: undefined,
  },
  switchSkillsTab: {
    uiAction: 'ai-management.switchSkillsTab',
    toolName: undefined,
  },
  toggleCapabilitySettings: {
    uiAction: 'ai-management.toggleCapabilitySettings',
    toolName: undefined,
  },
  openCapabilityRoutes: {
    uiAction: 'ai-management.openCapabilityRoutes',
    toolName: undefined,
  },
  setTemperaturePrecise: {
    uiAction: 'ai-management.setTemperaturePrecise',
    toolName: undefined,
  },
  setTemperatureBalanced: {
    uiAction: 'ai-management.setTemperatureBalanced',
    toolName: undefined,
  },
  setTemperatureCreative: {
    uiAction: 'ai-management.setTemperatureCreative',
    toolName: undefined,
  },
  createSkill: {
    uiAction: 'ai-management.createSkill',
    toolName: undefined,
  },
  editSkill: {
    uiAction: 'ai-management.editSkill',
    toolName: undefined,
  },
  deleteSkill: {
    uiAction: 'ai-management.deleteSkill',
    toolName: undefined,
  },
  toggleSkillTool: {
    uiAction: 'ai-management.toggleSkillTool',
    toolName: undefined,
  },
  closeSkillModal: {
    uiAction: 'ai-management.closeSkillModal',
    toolName: undefined,
  },
  cancelSkillModal: {
    uiAction: 'ai-management.cancelSkillModal',
    toolName: undefined,
  },
  saveSkillModal: {
    uiAction: 'ai-management.saveSkillModal',
    toolName: undefined,
  },
} as const satisfies Record<string, AiManagementActionDefinition>;

export type AiManagementActionKey = keyof typeof AI_MANAGEMENT_ACTIONS;
export type AiManagementUiAction = (typeof AI_MANAGEMENT_ACTIONS)[AiManagementActionKey]['uiAction'];

export type AiManagementSkillToolOption = {
  value: string;
  label: string;
  permission: Exclude<ToolPermission, 'forbidden'>;
};

const CANONICAL_SKILL_TOOL_NAMES = [
  'navigation.openSurface',
  'navigation.openSettings',
  'workspace.getState',
  'workspace.focus',
  'project.list',
  'project.getActive',
  'project.open',
  'project.create',
  'project.rename',
  'project.delete',
  'canvas.getState',
  'canvas.getSelectedNodes',
  'canvas.locateNodes',
  'canvas.arrangeNodes',
  'canvas.createPromptCards',
  'canvas.createAudioCard',
  'assets.resolveOriginals',
  'assets.list',
  'assets.zipOriginals',
  'export.getCapabilities',
  'generation.createBatchJob',
  'generation.pauseJob',
  'generation.resumeJob',
  'generation.retryJob',
  'generation.getJobStatus',
  'generation.cancelJob',
  'generation.createAudioTask',
  'ecommerce.createBatchTransformJob',
  'provider.getModelCapabilities',
  'knowledge.searchProject',
  'knowledge.recordChange',
  'skills.upsertSkill',
  'prompt.fillPrompt',
  'prompt.optimizeInput',
  'optimizePromptLocally',
  'history.getState',
  'history.undo',
  'history.redo',
  'preferences.get',
  'preferences.updateGenerationDefaults',
  'account.getSummary',
  'billing.getSummary',
  'browser.getStatus',
  'browser.openAssistant',
  'browser.extractProduct',
  'browser.generateExternal',
  'browser.publishDraft',
  'browser.inspectPage',
  'browser.openDesktopProject',
  'browser.checkLocalLlm',
  'browser.writeBackDom',
] as const;

const toolByName = new Map(TOOL_REGISTRY.map((tool) => [tool.name, tool]));

export const AI_MANAGEMENT_SKILL_TOOL_OPTIONS: AiManagementSkillToolOption[] = CANONICAL_SKILL_TOOL_NAMES
  .map((name) => {
    const tool = toolByName.get(name);
    if (!tool || tool.permission === 'forbidden') {
      return undefined;
    }

    return {
      value: tool.name,
      label: `${tool.name} (${tool.description})`,
      permission: tool.permission,
    };
  })
  .filter((tool): tool is AiManagementSkillToolOption => Boolean(tool));
