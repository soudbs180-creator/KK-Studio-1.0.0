import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatRunRecordToMarkdown, writeHandoff } from '../../apps/web/src/features/ai-assistant-runtime/memory/handoffWriter.ts';
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
  const docsPath = path.join(root, 'docs', 'development', 'session-handoff.md');
  
  // 备份原 handoff 文件（若存在）
  let originalContent = '';
  const fileExists = fs.existsSync(docsPath);
  if (fileExists) {
    originalContent = fs.readFileSync(docsPath, 'utf8');
  }

  try {
    await writeHandoff(record);
    
    // 确认文件存在并包含 record 关键标识
    assert.equal(fs.existsSync(docsPath), true);
    const content = fs.readFileSync(docsPath, 'utf8');
    assert.ok(content.includes('run_temp_test_999'));
    assert.ok(content.includes('测试写入'));
  } finally {
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
