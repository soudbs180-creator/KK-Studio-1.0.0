import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';

export type KnowledgeSource = 'code' | 'doc' | 'test' | 'runtime' | 'skill' | 'handoff' | 'ui';

const KNOWLEDGE_SOURCES = new Set<KnowledgeSource>([
  'code',
  'doc',
  'test',
  'runtime',
  'skill',
  'handoff',
  'ui',
]);

export interface KnowledgeDocument {
  id: string;
  source: KnowledgeSource;
  path: string;
  title: string;
  summary: string;
  contentHash: string;
  updatedAt: string;
}

export interface KnowledgeChangeInput {
  title: string;
  summary: string;
  source?: KnowledgeSource;
  paths?: string[];
  affectedModules?: string[];
  tools?: string[];
  validation?: string[];
  deprecatedBehavior?: string;
  nextAgentInstruction?: string;
}

export interface KnowledgeChangeRecord extends Required<Pick<KnowledgeChangeInput, 'title' | 'summary'>> {
  id: string;
  source: KnowledgeSource;
  paths: string[];
  affectedModules: string[];
  tools: string[];
  validation: string[];
  deprecatedBehavior?: string;
  nextAgentInstruction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UiLayoutChangeInput {
  component: string;
  summary: string;
  selector?: string;
  previousLocation?: string;
  newLocation?: string;
  affectedTools?: string[];
  validation?: string[];
}

export interface UiLayoutChangeRecord extends UiLayoutChangeInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillUpsertInput {
  name: string;
  trigger: string;
  tools: string[];
  steps: string[];
  safety?: string[];
  validation?: string[];
  knowledgeUpdates?: string[];
}

export interface AgentSkillRecord extends SkillUpsertInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface SkillDeletePayload {
  id: string;
  name: string;
  updatedAt: string;
}

type SkillVersionIdentity = SkillDeletePayload & {
  createdAt?: string;
};

export interface KnowledgeSearchResult {
  id: string;
  kind: 'document' | 'change' | 'ui-change' | 'skill';
  title: string;
  summary: string;
  path?: string;
  score: number;
  updatedAt: string;
}

type KnowledgeProjection = {
  changes: KnowledgeChangeRecord[];
  uiChanges: UiLayoutChangeRecord[];
  skills: AgentSkillRecord[];
  skillDeletionVersions: Record<string, string>;
};

export interface PendingSyncTask {
  id: string;
  type: 'upsert_skill' | 'delete_skill' | 'record_change';
  payload: any;
  retries: number;
  nextRetryTime: number;
  updatedAt: string;
}

type PendingQueueProjection = {
  tasks: PendingSyncTask[];
  taskDeletionVersions: Record<string, string>;
};

const DEFAULT_STORAGE_KEY = 'kk_agent_knowledge_projection_v1';

const BASELINE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'doc-ai-assistant-readme',
    source: 'doc',
    path: 'docs/ai-assistant/README.md',
    title: 'AI assistant knowledge base',
    summary: 'Entry point for KK Studio v1.6.0 assistant module maps, flows, tools, safety, UI map, skills, and session memory.',
    contentHash: 'baseline-ai-readme',
    updatedAt: '2026-06-03T00:00:00.000Z',
  },
  {
    id: 'doc-module-map',
    source: 'doc',
    path: 'docs/ai-assistant/module-map.md',
    title: 'Module map',
    summary: 'Maps Canvas, AI Takeover, Generation, Assets, Provider, Ecommerce, PPT, and Redraw modules to current source files.',
    contentHash: 'baseline-module-map',
    updatedAt: '2026-06-03T00:00:00.000Z',
  },
  {
    id: 'doc-tool-registry',
    source: 'doc',
    path: 'docs/ai-assistant/tool-registry.md',
    title: 'Tool registry',
    summary: 'Describes namespaced agent tools, permissions, legacy mappings, audit logs, ZIP originals, durable queue, and arrange tools.',
    contentHash: 'baseline-tool-registry',
    updatedAt: '2026-06-03T00:00:00.000Z',
  },
  {
    id: 'doc-flow-map',
    source: 'doc',
    path: 'docs/ai-assistant/flow-map.md',
    title: 'Flow map',
    summary: 'Documents selected-card original ZIP download and durable batch generation flows.',
    contentHash: 'baseline-flow-map',
    updatedAt: '2026-06-03T00:00:00.000Z',
  },
  {
    id: 'doc-ui-map',
    source: 'doc',
    path: 'docs/ai-assistant/ui-map.md',
    title: 'UI map',
    summary: 'Maps stable UI selectors for settings, prompt input, project sidebar, AI takeover controls, and canvas container.',
    contentHash: 'baseline-ui-map',
    updatedAt: '2026-06-03T00:00:00.000Z',
  },
  {
    id: 'doc-session-handoff',
    source: 'handoff',
    path: 'docs/development/session-handoff.md',
    title: 'Session handoff',
    summary: 'Current recovery notes for AGENTS, assistant runtime, validation, remaining gaps, and next-agent guidance.',
    contentHash: 'baseline-session-handoff',
    updatedAt: '2026-06-03T00:00:00.000Z',
  },
];

const emptyProjection = (): KnowledgeProjection => ({
  changes: [],
  uiChanges: [],
  skills: [],
  skillDeletionVersions: {},
});

const emptyPendingQueueProjection = (): PendingQueueProjection => ({
  tasks: [],
  taskDeletionVersions: {},
});

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

const redactSensitiveText = (value: string): string =>
  value
    .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer ***')
    .replace(/sk-[a-zA-Z0-9_-]{8,}/gi, 'sk-***')
    .replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'jwt-***')
    .replace(/[a-zA-Z0-9_-]{48,}/g, '***');

const sanitizeString = (value: unknown): string =>
  redactSensitiveText(String(value || '').trim()).slice(0, 1000);

const sanitizeStringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map(sanitizeString).filter(Boolean).slice(0, 50)
    : []
);

const normalizeKnowledgeSource = (source: unknown): KnowledgeSource => {
  const sanitized = sanitizeString(source);
  return KNOWLEDGE_SOURCES.has(sanitized as KnowledgeSource)
    ? sanitized as KnowledgeSource
    : 'runtime';
};

