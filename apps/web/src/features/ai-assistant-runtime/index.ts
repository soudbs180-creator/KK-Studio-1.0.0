// 简体中文：AI 助手运行时统一入口出口 (ai-assistant-runtime entry)

export { agentRuntimeInstance, AgentRuntime } from './runtime/AgentRuntime.ts';
export { agentRunStore } from './runtime/AgentRunStore.ts';
export type { AgentRunRecord } from './runtime/AgentRunStore.ts';
export { buildAgentRunTimeline } from './runtime/agentRunTimeline.ts';
export type { AgentRunTimelineStep, AgentRunTimelineStepStatus } from './runtime/agentRunTimeline.ts';
export { agentPermissionPolicy } from './runtime/AgentPermissionPolicy.ts';
export { agentAuditLog } from './runtime/AgentAuditLog.ts';

export { toolRegistryInstance, AgentToolRegistry } from './tools/ToolRegistry.ts';
export type { AgentToolDefinition } from './tools/ToolRegistry.ts';

export { durableGenerationQueue } from './queue/DurableGenerationQueue.ts';
export type { GenerationBatchJob } from './queue/DurableGenerationQueue.ts';

export { knowledgeStore } from './knowledge/KnowledgeStore.ts';
export type { KnowledgeDocument, KnowledgeSearchResult, KnowledgeChangeInput, KnowledgeChangeRecord } from './knowledge/KnowledgeStore.ts';

export { writeHandoff, formatRunRecordToMarkdown } from './memory/handoffWriter.ts';
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
