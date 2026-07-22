import type { AgentSessionUpsertDto } from '@kk/shared';
import {
  allocateAgentContextBudget,
  estimateAgentContextTokens,
  fitAgentContextText,
  selectAgentContextEntries,
  type AgentContextBudgetAllocation,
} from '../../../../features/ai-takeover/core/agentContextBudget.ts';
import type { ChatAgentSummary, Message } from './chatSessionData';

/** Exact quota partition for one bounded Planner context window. */
export type ChatAgentContextBudgetAllocation = AgentContextBudgetAllocation;

/** Text-only context source; binary attachments remain canonical Asset references elsewhere. */
export interface ChatAgentContextEntry {
  id: string;
  text: string;
  updatedAt: number;
  confirmed?: boolean;
}

interface ChatAgentContextPlanInput {
  maxTokens: number;
  systemRules: string;
  summary?: ChatAgentSummary;
  messages: Message[];
  toolResults?: ChatAgentContextEntry[];
  canvasSnapshots?: ChatAgentContextEntry[];
  knowledgeRefs?: ChatAgentContextEntry[];
}

interface SelectedChatAgentContext {
  systemRules: string;
  summary: string;
  messageIds: string[];
  toolResultIds: string[];
  canvasSnapshotIds: string[];
  knowledgeRefIds: string[];
}

interface ExcludedChatAgentContext {
  messageIds: string[];
  toolResultIds: string[];
  canvasSnapshotIds: string[];
  knowledgeRefIds: string[];
}

/** Bounded context selection plus DTO-compatible aggregate budget evidence. */
export interface ChatAgentContextPlan {
  allocation: ChatAgentContextBudgetAllocation;
  selected: SelectedChatAgentContext;
  excluded: ExcludedChatAgentContext;
  tokenBudget: AgentSessionUpsertDto['tokenBudget'];
}

/** Fail-closed result for invalid model context limits. */
export type ChatAgentContextPlanResult =
  | { ok: true; data: ChatAgentContextPlan }
  | { ok: false; reason: 'invalid_max_tokens' };

/** Uses UTF-8 bytes as a deterministic provider-independent upper bound, not billing usage. */
export const estimateConservativeContextTokens = estimateAgentContextTokens;

/** Allocates one exact context window according to the measurable OpenSpec Phase 3 policy. */
export const allocateChatAgentContextBudget = allocateAgentContextBudget;

function getRecentRoundIds(messages: Message[]): Set<string> {
  const userIndexes = messages
    .map((message, index) => message.role === 'user' ? index : -1)
    .filter((index) => index >= 0);
  const startIndex = userIndexes[Math.max(0, userIndexes.length - 2)];
  if (startIndex === undefined) return new Set(messages.map((message) => message.id));
  return new Set(messages.slice(startIndex).map((message) => message.id));
}

function selectPlanEntries(
  input: ChatAgentContextPlanInput,
  allocation: ChatAgentContextBudgetAllocation,
) {
  const messages = input.messages.filter((message) => message.id !== 'welcome');
  const recentRoundIds = getRecentRoundIds(messages);
  const pendingToolIds = new Set(
    (input.toolResults || []).filter((entry) => entry.confirmed === false).map((entry) => entry.id),
  );
  const messageEntries = messages.map((message) => ({
    id: message.id, text: message.content, updatedAt: message.timestamp,
  }));
  return {
    messages: selectAgentContextEntries(
      messageEntries, allocation.recentMessages, (entry) => recentRoundIds.has(entry.id),
    ),
    tools: selectAgentContextEntries(
      input.toolResults || [], allocation.toolResults,
      (entry) => pendingToolIds.has(entry.id),
    ),
    canvas: selectAgentContextEntries(input.canvasSnapshots || [], allocation.canvasSnapshot, () => false),
    knowledge: selectAgentContextEntries(input.knowledgeRefs || [], allocation.knowledgeRefs, () => false),
  };
}

/** Builds the bounded Planner projection and an AgentTokenBudgetDto-compatible evidence snapshot. */
export function buildChatAgentContextPlan(
  input: ChatAgentContextPlanInput,
): ChatAgentContextPlanResult {
  const allocation = allocateChatAgentContextBudget(input.maxTokens);
  if (!allocation) return { ok: false, reason: 'invalid_max_tokens' };
  const systemRules = fitAgentContextText(input.systemRules, allocation.systemRules);
  const summary = fitAgentContextText(input.summary?.text || '', allocation.rollingSummary);
  const entries = selectPlanEntries(input, allocation);
  const usedTokens = estimateConservativeContextTokens(systemRules)
    + estimateConservativeContextTokens(summary)
    + entries.messages.usedTokens + entries.tools.usedTokens
    + entries.canvas.usedTokens + entries.knowledge.usedTokens;
  return {
    ok: true,
    data: {
      allocation,
      selected: {
        systemRules, summary,
        messageIds: entries.messages.selectedIds,
        toolResultIds: entries.tools.selectedIds,
        canvasSnapshotIds: entries.canvas.selectedIds,
        knowledgeRefIds: entries.knowledge.selectedIds,
      },
      excluded: {
        messageIds: entries.messages.excludedIds,
        toolResultIds: entries.tools.excludedIds,
        canvasSnapshotIds: entries.canvas.excludedIds,
        knowledgeRefIds: entries.knowledge.excludedIds,
      },
      tokenBudget: {
        maxTokens: allocation.maxTokens,
        usedTokens,
        reservedTokens: allocation.reserved,
      },
    },
  };
}
