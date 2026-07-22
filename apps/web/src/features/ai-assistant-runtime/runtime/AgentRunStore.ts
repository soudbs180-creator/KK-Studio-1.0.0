// 简体中文：Agent 运行历史记录持久化仓库 (Agent Run Store)

import type { AgentRunDto, AgentRunStatus, AgentStepResultDto } from '@kk/shared';
import type { AgentToolCallLog } from '../../ai-takeover/types.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';

export interface AgentRunRecord {
  id: string;
  sessionId?: string;
  userMessage: string;
  intent: string;
  plan: unknown;
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
  executionAuthority?: 'local_validated' | 'server_projection';
}

export type AgentRunStoreListener = (runs: AgentRunRecord[]) => void;

const STORAGE_KEY = 'kk_agent_runs_history';

const cloneRunRecord = (record: AgentRunRecord): AgentRunRecord => (
  JSON.parse(JSON.stringify(record)) as AgentRunRecord
);

const cloneRunRecords = (records: AgentRunRecord[]): AgentRunRecord[] => records.map(cloneRunRecord);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const clonePlan = (plan: unknown): unknown => (
  plan === undefined ? undefined : JSON.parse(JSON.stringify(plan))
);

const planRequiresConfirmation = (plan: unknown): boolean => (
  isRecord(plan) && plan.requiresConfirmation === true
);

const getPlanStepCount = (plan: unknown): number => {
  if (!isRecord(plan)) return 0;
  if (Array.isArray(plan.steps)) return plan.steps.length;
  return Array.isArray(plan.actions) ? plan.actions.length : 0;
};

const mergeToolCalls = (
  localCalls: AgentToolCallLog[],
  remoteCalls: AgentRunDto['toolCalls'],
): AgentToolCallLog[] => {
  const calls = new Map<string, AgentToolCallLog>();
  for (const call of localCalls) calls.set(call.id, call);
  for (const call of remoteCalls) calls.set(call.id, call);
  return [...calls.values()];
};

const createServerProjection = (snapshot: AgentRunDto): AgentRunRecord => ({
  ...snapshot,
  plan: clonePlan(snapshot.plan),
  toolCalls: snapshot.toolCalls.map((call) => ({ ...call })),
  stepResults: snapshot.stepResults?.map((result) => ({ ...result })),
  completedStepIds: snapshot.completedStepIds ? [...snapshot.completedStepIds] : undefined,
  backendSyncState: 'synced',
  executionAuthority: 'server_projection',
});

