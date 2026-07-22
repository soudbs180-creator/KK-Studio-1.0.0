const MAX_CONTEXT_TOKENS = 2_000_000;
const ENTRY_OVERHEAD_TOKENS = 4;
const SYSTEM_RULES_MAX_TOKENS = 4_096;
const WEIGHT_TOTAL = 95;

/** Exact quota partition for one bounded Planner context window. */
export interface AgentContextBudgetAllocation {
  maxTokens: number;
  systemRules: number;
  rollingSummary: number;
  recentMessages: number;
  toolResults: number;
  canvasSnapshot: number;
  knowledgeRefs: number;
  reserved: number;
}

/** Provider-independent text entry used by deterministic context selection. */
export interface AgentContextBudgetEntry {
  id: string;
  text: string;
  updatedAt: number;
}

/** Stable selected/excluded evidence and its conservative token use. */
export interface AgentContextEntrySelection {
  selectedIds: string[];
  excludedIds: string[];
  usedTokens: number;
}

/** Uses UTF-8 bytes as a deterministic provider-independent upper bound, not billing usage. */
export function estimateAgentContextTokens(text: string): number {
  return text ? new TextEncoder().encode(text).length : 0;
}

/** Allocates one exact context window according to the measurable OpenSpec Phase 3 policy. */
export function allocateAgentContextBudget(
  maxTokens: number,
): AgentContextBudgetAllocation | null {
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

/** Truncates text without splitting a Unicode code point or crossing its assigned quota. */
export function fitAgentContextText(text: string, budget: number): string {
  if (!text || budget <= 0) return '';
  let usedTokens = 0;
  const acceptedCharacters: string[] = [];
  for (const character of text) {
    const characterTokens = estimateAgentContextTokens(character);
    if (usedTokens + characterTokens > budget) break;
    acceptedCharacters.push(character);
    usedTokens += characterTokens;
  }
  return acceptedCharacters.join('');
}

/** Selects priority entries under one quota while returning them in chronological order. */
export function selectAgentContextEntries(
  entries: AgentContextBudgetEntry[],
  budget: number,
  isPriority: (entry: AgentContextBudgetEntry) => boolean,
): AgentContextEntrySelection {
  const ranked = [...entries].sort((left, right) => {
    const priorityDifference = Number(isPriority(right)) - Number(isPriority(left));
    return priorityDifference || right.updatedAt - left.updatedAt;
  });
  const selectedIds = new Set<string>();
  let usedTokens = 0;
  for (const entry of ranked) {
    const entryTokens = estimateAgentContextTokens(entry.text) + ENTRY_OVERHEAD_TOKENS;
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
