// 简体中文：Agent 运行历史记录持久化仓库 (Agent Run Store)

import type { AgentToolCallLog } from '../../ai-takeover/types.ts';

export interface AgentRunRecord {
  id: string;
  userMessage: string;
  intent: string;
  plan: any;
  status: 'planning' | 'waiting_confirmation' | 'running' | 'completed' | 'failed' | 'cancelled';
  toolCalls: AgentToolCallLog[];
  createdAt: string;
  updatedAt: string;
  nextStep?: string;
}

const STORAGE_KEY = 'kk_agent_runs_history';

const getBrowserStorage = (): Storage | null => {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

export class AgentRunStore {
  private runs: AgentRunRecord[] = [];

  constructor() {
    this.loadRuns();
  }

  private loadRuns() {
    const storage = getBrowserStorage();
    if (!storage) return;
    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (stored) {
        this.runs = JSON.parse(stored);
      }
    } catch (e) {
      console.error('[AgentRunStore] 加载失败:', e);
      this.runs = [];
    }
  }

  private saveRuns() {
    const storage = getBrowserStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(this.runs));
    } catch (e) {
      console.error('[AgentRunStore] 保存失败:', e);
    }
  }

  createRun(userMessage: string, intent: string, plan: any): AgentRunRecord {
    const now = new Date().toISOString();
    const newRun: AgentRunRecord = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userMessage,
      intent,
      plan,
      status: plan?.requiresConfirmation ? 'waiting_confirmation' : 'running',
      toolCalls: [],
      createdAt: now,
      updatedAt: now
    };
    
    // 保留最近 100 条记录
    this.runs = [newRun, ...this.runs].slice(0, 100);
    this.saveRuns();
    return newRun;
  }

  getRun(id: string): AgentRunRecord | undefined {
    return this.runs.find(r => r.id === id);
  }

  updateRun(id: string, updates: Partial<AgentRunRecord>): AgentRunRecord {
    const run = this.getRun(id);
    if (!run) {
      throw new Error(`未找到运行记录: ${id}`);
    }

    Object.assign(run, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    this.saveRuns();
    return run;
  }

  getPendingRun(): AgentRunRecord | undefined {
    return this.runs.find(r => r.status === 'waiting_confirmation' || r.status === 'running');
  }

  listRuns(): AgentRunRecord[] {
    return [...this.runs];
  }

  clearRuns(): void {
    this.runs = [];
    this.saveRuns();
  }
}

export const agentRunStore = new AgentRunStore();
