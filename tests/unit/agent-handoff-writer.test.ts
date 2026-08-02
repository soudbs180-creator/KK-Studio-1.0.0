import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatRunRecordToMarkdown,
  getHandoffStorageKey,
  writeHandoff,
} from '../../apps/web/src/features/ai-assistant-runtime/memory/handoffWriter.ts';
import type { AgentRunRecord } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';

test('HandoffWriter: formatRunRecordToMarkdown 能够正确渲染 markdown 文本', () => {
  const record: AgentRunRecord = {
    id: 'run_test_123',
    userMessage: '下载我选好的卡片',
    intent: 'download_outputs',
    plan: {},
    status: 'completed',
    toolCalls: [
      {
        id: 'tc_1',
        runId: 'run_test_123',
        toolName: 'canvas.getSelectedNodes',
        inputSummary: '{}',
        outputSummary: '{"nodesCount":2}',
        status: 'success',
        startedAt: '2026-06-04T00:00:01.000Z',
        completedAt: '2026-06-04T00:00:01.100Z'
      },
      {
        id: 'tc_2',
        runId: 'run_test_123',
        toolName: 'assets.zipOriginals',
        inputSummary: '{"scope":"selected_cards"}',
        status: 'failed',
        error: 'network_down',
        startedAt: '2026-06-04T00:00:02.000Z',
        completedAt: '2026-06-04T00:00:03.000Z'
      }
    ],
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:03.000Z',
    nextStep: '请用户检查网络设置。'
  };

  const md = formatRunRecordToMarkdown(record);
  assert.ok(md.includes('run_test_123'));
  assert.ok(md.includes('下载我选好的卡片'));
  assert.ok(md.includes('download_outputs'));
  assert.ok(md.includes('canvas.getSelectedNodes'));
  assert.ok(md.includes('assets.zipOriginals'));
  assert.ok(md.includes('network_down'));
  assert.ok(md.includes('请用户检查网络设置'));
});

test('HandoffWriter: writeHandoff 在 Node 环境下成功写入本地 docs 文件', async () => {
  const record: AgentRunRecord = {
    id: 'run_temp_test_999',
    userMessage: '测试写入',
    intent: 'test',
    plan: {},
    status: 'completed',
    toolCalls: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const root = process.cwd();
  const docsPath = path.join(root, '.tmp', `session-handoff-test-${process.pid}.md`);
  const previousHandoffPath = process.env.KK_HANDOFF_FS_PATH;
  
  // 备份原 handoff 文件（若存在）
  let originalContent = '';
  const fileExists = fs.existsSync(docsPath);
  if (fileExists) {
    originalContent = fs.readFileSync(docsPath, 'utf8');
  }

  try {
    process.env.KK_ENABLE_HANDOFF_FS_WRITE = '1';
    process.env.KK_HANDOFF_FS_PATH = docsPath;
    await writeHandoff(record, 'handoff-fs-test-owner');
    
    // 确认文件存在并包含 record 关键标识
    assert.equal(fs.existsSync(docsPath), true);
    const content = fs.readFileSync(docsPath, 'utf8');
    assert.ok(content.includes('run_temp_test_999'));
    assert.ok(content.includes('测试写入'));
  } finally {
    delete process.env.KK_ENABLE_HANDOFF_FS_WRITE;
    if (previousHandoffPath === undefined) delete process.env.KK_HANDOFF_FS_PATH;
    else process.env.KK_HANDOFF_FS_PATH = previousHandoffPath;
    // 恢复文件内容
    if (fileExists) {
      fs.writeFileSync(docsPath, originalContent, 'utf8');
    } else {
      try {
        fs.unlinkSync(docsPath);
      } catch {}
    }
  }
});

test('HandoffWriter: browser projection is owner-scoped and removes the legacy global key', async (t) => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>([['kk_agent_handoffs', 'legacy cross-owner content']]);
  const storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
  } satisfies Storage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  process.env.KK_DISABLE_HANDOFF_FS_WRITE = '1';
  t.after(() => {
    delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;
    if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    else delete (globalThis as any).localStorage;
  });

  const createRecord = (id: string, message: string): AgentRunRecord => ({
    id,
    userMessage: message,
    intent: 'test',
    plan: {},
    status: 'completed',
    toolCalls: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await writeHandoff(createRecord('run-owner-a', 'owner A content'), 'owner-a');
  await writeHandoff(createRecord('run-owner-b', 'owner B content'), 'owner-b');

  const ownerAContent = storage.getItem(getHandoffStorageKey('owner-a')) || '';
  const ownerBContent = storage.getItem(getHandoffStorageKey('owner-b')) || '';
  assert.match(ownerAContent, /run-owner-a/);
  assert.doesNotMatch(ownerAContent, /run-owner-b|owner B content/);
  assert.match(ownerBContent, /run-owner-b/);
  assert.doesNotMatch(ownerBContent, /run-owner-a|owner A content/);
  assert.equal(storage.getItem('kk_agent_handoffs'), null);
});

test('HandoffWriter: markdown output redacts secrets and flattens injected headings', () => {
  const record: AgentRunRecord = {
    id: 'run-redacted-handoff',
    userMessage: 'please retry\n### forged heading\nAuthorization: Bearer handoff-secret-token',
    intent: 'test',
    plan: {},
    status: 'failed',
    toolCalls: [{
      id: 'tool-redacted-handoff',
      runId: 'run-redacted-handoff',
      toolName: 'test.failure',
      inputSummary: 'postgresql://demo:db-password@example.test/app',
      status: 'failed',
      error: 'Cookie: session=private-cookie',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextStep: 'password="handoff-password"',
  };

  const markdown = formatRunRecordToMarkdown(record);
  for (const secret of ['handoff-secret-token', 'db-password', 'private-cookie', 'handoff-password']) {
    assert.equal(markdown.includes(secret), false);
  }
  assert.doesNotMatch(markdown, /\n### forged heading/);
  assert.match(markdown, /Authorization: \*\*\*/);
});

test('HandoffWriter: filesystem projection is disabled unless explicitly enabled', async () => {
  const docsPath = path.join(process.cwd(), 'docs', 'development', 'session-handoff.md');
  const before = fs.existsSync(docsPath) ? fs.readFileSync(docsPath, 'utf8') : null;
  delete process.env.KK_ENABLE_HANDOFF_FS_WRITE;
  delete process.env.KK_DISABLE_HANDOFF_FS_WRITE;

  await writeHandoff({
    id: 'run-fs-opt-in-guard',
    userMessage: 'must not reach the project handoff by default',
    intent: 'test',
    plan: {},
    status: 'completed',
    toolCalls: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, 'owner-fs-opt-in-guard');

  const after = fs.existsSync(docsPath) ? fs.readFileSync(docsPath, 'utf8') : null;
  assert.equal(after, before);
});