/** Only locally planned or legacy Runs may be resumed by this browser. */
export const hasLocalAgentRunExecutionAuthority = (record?: AgentRunRecord): boolean => (
  Boolean(record) && record?.executionAuthority !== 'server_projection'
);

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
  private readonly listeners = new Set<AgentRunStoreListener>();
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
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snapshot = cloneRunRecords(this.runs);
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[AgentRunStore] Run listener failed:', error);
      }
    }
  }

  private repairLegacyLocalRuns(): boolean {
    if (this.activeOwnerId !== 'local_user') return false;
    let changed = false;
    for (const run of this.runs) {
      if (run.status !== 'running' && run.status !== 'waiting_execution') continue;
      run.status = 'failed';
      run.nextStep = '任务运行异常中断，请重试。';
      run.updatedAt = new Date().toISOString();
      run.backendSyncState = 'pending';
      changed = true;
    }
    return changed;
  }

  private loadRuns(): void {
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
        if (this.repairLegacyLocalRuns()) this.saveRuns();
      }
    } catch (e) {
      console.error('[AgentRunStore] 加载失败:', e);
      this.runs = [];
    }
  }

  private saveRuns() {
    this.ownerRunCache.set(this.activeOwnerId, cloneRunRecords(this.runs));
    if (this.storage) {
      try {
        const storageValue = JSON.stringify(this.runs);
        this.storage.setItem(this.storageKey(), storageValue);
      } catch (e) {
        console.error('[AgentRunStore] 保存失败:', e);
      }
    }
    this.notifyListeners();
  }

  subscribe(listener: AgentRunStoreListener): () => void {
    this.ensureOwnerScope();
    this.listeners.add(listener);
    listener(cloneRunRecords(this.runs));
    return () => this.listeners.delete(listener);
  }

  createRun(userMessage: string, intent: string, plan: unknown, sessionId?: string): AgentRunRecord {
    this.ensureOwnerScope();
    const now = new Date().toISOString();
    const newRun: AgentRunRecord = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sessionId,
      userMessage,
      intent,
      plan: clonePlan(plan),
      status: planRequiresConfirmation(plan) ? 'waiting_confirmation' : 'waiting_execution',
      toolCalls: [],
      totalSteps: getPlanStepCount(plan),
      completedStepIds: [],
      stepResults: [],
      replanCount: 0,
      backendSyncState: 'pending',
      executionAuthority: 'local_validated',
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
    const authoritative: AgentRunRecord = {
      ...current,
      ...snapshot,
      // The server DTO is intentionally untrusted at this boundary. Keep the
      // locally validated plan that was authorized for this run.
      plan: current.plan,
      toolCalls: mergeToolCalls(current.toolCalls || [], snapshot.toolCalls || []),
      stepResults: [...(snapshot.stepResults || [])],
      completedStepIds: snapshot.completedStepIds ? [...snapshot.completedStepIds] : current.completedStepIds,
      backendSyncState: 'synced',
    };
    this.runs[index] = authoritative;
    this.saveRuns();
    return cloneRunRecord(authoritative);
  }

  /** Merges owner-scoped server history without making remote plans executable. */
  hydrateAuthoritativeRuns(ownerId: string, snapshots: AgentRunDto[]): AgentRunRecord[] {
    this.ensureOwnerScope();
    const normalizedOwnerId = String(ownerId || '').trim() || 'local_user';
    if (normalizedOwnerId !== this.activeOwnerId) return [];
    let changed = false;
    for (const snapshot of snapshots) {
      const index = this.runs.findIndex((candidate) => candidate.id === snapshot.id);
      if (index < 0) {
        this.runs.push(createServerProjection(snapshot));
        changed = true;
        continue;
      }
      const current = this.runs[index];
      if (Date.parse(snapshot.updatedAt) < Date.parse(current.updatedAt)) continue;
      this.runs[index] = {
        ...current,
        ...snapshot,
        plan: current.plan,
        toolCalls: mergeToolCalls(current.toolCalls || [], snapshot.toolCalls || []),
        stepResults: snapshot.stepResults?.map((result) => ({ ...result })) || [],
        completedStepIds: snapshot.completedStepIds ? [...snapshot.completedStepIds] : current.completedStepIds,
        backendSyncState: 'synced',
        executionAuthority: current.executionAuthority || 'local_validated',
      };
      changed = true;
    }
    if (changed) {
      this.runs.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
      this.runs = this.runs.slice(0, 100);
      this.saveRuns();
    }
    return cloneRunRecords(this.runs);
  }

  getPendingRun(): AgentRunRecord | undefined {
    this.ensureOwnerScope();
    const now = Date.now();
    let changed = false;
    this.runs.forEach(r => {
      if (this.activeOwnerId !== 'local_user') return;
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
      if (this.activeOwnerId !== 'local_user') return true;
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

  archiveRun(id: string): boolean {
    this.ensureOwnerScope();
    const run = this.runs.find((candidate) => candidate.id === id);
    if (!run || ['planning', 'waiting_confirmation', 'waiting_execution', 'running'].includes(run.status)) {
      return false;
    }
    this.runs = this.runs.filter((candidate) => candidate.id !== id);
    this.saveRuns();
    return true;
  }

  archiveFinishedRuns(): number {
    this.ensureOwnerScope();
    const activeStatuses: AgentRunRecord['status'][] = [
      'planning',
      'waiting_confirmation',
      'waiting_execution',
      'running',
    ];
    const previousCount = this.runs.length;
    this.runs = this.runs.filter((run) => activeStatuses.includes(run.status));
    const archivedCount = previousCount - this.runs.length;
    if (archivedCount > 0) this.saveRuns();
    return archivedCount;
  }
}

export const agentRunStore = new AgentRunStore();