const createId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const nextIsoTimestamp = (previous?: string): string => {
  const previousTimestamp = previous ? Date.parse(previous) : Number.NaN;
  const timestamp = Number.isFinite(previousTimestamp)
    ? Math.max(Date.now(), previousTimestamp + 1)
    : Date.now();
  return new Date(timestamp).toISOString();
};

const getPendingTaskPayloadVersion = (
  task: Pick<PendingSyncTask, 'type' | 'payload'>,
): string => {
  return typeof task.payload?.updatedAt === 'string' ? task.payload.updatedAt : '';
};

const getPendingTaskPayloadId = (
  task: Pick<PendingSyncTask, 'type' | 'payload'>,
): string => {
  if (task.type === 'delete_skill' && typeof task.payload === 'string') return task.payload;
  return typeof task.payload?.id === 'string' ? task.payload.id : '';
};

const skillDeletionNameKey = (name: string): string => `name:${name}`;
const skillDeletionIdKey = (id: string): string => `id:${id}`;

const getSkillDeletionVersion = (
  projection: KnowledgeProjection,
  skill: Pick<AgentSkillRecord, 'id' | 'name'>,
): string | undefined => {
  const versions = [
    projection.skillDeletionVersions[skillDeletionNameKey(skill.name)],
    projection.skillDeletionVersions[skillDeletionIdKey(skill.id)],
  ].filter((value): value is string => typeof value === 'string');
  return versions.sort((left, right) => right.localeCompare(left))[0];
};

const mergeVersionedRecords = <T extends { id: string; updatedAt: string }>(
  persisted: T[],
  current: T[],
  limit = 200,
): T[] => {
  const records = new Map<string, T>();
  for (const record of [...persisted, ...current]) {
    const existing = records.get(record.id);
    const versionComparison = existing ? record.updatedAt.localeCompare(existing.updatedAt) : 1;
    const deterministicComparison = existing && versionComparison === 0
      ? JSON.stringify(record).localeCompare(JSON.stringify(existing))
      : versionComparison;
    if (!existing || deterministicComparison > 0) {
      records.set(record.id, record);
    }
  }
  return [...records.values()]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
};

const mergeKnowledgeProjections = (
  persisted: KnowledgeProjection,
  current: KnowledgeProjection,
): KnowledgeProjection => {
  const skillDeletionVersions: Record<string, string> = {};
  for (const [key, updatedAt] of [
    ...Object.entries(persisted.skillDeletionVersions),
    ...Object.entries(current.skillDeletionVersions),
  ]) {
    if (!skillDeletionVersions[key] || updatedAt > skillDeletionVersions[key]) {
      skillDeletionVersions[key] = updatedAt;
    }
  }
  const boundedDeletionVersions = Object.fromEntries(
    Object.entries(skillDeletionVersions)
      .sort((left, right) => right[1].localeCompare(left[1]))
      .slice(0, 1000),
  );

  const merged: KnowledgeProjection = {
    changes: mergeVersionedRecords(persisted.changes, current.changes),
    uiChanges: mergeVersionedRecords(persisted.uiChanges, current.uiChanges),
    skills: [],
    skillDeletionVersions: boundedDeletionVersions,
  };
  const skillsByName = new Map<string, AgentSkillRecord>();
  for (const skill of mergeVersionedRecords(persisted.skills, current.skills)) {
    const existing = skillsByName.get(skill.name);
    const versionComparison = existing ? skill.updatedAt.localeCompare(existing.updatedAt) : 1;
    const deterministicComparison = existing && versionComparison === 0
      ? JSON.stringify(skill).localeCompare(JSON.stringify(existing))
      : versionComparison;
    if (!existing || deterministicComparison > 0) {
      skillsByName.set(skill.name, skill);
    }
  }
  merged.skills = [...skillsByName.values()]
    .filter((skill) => {
      const deletedAt = getSkillDeletionVersion(merged, skill);
      return !deletedAt || deletedAt < skill.updatedAt;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 200);
  return merged;
};

const normalizeKnowledgeProjection = (parsed: Partial<KnowledgeProjection> | undefined): KnowledgeProjection => ({
  changes: Array.isArray(parsed?.changes) ? parsed.changes : [],
  uiChanges: Array.isArray(parsed?.uiChanges) ? parsed.uiChanges : [],
  skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
  skillDeletionVersions:
    parsed?.skillDeletionVersions && typeof parsed.skillDeletionVersions === 'object'
      ? Object.fromEntries(
        Object.entries(parsed.skillDeletionVersions)
          .filter(([id, updatedAt]) => Boolean(id) && typeof updatedAt === 'string'),
      )
      : {},
});

const normalizePendingTask = (task: PendingSyncTask): PendingSyncTask => {
  const payloadVersion = getPendingTaskPayloadVersion(task);
  const fallbackTimestamp = Number.isFinite(Number(task.nextRetryTime))
    ? new Date(Math.max(0, Number(task.nextRetryTime))).toISOString()
    : '1970-01-01T00:00:00.000Z';
  return {
    ...task,
    retries: Math.max(0, Number(task.retries) || 0),
    nextRetryTime: Math.max(0, Number(task.nextRetryTime) || 0),
    updatedAt: typeof task.updatedAt === 'string'
      ? task.updatedAt
      : payloadVersion || fallbackTimestamp,
  };
};

const pendingTaskLogicalKey = (task: PendingSyncTask): string => {
  const payloadId = getPendingTaskPayloadId(task);
  const skillName = typeof task.payload?.name === 'string' ? task.payload.name : '';
  return `${task.type}:${skillName || payloadId || task.id}`;
};

const comparePendingTasks = (left: PendingSyncTask, right: PendingSyncTask): number => {
  const leftPayloadVersion = getPendingTaskPayloadVersion(left);
  const rightPayloadVersion = getPendingTaskPayloadVersion(right);
  const payloadComparison = leftPayloadVersion.localeCompare(rightPayloadVersion);
  if (payloadComparison !== 0) return payloadComparison;
  const updateComparison = left.updatedAt.localeCompare(right.updatedAt);
  if (updateComparison !== 0) return updateComparison;
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
};

const mergePendingQueueProjections = (
  persisted: PendingQueueProjection,
  current: PendingQueueProjection,
): PendingQueueProjection => {
  const taskDeletionVersions: Record<string, string> = {};
  for (const [taskId, deletedVersion] of [
    ...Object.entries(persisted.taskDeletionVersions),
    ...Object.entries(current.taskDeletionVersions),
  ]) {
    if (!taskDeletionVersions[taskId] || deletedVersion > taskDeletionVersions[taskId]) {
      taskDeletionVersions[taskId] = deletedVersion;
    }
  }

  const tasksById = new Map<string, PendingSyncTask>();
  for (const rawTask of [...persisted.tasks, ...current.tasks]) {
    const task = normalizePendingTask(rawTask);
    const existing = tasksById.get(task.id);
    if (!existing || comparePendingTasks(task, existing) > 0) tasksById.set(task.id, task);
  }

  const tasksByLogicalKey = new Map<string, PendingSyncTask>();
  for (const task of tasksById.values()) {
    const deletedVersion = taskDeletionVersions[task.id];
    const payloadVersion = getPendingTaskPayloadVersion(task) || task.updatedAt;
    if (deletedVersion && deletedVersion >= payloadVersion) continue;
    const logicalKey = pendingTaskLogicalKey(task);
    const logicalDeletedVersion = taskDeletionVersions[`logical:${logicalKey}`];
    if (logicalDeletedVersion && logicalDeletedVersion >= payloadVersion) continue;
    const existing = tasksByLogicalKey.get(logicalKey);
    if (!existing || comparePendingTasks(task, existing) > 0) {
      tasksByLogicalKey.set(logicalKey, task);
    }
  }

  return {
    tasks: [...tasksByLogicalKey.values()].sort((left, right) => comparePendingTasks(right, left)),
    taskDeletionVersions: Object.fromEntries(
      Object.entries(taskDeletionVersions)
        .sort((left, right) => right[1].localeCompare(left[1]))
        .slice(0, 1000),
    ),
  };
};

const scoreText = (query: string, text: string): number => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;

  const lowerText = text.toLowerCase();
  return terms.reduce((score, term) => score + (lowerText.includes(term) ? 1 : 0), 0);
};

