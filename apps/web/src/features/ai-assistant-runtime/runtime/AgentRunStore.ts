// 简体中文：Agent 运行历史记录持久化仓库 (Agent Run Store)

import type { AgentRunDto, AgentRunStatus, AgentStepResultDto } from '@kk/shared';
import type { AgentToolCallLog } from '../../ai-takeover/types.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';

export interface AgentRunRecord {
  id: string;
  userMessage: string;
  intent: string;
  plan: any;
  status: AgentRunStatus;
  toolCalls: AgentToolCallLog[];
  stepResults?: AgentStepResultDto[];
  createdAt: string;
  updatedAt: string;
  nextStep?: string;
  confirmationGrantedAt?: string;
  totalSteps?: number;
  completedStepIds?: string[];
  replanCount?: number;
  backendSyncState?: 'pending' | 'synced';
}

const STORAGE_KEY = 'kk_agent_runs_history';

const cloneRunRecord = (record: AgentRunRecord): AgentRunRecord => (
  JSON.parse(JSON.stringify(record)) as AgentRunRecord
);

const cloneRunRecords = (records: AgentRunRecord[]): AgentRunRecord[] => records.map(cloneRunRecord);

const cloneRunUpdates = (updates: Partial<AgentRunRecord>): Partial<AgentRunRecord> => {
  const cloned = JSON.parse(JSON.stringify(updates)) as Partial<AgentRunRecord>;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) (cloned as Record<string, unknown>)[key] = undefined;
  }
  return cloned;
};

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
  private readonly storage: Storage | null;
  private readonly ownerIdResolver: () => string;
  private readonly ownerRunCache = new Map<string, AgentRunRecord[]>();
  private activeOwnerId: string;

  constructor(
    storage: Storage | null = getBrowserStorage(),
    ownerIdResolver: () => string = getRuntimeOwnerId,
  ) {
    this.storage = storage;
    this.ownerIdResolver = ownerIdResolver;
    this.activeOwnerId = this.resolveOwnerId();
    this.loadRuns();
  }

  private resolveOwnerId(): string {
    const ownerId = String(this.ownerIdResolver() || '').trim().slice(0, 200);
    return ownerId || 'local_user';
  }

  private storageKey(ownerId = this.activeOwnerId): string {
    return `${STORAGE_KEY}:owner:${encodeURIComponent(ownerId)}`;
  }

  private readOwnerRuns(ownerId: string): AgentRunRecord[] {
    if (ownerId === this.activeOwnerId) return this.runs;
    const cached = this.ownerRunCache.get(ownerId);
    if (cached) return cloneRunRecords(cached);
    if (!this.storage) return [];
    try {
      const stored = this.storage.getItem(this.storageKey(ownerId));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveOwnerRuns(ownerId: string, runs: AgentRunRecord[]): void {
    this.ownerRunCache.set(ownerId, cloneRunRecords(runs));
    if (ownerId === this.activeOwnerId) {
      this.runs = runs;
      this.saveRuns();
      return;
    }
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey(ownerId), JSON.stringify(runs));
    } catch (error) {
      console.error('[AgentRunStore] Failed to persist owner-scoped run state:', error);
    }
  }

  private ensureOwnerScope(): void {
    const ownerId = this.resolveOwnerId();
    if (ownerId === this.activeOwnerId) return;
    this.ownerRunCache.set(this.activeOwnerId, cloneRunRecords(this.runs));
    this.activeOwnerId = ownerId;
    this.loadRuns();
  }

  private loadRuns() {
    this.runs = [];
    const cached = this.ownerRunCache.get(this.activeOwnerId);
    if (cached) {
      this.runs = cloneRunRecords(cached);
      return;
    }
    if (!this.storage) return;
    try {
      const stored = this.storage.getItem(this.storageKey());
      if (stored) {
        this.runs = JSON.parse(stored);
        
        // 修正历史遗留的僵尸任务状态，防止 UI 一直卡在 loading 或执行中
        let changed = false;
        this.runs.forEach(run => {
          if (run.status === 'running' || run.status === 'waiting_execution') {
            run.status = 'failed';
            run.nextStep = '任务运行异常中断，请重试。';
            run.updatedAt = new Date().toISOString();
            run.backendSyncState = 'pending';
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
    this.ownerRunCache.set(this.activeOwnerId, cloneRunRecords(this.runs));
    if (!this.storage) return;
    try {
      const storageValue = JSON.stringify(this.runs);
      this.storage.setItem(this.storageKey(), storageValue);
    } catch (e) {
      console.error('[AgentRunStore] 保存失败:', e);
    }
  }

  createRun(userMessage: string, intent: string, plan: any): AgentRunRecord {
    this.ensureOwnerScope();
    const now = new Date().toISOString();
    const newRun: AgentRunRecord = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userMessage,
      intent,
      plan: JSON.parse(JSON.stringify(plan)),
      status: plan?.requiresConfirmation ? 'waiting_confirmation' : 'waiting_execution',
      toolCalls: [],
      totalSteps: Array.isArray(plan?.steps) ? plan.steps.length : Array.isArray(plan?.actions) ? plan.actions.length : 0,
      completedStepIds: [],
      stepResults: [],
      replanCount: 0,
      backendSyncState: 'pending',
      createdAt: now,
      updatedAt: now
    };
    
    // 保留最近 100 条记录
    this.runs = [newRun, ...this.runs].slice(0, 100);
    this.saveRuns();
    return cloneRunRecord(newRun);
  }

  getRun(id: string): AgentRunRecord | undefined {
    this.ensureOwnerScope();
    const run = this.runs.find(r => r.id === id);
    return run ? cloneRunRecord(run) : undefined;
  }

  getRunForOwner(ownerId: string, id: string): AgentRunRecord | undefined {
    const normalizedOwnerId = String(ownerId || '').trim() || 'local_user';
    const run = this.readOwnerRuns(normalizedOwnerId).find((candidate) => candidate.id === id);
    return run ? cloneRunRecord(run) : undefined;
  }

  restoreRunSnapshot(snapshot: AgentRunRecord): AgentRunRecord {
    this.ensureOwnerScope();
    if (!snapshot?.id || !Number.isFinite(Date.parse(snapshot.updatedAt))) {
      throw new TypeError('Cannot restore an invalid Agent Run snapshot.');
    }
    const restored = cloneRunRecord(snapshot);
    const existingIndex = this.runs.findIndex((candidate) => candidate.id === restored.id);
    if (existingIndex >= 0) this.runs[existingIndex] = restored;
    else this.runs = [restored, ...this.runs].slice(0, 100);
    this.saveRuns();
    return cloneRunRecord(restored);
  }

  updateRun(id: string, updates: Partial<AgentRunRecord>): AgentRunRecord {
    this.ensureOwnerScope();
    return this.updateRunForOwner(this.activeOwnerId, id, updates);
  }

  updateRunForOwner(ownerId: string, id: string, updates: Partial<AgentRunRecord>): AgentRunRecord {
    const normalizedOwnerId = String(ownerId || '').trim() || 'local_user';
    const ownerRuns = this.readOwnerRuns(normalizedOwnerId);
    const run = ownerRuns.find((candidate) => candidate.id === id);
    if (!run) {
      throw new Error(`未找到运行记录: ${id}`);
    }

    const previousTimestamp = Date.parse(run.updatedAt);
    const nextTimestamp = Number.isFinite(previousTimestamp)
      ? Math.max(Date.now(), previousTimestamp + 1)
      : Date.now();
    Object.assign(run, {
      ...cloneRunUpdates(updates),
      updatedAt: new Date(nextTimestamp).toISOString(),
      backendSyncState: 'pending',
    });

    this.saveOwnerRuns(normalizedOwnerId, ownerRuns);
    return cloneRunRecord(run);
  }

  markBackendSynced(id: string, snapshotUpdatedAt: string): void {
    this.ensureOwnerScope();
    const run = this.runs.find(candidate => candidate.id === id);
    if (!run || run.updatedAt !== snapshotUpdatedAt) return;
    run.backendSyncState = 'synced';
    this.saveRuns();
  }

  applyAuthoritativeRun(
    snapshot: AgentRunDto,
    expectedLocalUpdatedAt: string,
  ): AgentRunRecord | undefined {
    this.ensureOwnerScope();
    const index = this.runs.findIndex(candidate => candidate.id === snapshot.id);
    if (index < 0) return undefined;
    const current = this.runs[index];
    if (current.updatedAt !== expectedLocalUpdatedAt) return undefined;
    const authoritativeTime = Date.parse(snapshot.updatedAt);
    const currentTime = Date.parse(current.updatedAt);
    if (!Number.isFinite(authoritativeTime) || (Number.isFinite(currentTime) && authoritativeTime < currentTime)) {
      return undefined;
    }
    const mergedToolCalls = new Map<string, AgentToolCallLog>();
    for (const toolCall of current.toolCalls || []) {
      mergedToolCalls.set(toolCall.id, toolCall);
    }
    for (const toolCall of snapshot.toolCalls || []) {
      mergedToolCalls.set(toolCall.id, toolCall as AgentToolCallLog);
    }
    const authoritative: AgentRunRecord = {
      ...current,
      ...snapshot,
      toolCalls: [...mergedToolCalls.values()],
      stepResults: [...(snapshot.stepResults || [])],
      completedStepIds: snapshot.completedStepIds ? [...snapshot.completedStepIds] : current.completedStepIds,
      backendSyncState: 'synced',
    };
    this.runs[index] = authoritative;
    this.saveRuns();
    return cloneRunRecord(authoritative);
  }

  getPendingRun(): AgentRunRecord | undefined {
    this.ensureOwnerScope();
    const now = Date.now();
    let changed = false;
    this.runs.forEach(r => {
      if (r.status === 'waiting_execution' || r.status === 'running') {
        const diff = now - new Date(r.updatedAt).getTime();
        if (diff >= 5 * 60 * 1000) {
          r.status = 'failed';
          r.nextStep = '任务执行超时，已自动重置。';
          const previousTimestamp = Date.parse(r.updatedAt);
          r.updatedAt = new Date(Number.isFinite(previousTimestamp)
            ? Math.max(now, previousTimestamp + 1)
            : now).toISOString();
          r.backendSyncState = 'pending';
          changed = true;
        }
      }
    });

    if (changed) {
      this.saveRuns();
    }

    const pending = this.runs.find(r => {
      if (r.status !== 'waiting_confirmation' && r.status !== 'waiting_execution' && r.status !== 'running') {
        return false;
      }
      if (r.status === 'waiting_confirmation') return true;
      const diff = now - new Date(r.updatedAt).getTime();
      return diff < 5 * 60 * 1000;
    });
    return pending ? cloneRunRecord(pending) : undefined;
  }

  listRuns(): AgentRunRecord[] {
    this.ensureOwnerScope();
    return cloneRunRecords(this.runs);
  }

  getOwnerScopeId(): string {
    this.ensureOwnerScope();
    return this.activeOwnerId;
  }

  clearRuns(): void {
    this.ensureOwnerScope();
    this.runs = [];
    this.saveRuns();
  }
}

export const agentRunStore = new AgentRunStore();
