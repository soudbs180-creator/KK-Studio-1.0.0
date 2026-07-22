import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyChatContextCompression,
  createChatContextCompression,
  prepareChatContextCompression,
} from '../../apps/web/src/components/layout/chat-sidebar/session/chatContextCompression.ts';
import type { Message } from '../../apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts';
import type { ChatSessionItem } from '../../apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts';

const timestamp = Date.parse('2026-07-22T10:00:00.000Z');

function createMessage(id: string, role: Message['role'], content: string, offset: number): Message {
  return { id, role, content, timestamp: timestamp + offset };
}

test('compression preparation uses the latest boundary while counting all logical covered messages', () => {
  const firstBoundary = createMessage(
    'boundary-1',
    'assistant',
    '--- 📌 上下文压缩分界线 (已归档历史) ---\n旧摘要',
    3,
  );
  const messages = [
    createMessage('welcome', 'assistant', '欢迎', 0),
    createMessage('user-1', 'user', '第一个问题', 1),
    createMessage('assistant-1', 'assistant', '第一个回答', 2),
    firstBoundary,
    createMessage('user-2', 'user', '后续问题', 4),
    createMessage('assistant-2', 'assistant', '后续回答', 5),
  ];

  const prepared = prepareChatContextCompression(messages);

  assert.deepEqual(prepared.history.map((message) => message.content), [
    firstBoundary.content,
    '后续问题',
    '后续回答',
  ]);
  assert.equal(prepared.coveredMessageCount, 4);
});

test('compression result separates canonical summary state from the compatibility boundary message', () => {
  const result = createChatContextCompression({
    summaryText: '  核心事实与已确认决策  ',
    coveredMessageCount: 6,
    modelId: 'model-1',
    timestamp,
  });

  assert.ok(result);
  assert.deepEqual(result.summary, {
    text: '核心事实与已确认决策',
    coveredMessageCount: 6,
    updatedAt: '2026-07-22T10:00:00.000Z',
  });
  assert.equal(result.boundaryMessage.modelId, 'model-1');
  assert.match(result.boundaryMessage.content, /上下文压缩分界线/);
  assert.match(result.boundaryMessage.content, /核心事实与已确认决策/);
  assert.equal(result.boundaryMessage.content === result.summary.text, false);
});

test('compression commit updates only its source Session and is idempotent', () => {
  const compression = createChatContextCompression({
    summaryText: '可持久化摘要', coveredMessageCount: 1, modelId: 'model-1', timestamp,
  });
  assert.ok(compression);
  const sessions: ChatSessionItem[] = [
    { id: 'source', title: 'source', messages: [], updatedAt: 1 },
    { id: 'other', title: 'other', messages: [], updatedAt: 2 },
  ];

  const once = applyChatContextCompression(sessions, 'source', compression);
  const twice = applyChatContextCompression(once, 'source', compression);

  assert.deepEqual(once.find((session) => session.id === 'source')?.agentSummary, compression.summary);
  assert.equal(once.find((session) => session.id === 'source')?.messages.length, 1);
  assert.equal(twice.find((session) => session.id === 'source')?.messages.length, 1);
  assert.deepEqual(twice.find((session) => session.id === 'other'), sessions[1]);
});

test('compression result rejects empty, invalid, and out-of-range evidence', () => {
  assert.equal(createChatContextCompression({
    summaryText: ' ', coveredMessageCount: 1, modelId: 'model-1', timestamp,
  }), null);
  assert.equal(createChatContextCompression({
    summaryText: '摘要', coveredMessageCount: -1, modelId: 'model-1', timestamp,
  }), null);
  assert.equal(createChatContextCompression({
    summaryText: '摘要', coveredMessageCount: 1, modelId: 'model-1', timestamp: Number.NaN,
  }), null);
});