export class KnowledgeStore {
  private readonly storageKey: string;
  private readonly storage: Storage | null;
  private readonly ownerIdResolver: () => string;
  private activeOwnerId: string;
  private projection: KnowledgeProjection = emptyProjection();
  private pendingQueue: PendingSyncTask[] = [];
  private pendingTaskDeletionVersions: Record<string, string> = {};
  private syncSchedulerActive = false;

  constructor(
    storageKey = DEFAULT_STORAGE_KEY,
    storage: Storage | null = getBrowserStorage(),
    ownerIdResolver: () => string = getRuntimeOwnerId,
  ) {
    this.storageKey = storageKey;
    this.storage = storage;
    this.ownerIdResolver = ownerIdResolver;
    this.activeOwnerId = this.resolveOwnerId();
    this.projection = this.loadProjection();
    this.loadPendingQueue();
    this.startSyncScheduler();
  }

  private resolveOwnerId(): string {
    const ownerId = String(this.ownerIdResolver() || '').trim().slice(0, 200);
    return ownerId || 'local_user';
  }

  private projectionStorageKey(ownerId = this.activeOwnerId): string {
    return `${this.storageKey}:owner:${encodeURIComponent(ownerId)}`;
  }

  private pendingStorageKey(ownerId = this.activeOwnerId): string {
    return `${this.storageKey}:pending:${encodeURIComponent(ownerId)}`;
  }

  private projectionEntryPrefix(ownerId = this.activeOwnerId): string {
    return `${this.projectionStorageKey(ownerId)}:entry:`;
  }

  private pendingEntryPrefix(ownerId = this.activeOwnerId): string {
    return `${this.pendingStorageKey(ownerId)}:entry:`;
  }

  private listStorageEntryKeys(prefix: string): string[] {
    if (!this.storage || typeof this.storage.key !== 'function' || !Number.isFinite(this.storage.length)) {
      return [];
    }
    const keys: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }

  private ensureOwnerScope(): void {
    const ownerId = this.resolveOwnerId();
    if (ownerId === this.activeOwnerId) return;
    this.activeOwnerId = ownerId;
    this.projection = this.loadProjection();
    this.pendingQueue = [];
    this.pendingTaskDeletionVersions = {};
    this.loadPendingQueue();
  }

  private refreshProjectionFromStorage(): void {
    if (!this.storage) return;
    this.projection = mergeKnowledgeProjections(
      this.loadProjectionForOwner(this.activeOwnerId),
      this.projection,
    );
  }

  private loadPendingQueue(): void {
    const projection = this.loadPendingQueueProjectionForOwner(this.activeOwnerId);
    this.pendingQueue = projection.tasks;
    this.pendingTaskDeletionVersions = projection.taskDeletionVersions;
  }

  private loadPendingQueueForOwner(ownerId: string): PendingSyncTask[] {
    return this.loadPendingQueueProjectionForOwner(ownerId).tasks;
  }

  private loadPendingQueueProjectionForOwner(ownerId: string): PendingQueueProjection {
    if (!this.storage) {
      return ownerId === this.activeOwnerId
        ? { tasks: [...this.pendingQueue], taskDeletionVersions: { ...this.pendingTaskDeletionVersions } }
        : emptyPendingQueueProjection();
    }
    let projection = emptyPendingQueueProjection();
    try {
      const raw = this.storage.getItem(this.pendingStorageKey(ownerId));
      if (raw) {
        const parsed = JSON.parse(raw);
        projection = mergePendingQueueProjections(projection, Array.isArray(parsed)
          ? { tasks: parsed, taskDeletionVersions: {} }
          : {
              tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : [],
              taskDeletionVersions: parsed?.taskDeletionVersions && typeof parsed.taskDeletionVersions === 'object'
                ? parsed.taskDeletionVersions
                : {},
            });
      }
      for (const entryKey of this.listStorageEntryKeys(this.pendingEntryPrefix(ownerId))) {
        const entryRaw = this.storage.getItem(entryKey);
        if (!entryRaw) continue;
        const entry = JSON.parse(entryRaw);
        projection = mergePendingQueueProjections(projection, {
          tasks: Array.isArray(entry?.tasks) ? entry.tasks : [],
          taskDeletionVersions: entry?.taskDeletionVersions && typeof entry.taskDeletionVersions === 'object'
            ? entry.taskDeletionVersions
            : {},
        });
      }
      return projection;
    } catch {
      return projection;
    }
  }

