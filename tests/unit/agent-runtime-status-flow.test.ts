import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    },
    removeItem(key: string) {
      delete store[key];
    }
  };
})();

globalThis.localStorage = mockLocalStorage as any;

import { agentRunStore, AgentRunStore } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';

describe('AgentRunStore Status Flow Tests', () => {
  before(() => {
    globalThis.localStorage = mockLocalStorage as any;
    mockLocalStorage.clear();
    agentRunStore.clearRuns();
  });

  it('P0: should initialize run status to waiting_execution if requiresConfirmation is false', () => {
    mockLocalStorage.clear();
    agentRunStore.clearRuns();

    const plan = {
      intent: 'test',
      requiresConfirmation: false
    };

    const record = agentRunStore.createRun('打开日志', 'test', plan);
    assert.equal(record.status, 'waiting_execution');
  });

  it('P0: should initialize run status to waiting_confirmation if requiresConfirmation is true', () => {
    mockLocalStorage.clear();
    agentRunStore.clearRuns();

    const plan = {
      intent: 'test',
      requiresConfirmation: true
    };

    const record = agentRunStore.createRun('生成图片', 'test', plan);
    assert.equal(record.status, 'waiting_confirmation');
  });

  it('P0: zombie running/waiting_execution jobs should heal to failed on load', () => {
    globalThis.localStorage = mockLocalStorage as any;
    mockLocalStorage.clear();
    
    // 手动在 localStorage 里写入处于 running 和 waiting_execution 的脏记录
    const dirtyRuns = [
      {
        id: 'run_1',
        userMessage: 'test',
        intent: 'test',
        plan: {},
        status: 'running',
        toolCalls: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'run_2',
        userMessage: 'test2',
        intent: 'test',
        plan: {},
        status: 'waiting_execution',
        toolCalls: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    mockLocalStorage.setItem('kk_agent_runs_history', JSON.stringify(dirtyRuns));

    // 实例化一个新的 Store，它在 constructor 里调用 loadRuns()
    const tempStore = new AgentRunStore();

    const run1 = tempStore.getRun('run_1')!;
    const run2 = tempStore.getRun('run_2')!;

    // 状态必须被修正为 failed
    assert.equal(run1.status, 'failed');
    assert.equal(run1.nextStep, '任务运行异常中断，请重试。');
    assert.equal(run2.status, 'failed');
    assert.equal(run2.nextStep, '任务运行异常中断，请重试。');
  });

  it('P0: getPendingRun should ignore runs updated more than 5 minutes ago', () => {
    mockLocalStorage.clear();
    agentRunStore.clearRuns();

    const plan = {
      intent: 'test',
      requiresConfirmation: false
    };

    const record = agentRunStore.createRun('打开日志', 'test', plan);
    
    // 强制修改 updatedAt 为 6 分钟前
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    record.updatedAt = sixMinutesAgo;

    const pending = agentRunStore.getPendingRun();
    assert.equal(pending, undefined);
  });
});
