// 简体中文：AI 助手运行时统一入口出口 (ai-assistant-runtime entry)

export { agentRuntimeInstance, AgentRuntime, verifyAgentPlanStep } from './runtime/AgentRuntime.ts';
export type { AgentPlanStepVerificationResult } from './runtime/AgentRuntime.ts';
export type {
  AssistantAuthorizationScopeSnapshot,
  AssistantConfirmedStepAuthorization,
  AssistantConfirmationGrant,
  AssistantExecutionContext,
  AssistantExecutionNotificationPort,
  AssistantExecutionTrigger,
  AssistantSiteCapabilityPorts,
  AssistantProjectCapabilityPort,
  AssistantProjectSnapshot,
  AssistantProjectSummary,
  AssistantHistoryCapabilityPort,
  AssistantHistorySnapshot,
  AssistantPreferenceCapabilityPort,
  AssistantGenerationPreferencePatch,
  AssistantGenerationPreferenceSnapshot,
  AssistantNavigationCapabilityPort,
  AssistantAccountCapabilityPort,
  AssistantAccountSummary,
  AssistantBillingSummary,
  AssistantAssetCapabilityPort,
  AssistantToolExecutionContext,
} from './runtime/AssistantExecutionContext.ts';
export {
  captureAssistantAuthorizationScope,
  createAssistantScopedInputFingerprint,
  createAssistantStepAuthorization,
  createUserActionConfirmation,
  doesAssistantGrantAuthorizeStep,
  isAssistantConfirmationGrantFresh,
  sameAssistantStepAuthorizations,
} from './runtime/AssistantExecutionContext.ts';
export { agentRunStore } from './runtime/AgentRunStore.ts';
export type { AgentRunRecord } from './runtime/AgentRunStore.ts';
export { buildAgentRunTimeline } from './runtime/agentRunTimeline.ts';
export type { AgentRunTimelineStep, AgentRunTimelineStepStatus } from './runtime/agentRunTimeline.ts';
export { AGENT_CONTROL_ACTIONS } from './runtime/agentControlActions.ts';
export type { AgentControlActionKey, AgentControlRuntimeAction, AgentControlToolName, AgentControlUiAction } from './runtime/agentControlActions.ts';
export { CHAT_SHELL_ACTIONS } from './runtime/chatShellActions.ts';
export type { ChatShellActionKey, ChatShellToolName, ChatShellUiAction } from './runtime/chatShellActions.ts';
export { PROMPT_COMPOSER_ACTIONS } from './runtime/promptComposerActions.ts';
export type { PromptComposerActionKey, PromptComposerToolName, PromptComposerUiAction } from './runtime/promptComposerActions.ts';
export { AI_MANAGEMENT_ACTIONS, AI_MANAGEMENT_SKILL_TOOL_OPTIONS } from './runtime/aiManagementActions.ts';
export type { AiManagementActionKey, AiManagementSkillToolOption, AiManagementUiAction } from './runtime/aiManagementActions.ts';
export { agentPermissionPolicy } from './runtime/AgentPermissionPolicy.ts';
export { agentAuditLog } from './runtime/AgentAuditLog.ts';

export { toolRegistryInstance, AgentToolRegistry } from './tools/ToolRegistry.ts';
export type {
  AgentToolControlMetadata,
  AgentToolControlOverrides,
  AgentToolCostKind,
  AgentToolDefinition,
  AgentToolEffect,
  AgentToolImpactScope,
  ResolvedAgentToolDefinition,
} from './tools/ToolRegistry.ts';

export { durableGenerationQueue } from './queue/DurableGenerationQueue.ts';
export type { GenerationBatchJob } from './queue/DurableGenerationQueue.ts';

export { knowledgeStore } from './knowledge/KnowledgeStore.ts';
export type { KnowledgeDocument, KnowledgeSearchResult, KnowledgeChangeInput, KnowledgeChangeRecord } from './knowledge/KnowledgeStore.ts';

export { writeHandoff, formatRunRecordToMarkdown } from './memory/handoffWriter.ts';
export {
  BROWSER_ACTIONS,
  BROWSER_ACTION_LIST,
  BROWSER_LOCAL_ACTIONS,
  BROWSER_LOCAL_ACTION_LIST,
  getBrowserActionByCommandKind,
  getBrowserLocalActionByActionName,
  getBrowserActionByToolName
} from './browser/browserActionCatalog.ts';
export type {
  BrowserActionDefinition,
  BrowserLocalActionDefinition,
  BrowserLocalActionName,
  BrowserLocalAgentToolName,
  BrowserToolName
} from './browser/browserActionCatalog.ts';

export {
  browserBridgeAdapter,
  createBrowserBridgeCommand,
  createBrowserBridgeSetupRequiredResult,
  redactBrowserBridgePayload,
  sanitizeBrowserBridgeUrl
} from './browser/browserBridge.ts';
export type {
  BrowserBridgeClient,
  BrowserBridgeCommand,
  BrowserBridgeCommandKind,
  BrowserBridgeResult,
  BrowserBridgeStatusSnapshot
} from './browser/browserBridge.ts';