  private savePendingQueueForOwner(
    ownerId: string,
    queue: PendingSyncTask[],
    removedTasks: PendingSyncTask[] = [],
  ): PendingQueueProjection {
    const oldEntryKeys = this.listStorageEntryKeys(this.pendingEntryPrefix(ownerId));
    const currentProjection = this.loadPendingQueueProjectionForOwner(ownerId);
    let nextProjection = mergePendingQueueProjections(currentProjection, {
      tasks: queue.map(normalizePendingTask),
      taskDeletionVersions: {},
    });
    const taskDeletionVersions = { ...nextProjection.taskDeletionVersions };
    for (const task of removedTasks) {
      const deletedVersion = getPendingTaskPayloadVersion(task) || task.updatedAt;
      if (!taskDeletionVersions[task.id] || deletedVersion > taskDeletionVersions[task.id]) {
        taskDeletionVersions[task.id] = deletedVersion;
      }
      const logicalDeletionKey = `logical:${pendingTaskLogicalKey(task)}`;
      if (!taskDeletionVersions[logicalDeletionKey] || deletedVersion > taskDeletionVersions[logicalDeletionKey]) {
        taskDeletionVersions[logicalDeletionKey] = deletedVersion;
      }
    }
    nextProjection = mergePendingQueueProjections(
      { tasks: nextProjection.tasks, taskDeletionVersions },
      emptyPendingQueueProjection(),
    );
    if (!this.storage) return nextProjection;

    try {
      const entryKey = `${this.pendingEntryPrefix(ownerId)}${createId('snapshot')}`;
      this.storage.setItem(entryKey, JSON.stringify(nextProjection));
      this.storage.setItem(this.pendingStorageKey(ownerId), JSON.stringify(nextProjection));
      for (const oldEntryKey of oldEntryKeys) {
        if (oldEntryKey !== entryKey) this.storage.removeItem(oldEntryKey);
      }
    } catch {
      // localStorage is a projection cache; this tab keeps the merged queue in memory.
    }
    return nextProjection;
  }

  private savePendingQueue(): void {
    const projection = this.savePendingQueueForOwner(this.activeOwnerId, this.pendingQueue);
    this.pendingQueue = projection.tasks;
    this.pendingTaskDeletionVersions = projection.taskDeletionVersions;
  }

  listDocuments(): KnowledgeDocument[] {
    return [...BASELINE_DOCUMENTS];
  }

  listChanges(): KnowledgeChangeRecord[] {
    this.ensureOwnerScope();
    this.refreshProjectionFromStorage();
    return [...this.projection.changes];
  }

  listUiChanges(): UiLayoutChangeRecord[] {
    this.ensureOwnerScope();
    this.refreshProjectionFromStorage();
    return [...this.projection.uiChanges];
  }

  listSkills(): AgentSkillRecord[] {
    this.ensureOwnerScope();
    this.refreshProjectionFromStorage();
    return [...this.projection.skills];
  }

  getPendingTasks(): PendingSyncTask[] {
    this.ensureOwnerScope();
    if (this.storage) {
      const projection = this.loadPendingQueueProjectionForOwner(this.activeOwnerId);
      this.pendingQueue = projection.tasks;
      this.pendingTaskDeletionVersions = projection.taskDeletionVersions;
    }
    return [...this.pendingQueue];
  }

  clearProjection(): void {
    this.ensureOwnerScope();
    this.projection = emptyProjection();
    this.saveProjection(false);
  }

