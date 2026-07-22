import type { AgentSessionUpsertDto } from '@kk/shared';
import type { ChatAgentSummary, Message } from './chatSessionData';

const MAX_CONTEXT_TOKENS = 2_000_000;
const ENTRY_OVERHEAD_TOKENS = 4;
const SYSTEM_RULES_MAX_TOKENS = 4_096;
const WEIGHT_TOTAL = 95;

/** Exact quota partition for one bounded Planner context window. */
export interface ChatAgentContextBudgetAllocation {
  maxTokens: number;
  systemRules: number;
  rollingSummary: number;
  recentMessages: number;
  toolResults: number;
  canvasSnapshot: number;
  knowledgeRefs: number;
  reserved: number;
}

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

interface EntrySelection {
  selectedIds: string[];
  excludedIds: string[];
  usedTokens: number;
}

/** Uses UTF-8 bytes as a deterministic provider-independent upper bound, not billing usage. */
export function estimateConservativeContextTokens(text: string): number {
  return text ? new TextEncoder().encode(text).length : 0;
}

/** Allocates one exact context window according to the measurable OpenSpec Phase 3 policy. */
export function allocateChatAgentContextBudget(
  maxTokens: number,
): ChatAgentContextBudgetAllocation | null {
  if (!Number.isInteger(maxTokens) || maxTokens <= 0 || maxTokens > MAX_CONTEXT_TOKENS) return null;
  const reserved = Math.max(1, Math.floor(maxTokens * 0.05));
  const inputCapacity = maxTokens - reserved;
  const systemRules = inputCapacity > 0
    ? Math.min(SYSTEM_RULES_MAX_TOKENS, Math.max(1, Math.floor(inputCapacity * 0.05)))
    : 0;
  const weightedCapacity = inputCapacity - systemRules;
  const rollingSummary = Math.floor((weightedCapacity * 20) / WEIGHT_TOTAL);
  const toolResults = Math.floor((weightedCapacity * 20) / WEIGHT_TOTAL);
  const canvasSnapshot = Math.floor((weightedCapacity * 15) / WEIGHT_TOTAL);
  const knowledgeRefs = Math.floor((weightedCapacity * 10) / WEIGHT_TOTAL);
  const recentMessages = weightedCapacity
    - rollingSummary - toolResults - canvasSnapshot - knowledgeRefs;
  return {
    maxTokens, systemRules, rollingSummary, recentMessages, toolResults,
    canvasSnapshot, knowledgeRefs, reserved,
  };
}

function fitTextToBudget(text: string, budget: number): string {
  if (!text || budget <= 0) return '';
  let usedTokens = 0;
  const acceptedCharacters: string[] = [];
  for (const character of text) {
    const characterTokens = estimateConservativeContextTokens(character);
    if (usedTokens + characterTokens > budget) break;
    acceptedCharacters.push(character);
    usedTokens += characterTokens;
  }
  return acceptedCharacters.join('');
}

function getRecentRoundIds(messages: Message[]): Set<string> {
  const userIndexes = messages
    .map((message, index) => message.role === 'user' ? index : -1)
    .filter((index) => index >= 0);
  const startIndex = userIndexes[Math.max(0, userIndexes.length - 2)];
  if (startIndex === undefined) return new Set(messages.map((message) => message.id));
  return new Set(messages.slice(startIndex).map((message) => message.id));
}

function selectEntries(
  entries: ChatAgentContextEntry[],
  budget: number,
  isPriority: (entry: ChatAgentContextEntry) => boolean,
): EntrySelection {
  const ranked = [...entries].sort((left, right) => {
    const priorityDifference = Number(isPriority(right)) - Number(isPriority(left));
    return priorityDifference || right.updatedAt - left.updatedAt;
  });
  const selectedIds = new Set<string>();
  let usedTokens = 0;
  for (const entry of ranked) {
    const entryTokens = estimateConservativeContextTokens(entry.text) + ENTRY_OVERHEAD_TOKENS;
    if (usedTokens + entryTokens > budget) continue;
    selectedIds.add(entry.id);
    usedTokens += entryTokens;
  }
  const chronological = [...entries].sort((left, right) => left.updatedAt - right.updatedAt);
  return {
    selectedIds: chronological.filter((entry) => selectedIds.has(entry.id)).map((entry) => entry.id),
    excludedIds: chronological.filter((entry) => !selectedIds.has(entry.id)).map((entry) => entry.id),
    usedTokens,
  };
}

function selectPlanEntries(
  input: ChatAgentContextPlanInput,
  allocation: ChatAgentContextBudgetAllocation,
) {
  const messages = input.messages.filter((message) => message.id !== 'welcome');
  const recentRoundIds = getRecentRoundIds(messages);
  const messageEntries = messages.map((message) => ({
    id: message.id, text: message.content, updatedAt: message.timestamp,
  }));
  return {
    messages: selectEntries(messageEntries, allocation.recentMessages, (entry) => recentRoundIds.has(entry.id)),
    tools: selectEntries(input.toolResults || [], allocation.toolResults, (entry) => entry.confirmed === false),
    canvas: selectEntries(input.canvasSnapshots || [], allocation.canvasSnapshot, () => false),
    knowledge: selectEntries(input.knowledgeRefs || [], allocation.knowledgeRefs, () => false),
  };
}

/** Builds the bounded Planner projection and an AgentTokenBudgetDto-compatible evidence snapshot. */
export function buildChatAgentContextPlan(
  input: ChatAgentContextPlanInput,
): ChatAgentContextPlanResult {
  const allocation = allocateChatAgentContextBudget(input.maxTokens);
  if (!allocation) return { ok: false, reason: 'invalid_max_tokens' };
  const systemRules = fitTextToBudget(input.systemRules, allocation.systemRules);
  const summary = fitTextToBudget(input.summary?.text || '', allocation.rollingSummary);
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
