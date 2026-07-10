// 简体中文：Agent 运行历史记录持久化仓库 (Agent Run Store)

import type { AgentToolCallLog } from '../../ai-takeover/types.ts';

export interface AgentRunRecord {
  id: string;
  userMessage: string;
  intent: string;
  plan: any;
  status: 'planning' | 'waiting_confirmation' | 'waiting_execution' | 'running' | 'completed' | 'failed' | 'cancelled';
  toolCalls: AgentToolCallLog[];
  createdAt: string;
  updatedAt: string;
  nextStep?: string;
  confirmationGrantedAt?: string;
  totalSteps?: number;
  completedStepIds?: string[];
  replanCount?: number;
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
        
        // 修正历史遗留的僵尸任务状态，防止 UI 一直卡在 loading 或执行中
        let changed = false;
        this.runs.forEach(run => {
          if (run.status === 'running' || run.status === 'waiting_execution') {
            run.status = 'failed';
            run.nextStep = '任务运行异常中断，请重试。';
            run.updatedAt = new Date().toISOString();
            changed = true;
          }
        });
        if (changed) {
          this.saveRuns();
        }
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
      const storageValue = JSON.stringify(this.runs);
      storage.setItem(STORAGE_KEY, storageValue);
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
      status: plan?.requiresConfirmation ? 'waiting_confirmation' : 'waiting_execution',
      toolCalls: [],
      totalSteps: Array.isArray(plan?.steps) ? plan.steps.length : Array.isArray(plan?.actions) ? plan.actions.length : 0,
      completedStepIds: [],
      replanCount: 0,
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
    const now = Date.now();
    let changed = false;
    this.runs.forEach(r => {
      if (r.status === 'waiting_confirmation' || r.status === 'waiting_execution' || r.status === 'running') {
        const diff = now - new Date(r.updatedAt).getTime();
        if (diff >= 5 * 60 * 1000) {
          r.status = 'failed';
          r.nextStep = '任务执行超时，已自动重置。';
          r.updatedAt = new Date().toISOString();
          changed = true;
        }
      }
    });

    if (changed) {
      this.saveRuns();
    }

    return this.runs.find(r => {
      if (r.status !== 'waiting_confirmation' && r.status !== 'waiting_execution' && r.status !== 'running') {
        return false;
      }
      const diff = now - new Date(r.updatedAt).getTime();
      return diff < 5 * 60 * 1000;
    });
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