  recordChange(input: KnowledgeChangeInput): KnowledgeChangeRecord {
    this.ensureOwnerScope();
    this.refreshProjectionFromStorage();
    const ownerId = this.activeOwnerId;
    const now = new Date().toISOString();
    const record: KnowledgeChangeRecord = {
      id: createId('change'),
      title: sanitizeString(input.title),
      summary: sanitizeString(input.summary),
      source: normalizeKnowledgeSource(input.source),
      paths: sanitizeStringArray(input.paths),
      affectedModules: sanitizeStringArray(input.affectedModules),
      tools: sanitizeStringArray(input.tools),
      validation: sanitizeStringArray(input.validation),
      deprecatedBehavior: input.deprecatedBehavior ? sanitizeString(input.deprecatedBehavior) : undefined,
      nextAgentInstruction: input.nextAgentInstruction ? sanitizeString(input.nextAgentInstruction) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    if (!record.title || !record.summary) {
      throw new Error('knowledge.recordChange requires title and summary.');
    }

    this.projection.changes = [record, ...this.projection.changes].slice(0, 200);
    this.saveProjection();
    
    // 异步同步到后端数据库权威源
    void this.syncChangeToBackend(record, ownerId);

    return record;
  }

  recordLayoutChange(input: UiLayoutChangeInput): UiLayoutChangeRecord {
    this.ensureOwnerScope();
    this.refreshProjectionFromStorage();
    const ownerId = this.activeOwnerId;
    const now = new Date().toISOString();
    const record: UiLayoutChangeRecord = {
      id: createId('ui'),
      component: sanitizeString(input.component),
      summary: sanitizeString(input.summary),
      selector: input.selector ? sanitizeString(input.selector) : undefined,
      previousLocation: input.previousLocation ? sanitizeString(input.previousLocation) : undefined,
      newLocation: input.newLocation ? sanitizeString(input.newLocation) : undefined,
      affectedTools: sanitizeStringArray(input.affectedTools),
      validation: sanitizeStringArray(input.validation),
      createdAt: now,
      updatedAt: now,
    };

    if (!record.component || !record.summary) {
      throw new Error('ui.recordLayoutChange requires component and summary.');
    }

    this.projection.uiChanges = [record, ...this.projection.uiChanges].slice(0, 200);
    this.saveProjection();
    void this.syncChangeToBackend({
      id: record.id,
      title: record.component,
      summary: record.summary,
      source: 'ui',
      paths: ['docs/ai-assistant/ui-map.md'],
      affectedModules: [record.component],
      tools: record.affectedTools || [],
      validation: record.validation || [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }, ownerId);
    return record;
  }

  upsertSkill(input: SkillUpsertInput): AgentSkillRecord {
    this.ensureOwnerScope();
    this.refreshProjectionFromStorage();
    const ownerId = this.activeOwnerId;
    const name = sanitizeString(input.name);
    if (!name || !sanitizeString(input.trigger) || sanitizeStringArray(input.tools).length === 0) {
      throw new Error('skills.upsertSkill requires name, trigger, and tools.');
    }

    const existing = this.projection.skills.find(skill => skill.name === name);
    const recordId = existing?.id || createId('skill');
    const deletionVersion = getSkillDeletionVersion(this.projection, { id: recordId, name });
    const previousVersion = [existing?.updatedAt, deletionVersion]
      .filter((value): value is string => typeof value === 'string')
      .sort((left, right) => right.localeCompare(left))[0];
    const now = nextIsoTimestamp(previousVersion);
    const record: AgentSkillRecord = {
      id: recordId,
      name,
      trigger: sanitizeString(input.trigger),
      tools: sanitizeStringArray(input.tools),
      steps: sanitizeStringArray(input.steps),
      safety: sanitizeStringArray(input.safety),
      validation: sanitizeStringArray(input.validation),
      knowledgeUpdates: sanitizeStringArray(input.knowledgeUpdates),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.projection.skills = [
      record,
      ...this.projection.skills.filter(skill => skill.id !== record.id),
    ].slice(0, 200);
    this.saveProjection();
    
    // 异步同步到后端数据库权威源
    void this.syncSkillToBackend(record, ownerId);

    return record;
  }

  deleteSkill(id: string): void {
    this.ensureOwnerScope();
    const requested = this.projection.skills.find((skill) => skill.id === id);
    this.refreshProjectionFromStorage();
    const ownerId = this.activeOwnerId;
    const targetQueue = this.readPendingQueueForOwner(ownerId);
    const pendingDelete = targetQueue
      .filter((task) => task.type === 'delete_skill' && getPendingTaskPayloadId(task) === id)
      .sort((left, right) => comparePendingTasks(right, left))[0];
    const existing = this.projection.skills.find((skill) => skill.id === id)
      || (requested ? this.projection.skills.find((skill) => skill.name === requested.name) : undefined);
    const name = existing?.name || requested?.name || pendingDelete?.payload?.name || id;
    const skillIds = Array.from(new Set([id, requested?.id, existing?.id].filter((value): value is string => Boolean(value))));
    const versionCandidates = [
      requested?.updatedAt,
      existing?.updatedAt,
      pendingDelete ? getPendingTaskPayloadVersion(pendingDelete) : undefined,
      ...skillIds.map((skillId) => getSkillDeletionVersion(this.projection, { id: skillId, name })),
    ].filter((value): value is string => typeof value === 'string');
    const deletedAt = nextIsoTimestamp(
      versionCandidates.sort((left, right) => right.localeCompare(left))[0],
    );
    this.projection.skills = this.projection.skills.filter((skill) => (
      skill.name !== name && !skillIds.includes(skill.id)
    ));
    const skillDeletionVersions = {
      ...this.projection.skillDeletionVersions,
      [skillDeletionNameKey(name)]: deletedAt,
    };
    for (const skillId of skillIds) {
      skillDeletionVersions[skillDeletionIdKey(skillId)] = deletedAt;
    }
    this.projection.skillDeletionVersions = skillDeletionVersions;
    this.saveProjection();
    const filteredQueue = targetQueue.filter((task) => !(
      task.type === 'upsert_skill'
      && (
        skillIds.includes(getPendingTaskPayloadId(task))
        || task.payload?.name === name
      )
    ));
    if (filteredQueue.length !== targetQueue.length) {
      this.saveTargetPendingQueue(
        ownerId,
        filteredQueue,
        targetQueue.filter((task) => !filteredQueue.some((candidate) => candidate.id === task.id)),
      );
    }
    const deletePayload = { id, name, updatedAt: deletedAt };
    this.enqueueTask('delete_skill', deletePayload, ownerId);
    void this.syncDeleteSkillToBackend(deletePayload, ownerId);
  }

  private async syncDeleteSkillToBackend(payload: SkillDeletePayload, ownerId: string) {
    const success = await this.executeDeleteSkill(payload, ownerId);
    if (!success) {
      this.enqueueTask('delete_skill', payload, ownerId);
    } else {
      this.removePendingTaskForOwner('delete_skill', payload.id, ownerId, payload.updatedAt);
    }
  }

  private async executeDeleteSkill(
    payload: SkillDeletePayload | string,
    ownerId: string = this.activeOwnerId,
  ): Promise<boolean> {
    const normalizedPayload: SkillDeletePayload = typeof payload === 'string'
      ? { id: payload, name: payload, updatedAt: new Date().toISOString() }
      : payload;
    try {
      const response = await kkWebApiClient.deleteAgentSkill(normalizedPayload.id, {
        name: normalizedPayload.name,
        updatedAt: normalizedPayload.updatedAt,
      }, { expectedAuthSubject: ownerId });
      if (!response.success || response.data?.ok !== true) return false;
      if (response.data.data) {
        this.applyAuthoritativeSkill(normalizedPayload, response.data.data, ownerId);
        return true;
      }
      if (
        response.data.authoritativeDeleted === true
        && response.data.authoritativeUpdatedAt
      ) {
        this.applyAuthoritativeSkillDeletion(
          normalizedPayload,
          response.data.authoritativeUpdatedAt,
          ownerId,
        );
        return true;
      }
      return response.data.stale !== true;
    } catch {
      return false;
    }
  }

  private async syncChangeToBackend(record: KnowledgeChangeRecord, ownerId: string) {
    const success = await this.executeChangeSync(record, ownerId);
    if (!success) {
      this.enqueueTask('record_change', record, ownerId);
    } else {
      this.removePendingTaskForOwner('record_change', record.id, ownerId, record.updatedAt);
    }
  }

  private async executeChangeSync(record: KnowledgeChangeRecord, ownerId: string): Promise<boolean> {
    try {
      const response = await kkWebApiClient.recordKnowledgeChange(record, { expectedAuthSubject: ownerId });
      return response.success && response.data?.ok === true;
    } catch {
      return false;
    }
  }

  private async syncSkillToBackend(record: AgentSkillRecord, ownerId: string) {
    const success = await this.executeSkillSync(record, ownerId);
    if (!success) {
      this.enqueueTask('upsert_skill', record, ownerId);
    } else {
      this.removePendingTaskForOwner('upsert_skill', record.id, ownerId, record.updatedAt);
    }
  }

  private async executeSkillSync(record: AgentSkillRecord, ownerId: string): Promise<boolean> {
    try {
      const response = await kkWebApiClient.upsertAgentSkill(record, { expectedAuthSubject: ownerId });
      const success = response.success && response.data?.ok === true;
      if (success && response.data?.data) {
        this.applyAuthoritativeSkill(record, response.data.data, ownerId);
      }
      if (
        success
        && response.data?.authoritativeDeleted === true
        && response.data.authoritativeUpdatedAt
      ) {
        this.applyAuthoritativeSkillDeletion(
          record,
          response.data.authoritativeUpdatedAt,
          ownerId,
        );
      }
      return success && !(
        response.data?.stale === true
        && !response.data.data
        && !(
          response.data.authoritativeDeleted === true
          && response.data.authoritativeUpdatedAt
        )
      );
    } catch {
      return false;
    }
  }

  private applyAuthoritativeSkill(
    requestedRecord: SkillVersionIdentity,
    authoritativeInput: Partial<AgentSkillRecord>,
    ownerId: string,
  ): void {
    const authoritativeUpdatedAt = sanitizeString(authoritativeInput.updatedAt);
    const authoritative: AgentSkillRecord = {
      id: sanitizeString(authoritativeInput.id),
      name: sanitizeString(authoritativeInput.name),
      trigger: sanitizeString(authoritativeInput.trigger),
      tools: sanitizeStringArray(authoritativeInput.tools),
      steps: sanitizeStringArray(authoritativeInput.steps),
      safety: sanitizeStringArray(authoritativeInput.safety),
      validation: sanitizeStringArray(authoritativeInput.validation),
      knowledgeUpdates: sanitizeStringArray(authoritativeInput.knowledgeUpdates),
      createdAt: sanitizeString(
        authoritativeInput.createdAt
        || requestedRecord.createdAt
        || authoritativeUpdatedAt,
      ),
      updatedAt: authoritativeUpdatedAt,
    };
    if (
      !authoritative.id
      || !authoritative.name
      || !authoritative.trigger
      || authoritative.tools.length === 0
      || !Number.isFinite(Date.parse(authoritative.updatedAt))
    ) {
      return;
    }

    const targetProjection = this.storage
      ? mergeKnowledgeProjections(
          this.loadProjectionForOwner(ownerId),
          ownerId === this.activeOwnerId ? this.projection : emptyProjection(),
        )
      : ownerId === this.activeOwnerId
        ? this.projection
        : emptyProjection();
    const deletionVersion = [
      getSkillDeletionVersion(targetProjection, {
        id: authoritative.id,
        name: authoritative.name,
      }),
      getSkillDeletionVersion(targetProjection, requestedRecord),
    ]
      .filter((value): value is string => typeof value === 'string')
      .sort((left, right) => right.localeCompare(left))[0];
    if (deletionVersion && deletionVersion >= authoritative.updatedAt) return;

    const relatedSkills = targetProjection.skills
      .filter((skill) => (
        skill.id === authoritative.id
        || skill.id === requestedRecord.id
        || skill.name === authoritative.name
        || skill.name === requestedRecord.name
      ))
      .sort((left, right) => (
        right.updatedAt.localeCompare(left.updatedAt)
        || JSON.stringify(right).localeCompare(JSON.stringify(left))
      ));
    const latestLocal = relatedSkills[0];
    if (latestLocal && latestLocal.updatedAt > authoritative.updatedAt) return;

    const normalizedAuthoritative = latestLocal
      && latestLocal.updatedAt === authoritative.updatedAt
      && JSON.stringify(latestLocal) !== JSON.stringify(authoritative)
      ? { ...authoritative, updatedAt: nextIsoTimestamp(authoritative.updatedAt) }
      : authoritative;
    const nextProjection: KnowledgeProjection = {
      ...targetProjection,
      skills: [
        normalizedAuthoritative,
        ...targetProjection.skills.filter((skill) => !(
          skill.id === authoritative.id
          || skill.id === requestedRecord.id
          || skill.name === authoritative.name
          || skill.name === requestedRecord.name
        )),
      ].slice(0, 200),
    };
    const persistedProjection = this.saveProjectionForOwner(ownerId, nextProjection);
    if (ownerId === this.activeOwnerId) this.projection = persistedProjection;
  }

  private applyAuthoritativeSkillDeletion(
    requestedRecord: SkillVersionIdentity,
    authoritativeUpdatedAt: string,
    ownerId: string,
  ): void {
    const deletedAt = sanitizeString(authoritativeUpdatedAt);
    if (!Number.isFinite(Date.parse(deletedAt))) return;
    const targetProjection = this.storage
      ? mergeKnowledgeProjections(
          this.loadProjectionForOwner(ownerId),
          ownerId === this.activeOwnerId ? this.projection : emptyProjection(),
        )
      : ownerId === this.activeOwnerId
        ? this.projection
        : emptyProjection();
    const skillDeletionVersions = { ...targetProjection.skillDeletionVersions };
    for (const key of [
      skillDeletionNameKey(requestedRecord.name),
      skillDeletionIdKey(requestedRecord.id),
    ]) {
      if (!skillDeletionVersions[key] || deletedAt > skillDeletionVersions[key]) {
        skillDeletionVersions[key] = deletedAt;
      }
    }
    const nextProjection: KnowledgeProjection = {
      ...targetProjection,
      skills: targetProjection.skills.filter((skill) => !(
        (skill.id === requestedRecord.id || skill.name === requestedRecord.name)
        && skill.updatedAt <= deletedAt
      )),
      skillDeletionVersions,
    };
    const persistedProjection = this.saveProjectionForOwner(ownerId, nextProjection);
    if (ownerId === this.activeOwnerId) this.projection = persistedProjection;
  }

  private enqueueTask(type: PendingSyncTask['type'], payload: any, ownerId?: string): void {
    if (!ownerId) {
      this.ensureOwnerScope();
      ownerId = this.activeOwnerId;
    }
    const targetProjection = this.storage
      ? this.loadProjectionForOwner(ownerId)
      : ownerId === this.activeOwnerId
        ? this.projection
        : this.loadProjectionForOwner(ownerId);
    if (
      type === 'upsert_skill'
      && this.isObsoleteSkillUpsert(targetProjection, payload)
    ) {
      return;
    }
    const latestPayload = type === 'upsert_skill'
      ? targetProjection.skills.find((skill) => skill.id === payload.id) || payload
      : payload;
    const targetQueue = this.readPendingQueueForOwner(ownerId);
    const existingTaskIndex = targetQueue.findIndex(t =>
      t.type === type && 
      getPendingTaskPayloadId(t) === (
        type === 'delete_skill' && typeof latestPayload === 'string'
          ? latestPayload
          : latestPayload.id
      )
    );
    if (existingTaskIndex >= 0) {
      const existingTask = targetQueue[existingTaskIndex];
      const incomingVersion = typeof latestPayload?.updatedAt === 'string' ? latestPayload.updatedAt : '';
      const existingVersion = getPendingTaskPayloadVersion(existingTask);
      if (incomingVersion && existingVersion && incomingVersion < existingVersion) return;
      const canonicalDeleteName = type === 'delete_skill'
        ? (
            existingTask.payload?.name && existingTask.payload.name !== existingTask.payload?.id
              ? existingTask.payload.name
              : latestPayload?.name
          )
        : undefined;
      targetQueue[existingTaskIndex] = {
        ...existingTask,
        payload: canonicalDeleteName ? { ...latestPayload, name: canonicalDeleteName } : latestPayload,
        retries: 0,
        nextRetryTime: Date.now(),
        updatedAt: nextIsoTimestamp(existingTask.updatedAt),
      };
      this.saveTargetPendingQueue(ownerId, targetQueue);
      return;
    }

    const task: PendingSyncTask = {
      id: createId('synctask'),
      type,
      payload: latestPayload,
      retries: 0,
      nextRetryTime: Date.now(),
      updatedAt: typeof latestPayload?.updatedAt === 'string'
        ? latestPayload.updatedAt
        : new Date().toISOString(),
    };
    targetQueue.push(task);
    this.saveTargetPendingQueue(ownerId, targetQueue);
  }

  private saveTargetPendingQueue(
    ownerId: string,
    queue: PendingSyncTask[],
    removedTasks: PendingSyncTask[] = [],
  ): void {
    const projection = this.savePendingQueueForOwner(ownerId, queue, removedTasks);
    if (ownerId === this.activeOwnerId) {
      this.pendingQueue = projection.tasks;
      this.pendingTaskDeletionVersions = projection.taskDeletionVersions;
    }
  }

  private readPendingQueueForOwner(ownerId: string): PendingSyncTask[] {
    if (this.storage) return this.loadPendingQueueForOwner(ownerId);
    return ownerId === this.activeOwnerId ? this.pendingQueue : [];
  }

  private isObsoleteSkillUpsert(
    projection: KnowledgeProjection,
    payload: AgentSkillRecord,
  ): boolean {
    const deletedAt = getSkillDeletionVersion(projection, payload);
    return Boolean(deletedAt && deletedAt >= payload.updatedAt);
  }

  private removePendingTaskForOwner(
    type: PendingSyncTask['type'],
    payloadId: string,
    ownerId: string,
    acknowledgedUpdatedAt?: string,
  ): void {
    const targetQueue = this.readPendingQueueForOwner(ownerId);
    const nextQueue = targetQueue.filter((task) => !(
      task.type === type
      && getPendingTaskPayloadId(task) === payloadId
      && (
        acknowledgedUpdatedAt === undefined
        || getPendingTaskPayloadVersion(task) === acknowledgedUpdatedAt
      )
    ));
    if (nextQueue.length !== targetQueue.length) {
      this.saveTargetPendingQueue(
        ownerId,
        nextQueue,
        targetQueue.filter((task) => !nextQueue.some((candidate) => candidate.id === task.id)),
      );
    }
  }

  private async executePendingTask(task: PendingSyncTask, ownerId: string): Promise<boolean> {
    if (task.type === 'delete_skill') return this.executeDeleteSkill(task.payload, ownerId);
    if (task.type === 'upsert_skill') return this.executeSkillSync(task.payload, ownerId);
    return this.executeChangeSync(task.payload, ownerId);
  }

  private updatePendingTaskForOwner(
    ownerId: string,
    taskId: string,
    success: boolean,
    acknowledgedPayloadVersion: string,
  ): void {
    const targetQueue = this.readPendingQueueForOwner(ownerId);
    const task = targetQueue.find((candidate) => candidate.id === taskId);
    if (!task) return;
    if (getPendingTaskPayloadVersion(task) !== acknowledgedPayloadVersion) return;
    if (success) {
      this.saveTargetPendingQueue(
        ownerId,
        targetQueue.filter((candidate) => candidate.id !== taskId),
        [task],
      );
      return;
    }
    task.retries += 1;
    task.nextRetryTime = Date.now() + Math.min(300000, 5000 * Math.pow(2, task.retries));
    task.updatedAt = nextIsoTimestamp(task.updatedAt);
    this.saveTargetPendingQueue(ownerId, targetQueue);
  }

  private async flushPendingTasksForActiveOwner(): Promise<void> {
    this.ensureOwnerScope();
    if (this.storage) {
      const projection = this.loadPendingQueueProjectionForOwner(this.activeOwnerId);
      this.pendingQueue = projection.tasks;
      this.pendingTaskDeletionVersions = projection.taskDeletionVersions;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const ownerId = this.activeOwnerId;
    const tasksToRun = this.pendingQueue.filter((task) => Date.now() >= task.nextRetryTime);
    for (const task of tasksToRun) {
      this.ensureOwnerScope();
      if (this.activeOwnerId !== ownerId) break;
      const acknowledgedPayloadVersion = getPendingTaskPayloadVersion(task);
      if (
        task.type === 'upsert_skill'
        && this.isObsoleteSkillUpsert(
          this.storage ? this.loadProjectionForOwner(ownerId) : this.projection,
          task.payload,
        )
      ) {
        this.removePendingTaskForOwner(
          task.type,
          getPendingTaskPayloadId(task),
          ownerId,
          acknowledgedPayloadVersion,
        );
        continue;
      }
      const success = await this.executePendingTask(task, ownerId);
      this.ensureOwnerScope();
      this.updatePendingTaskForOwner(ownerId, task.id, success, acknowledgedPayloadVersion);
      if (this.activeOwnerId !== ownerId) break;
    }
  }

  private startSyncScheduler(): void {
    if (this.syncSchedulerActive || typeof window === 'undefined') return;
    this.syncSchedulerActive = true;

    const runScheduler = async () => {
      if (!navigator.onLine) {
        setTimeout(runScheduler, 15000);
        return;
      }
      await this.flushPendingTasksForActiveOwner();
      setTimeout(runScheduler, 10000);
    };

    window.addEventListener('online', () => {
      this.ensureOwnerScope();
      if (this.storage) {
        const projection = this.loadPendingQueueProjectionForOwner(this.activeOwnerId);
        this.pendingQueue = projection.tasks;
        this.pendingTaskDeletionVersions = projection.taskDeletionVersions;
      }
      this.pendingQueue.forEach((task) => {
        task.nextRetryTime = Date.now();
        task.updatedAt = nextIsoTimestamp(task.updatedAt);
      });
      this.savePendingQueue();
    });

    setTimeout(runScheduler, 5000);
  }

  searchProject(query: string, limit = 8): KnowledgeSearchResult[] {
    this.ensureOwnerScope();
    this.refreshProjectionFromStorage();
    const normalizedQuery = sanitizeString(query).toLowerCase();
    const resultLimit = Math.max(1, Math.min(Number(limit) || 8, 20));
    const candidates: KnowledgeSearchResult[] = [
      ...BASELINE_DOCUMENTS.map((doc): KnowledgeSearchResult => ({
        id: doc.id,
        kind: 'document',
        title: doc.title,
        summary: doc.summary,
        path: doc.path,
        score: scoreText(normalizedQuery, `${doc.title} ${doc.summary} ${doc.path}`),
        updatedAt: doc.updatedAt,
      })),
      ...this.projection.changes.map((change): KnowledgeSearchResult => ({
        id: change.id,
        kind: 'change',
        title: change.title,
        summary: change.summary,
        path: change.paths[0],
        score: scoreText(normalizedQuery, `${change.title} ${change.summary} ${change.paths.join(' ')} ${change.tools.join(' ')}`),
        updatedAt: change.updatedAt,
      })),
      ...this.projection.uiChanges.map((change): KnowledgeSearchResult => ({
        id: change.id,
        kind: 'ui-change',
        title: change.component,
        summary: change.summary,
        path: 'docs/ai-assistant/ui-map.md',
        score: scoreText(normalizedQuery, `${change.component} ${change.summary} ${change.selector || ''}`),
        updatedAt: change.updatedAt,
      })),
      ...this.projection.skills.map((skill): KnowledgeSearchResult => ({
        id: skill.id,
        kind: 'skill',
        title: skill.name,
        summary: skill.trigger,
        path: 'docs/ai-assistant/skills.md',
        score: scoreText(normalizedQuery, `${skill.name} ${skill.trigger} ${skill.tools.join(' ')}`),
        updatedAt: skill.updatedAt,
      })),
    ];

    return candidates
      .filter(result => normalizedQuery.length === 0 || result.score > 0)
      .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, resultLimit);
  }

  private loadProjection(): KnowledgeProjection {
    return this.loadProjectionForOwner(this.activeOwnerId);
  }

  private loadProjectionForOwner(ownerId: string): KnowledgeProjection {
    if (!this.storage) return emptyProjection();

    let projection = emptyProjection();
    try {
      const raw = this.storage.getItem(this.projectionStorageKey(ownerId));
      if (raw) {
        projection = mergeKnowledgeProjections(
          projection,
          normalizeKnowledgeProjection(JSON.parse(raw) as Partial<KnowledgeProjection>),
        );
      }
    } catch {
      // Ignore a corrupted legacy snapshot and continue with conflict-safe entries.
    }
    for (const entryKey of this.listStorageEntryKeys(this.projectionEntryPrefix(ownerId))) {
      try {
        const raw = this.storage.getItem(entryKey);
        if (!raw) continue;
        projection = mergeKnowledgeProjections(
          projection,
          normalizeKnowledgeProjection(JSON.parse(raw) as Partial<KnowledgeProjection>),
        );
      } catch {
        // Ignore one corrupted entry without discarding the other owner-scoped snapshots.
      }
    }
    return projection;
  }

  private saveProjectionForOwner(
    ownerId: string,
    projection: KnowledgeProjection,
    mergeWithPersisted = true,
  ): KnowledgeProjection {
    if (!this.storage) return projection;
    const oldEntryKeys = this.listStorageEntryKeys(this.projectionEntryPrefix(ownerId));
    let nextProjection = projection;
    try {
      if (mergeWithPersisted) {
        nextProjection = mergeKnowledgeProjections(
          this.loadProjectionForOwner(ownerId),
          nextProjection,
        );
      }
      const entryKey = `${this.projectionEntryPrefix(ownerId)}${createId('snapshot')}`;
      this.storage.setItem(entryKey, JSON.stringify(nextProjection));
      this.storage.setItem(this.projectionStorageKey(ownerId), JSON.stringify(nextProjection));
      for (const oldEntryKey of oldEntryKeys) {
        if (oldEntryKey !== entryKey) this.storage.removeItem(oldEntryKey);
      }
    } catch {
      // localStorage is only a browser projection/cache; quota failures should not block tool execution.
    }
    return nextProjection;
  }

  private saveProjection(mergeWithPersisted = true): void {
    this.projection = this.saveProjectionForOwner(
      this.activeOwnerId,
      this.projection,
      mergeWithPersisted,
    );
  }
}

export const knowledgeStore = new KnowledgeStore();
