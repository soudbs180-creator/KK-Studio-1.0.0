// 简体中文：AI 控制面按钮与 AgentRuntime / ToolRegistry 动作的稳定映射，供界面、测试和治理脚本共用。

type AgentControlActionDefinition = {
  uiAction: string;
  runtimeAction?: string;
  toolName?: string;
};

export const AGENT_CONTROL_ACTIONS = {
  confirmPlan: {
    uiAction: 'confirm-plan',
    runtimeAction: 'executePendingRun',
  },
  cancelPlan: {
    uiAction: 'cancel-plan',
    runtimeAction: 'cancelPendingRun',
  },
  archiveFinishedGenerationJobs: {
    uiAction: 'archive-finished-generation-jobs',
    toolName: undefined,
  },
  pauseGenerationJob: {
    uiAction: 'pause-durable-job',
    toolName: 'generation.pauseJob',
  },
  resumeGenerationJob: {
    uiAction: 'resume-durable-job',
    toolName: 'generation.resumeJob',
  },
  retryGenerationJob: {
    uiAction: 'retry-durable-job',
    toolName: 'generation.retryJob',
  },
  locateGenerationJobOutputs: {
    uiAction: 'locate-durable-job',
    toolName: undefined,
  },
  cancelGenerationJob: {
    uiAction: 'cancel-durable-job',
    toolName: 'generation.cancelJob',
  },
  compressContext: {
    uiAction: 'compress-context',
    toolName: undefined,
  },
  sendTakeoverMessage: {
    uiAction: 'send-takeover-message',
    toolName: undefined,
  },
  importTakeoverImage: {
    uiAction: 'import-takeover-image',
    toolName: undefined,
  },
  importTakeoverFolder: {
    uiAction: 'import-takeover-folder',
    toolName: undefined,
  },
  connectTakeoverFile: {
    uiAction: 'connect-takeover-file',
    toolName: undefined,
  },
  toggleTakeoverResources: {
    uiAction: 'toggle-takeover-resources',
    toolName: undefined,
  },
  closeTakeoverResources: {
    uiAction: 'close-takeover-resources',
    toolName: undefined,
  },
  removeTakeoverImage: {
    uiAction: 'remove-takeover-image',
    toolName: undefined,
  },
  removeTakeoverFile: {
    uiAction: 'remove-takeover-file',
    toolName: undefined,
  },
  runInlineActionLink: {
    uiAction: 'run-inline-action-link',
    toolName: undefined,
  },
  closeTakeoverMode: {
    uiAction: 'close-takeover-mode',
    toolName: undefined,
  },
  toggleTakeoverMode: {
    uiAction: 'toggle-takeover-mode',
    toolName: undefined,
  },
  toggleTakeoverHistory: {
    uiAction: 'toggle-takeover-history',
    toolName: undefined,
  },
} as const satisfies Record<string, AgentControlActionDefinition>;

export type AgentControlActionKey = keyof typeof AGENT_CONTROL_ACTIONS;
export type AgentControlUiAction = typeof AGENT_CONTROL_ACTIONS[AgentControlActionKey]['uiAction'];
export type AgentControlRuntimeAction = Extract<typeof AGENT_CONTROL_ACTIONS[AgentControlActionKey], { runtimeAction: string }>['runtimeAction'];
export type AgentControlToolName = Extract<typeof AGENT_CONTROL_ACTIONS[AgentControlActionKey], { toolName: string }>['toolName'];
