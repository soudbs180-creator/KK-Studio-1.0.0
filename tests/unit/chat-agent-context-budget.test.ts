import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  allocateChatAgentContextBudget,
  buildChatAgentContextPlan,
  estimateConservativeContextTokens,
} from '../../apps/web/src/components/layout/chat-sidebar/session/chatAgentContextBudget.ts';
import type { Message } from '../../apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts';

function createMessage(id: string, role: Message['role'], content: string, timestamp: number): Message {
  return { id, role, content, timestamp };
}

test('budget allocation is exact, deterministic, and follows the OpenSpec proportions', () => {
  const allocation = allocateChatAgentContextBudget(10_000);

  assert.deepEqual(allocation, {
    maxTokens: 10_000,
    systemRules: 475,
    rollingSummary: 1_900,
    recentMessages: 2_850,
    toolResults: 1_900,
    canvasSnapshot: 1_425,
    knowledgeRefs: 950,
    reserved: 500,
  });
  assert.equal(Object.values(allocation).slice(1).reduce((sum, value) => sum + value, 0), 10_000);
  assert.equal(allocateChatAgentContextBudget(0), null);
  assert.equal(allocateChatAgentContextBudget(2_000_001), null);
});

test('context measurement uses a provider-independent UTF-8 upper bound', () => {
  assert.equal(estimateConservativeContextTokens('A'), 1);
  assert.equal(estimateConservativeContextTokens('你'), 3);
  assert.equal(estimateConservativeContextTokens(''), 0);
});

test('message trimming prioritizes the latest two user-led rounds and preserves chronological output', () => {
  const messages = [
    createMessage('user-1', 'user', 'aaaaa', 1),
    createMessage('assistant-1', 'assistant', 'bbbbb', 2),
    createMessage('user-2', 'user', 'ccccc', 3),
    createMessage('assistant-2', 'assistant', 'ddddd', 4),
    createMessage('user-3', 'user', 'eeeee', 5),
    createMessage('assistant-3', 'assistant', 'fffff', 6),
  ];

  const result = buildChatAgentContextPlan({
    maxTokens: 100,
    systemRules: '',
    messages,
    toolResults: [],
    canvasSnapshots: [],
    knowledgeRefs: [],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.selected.messageIds, ['assistant-2', 'user-3', 'assistant-3']);
  assert.deepEqual(result.data.excluded.messageIds, ['user-1', 'assistant-1', 'user-2']);
  assert.equal(result.data.tokenBudget.usedTokens + result.data.tokenBudget.reservedTokens <= 100, true);
});

test('unconfirmed tool results outrank newer confirmed results under pressure', () => {
  const result = buildChatAgentContextPlan({
    maxTokens: 100,
    systemRules: '',
    messages: [],
    toolResults: [
      { id: 'pending', text: '123456789', updatedAt: 1, confirmed: false },
      { id: 'confirmed', text: '123456789', updatedAt: 2, confirmed: true },
    ],
    canvasSnapshots: [],
    knowledgeRefs: [],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.selected.toolResultIds, ['pending']);
  assert.deepEqual(result.data.excluded.toolResultIds, ['confirmed']);
});

test('summary and system rules are clipped to their own quotas without exceeding the DTO budget', () => {
  const result = buildChatAgentContextPlan({
    maxTokens: 100,
    systemRules: 'system-rules-that-do-not-fit',
    summary: { text: 'summary-that-is-longer-than-its-budget', coveredMessageCount: 2, updatedAt: '2026-07-22T10:00:00.000Z' },
    messages: [],
    toolResults: [],
    canvasSnapshots: [],
    knowledgeRefs: [],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(estimateConservativeContextTokens(result.data.selected.systemRules) <= 4, true);
  assert.equal(estimateConservativeContextTokens(result.data.selected.summary) <= 19, true);
  assert.deepEqual(result.data.tokenBudget, {
    maxTokens: 100,
    usedTokens: 23,
    reservedTokens: 5,
  });
});
