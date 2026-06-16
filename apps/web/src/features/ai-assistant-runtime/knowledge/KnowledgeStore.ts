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
};

export interface PendingSyncTask {
  id: string;
  type: 'upsert_skill' | 'delete_skill' | 'record_change';
  payload: any;
  retries: number;
  nextRetryTime: number;
}

const DEFAULT_STORAGE_KEY = 'kk_agent_knowledge_projection_v1';

const BASELINE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'doc-ai-assistant-readme',
    source: 'doc',
    path: 'docs/ai-assistant/README.md',
    title: 'AI assistant knowledge base',
    summary: 'Entry point for KK Studio v1.5.7 assistant module maps, flows, tools, safety, UI map, skills, and session memory.',
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

const scoreText = (query: string, text: string): number => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;

  const lowerText = text.toLowerCase();
  return terms.reduce((score, term) => score + (lowerText.includes(term) ? 1 : 0), 0);
};

export class KnowledgeStore {
  private readonly storageKey: string;
  private readonly storage: Storage | null;
  private projection: KnowledgeProjection = emptyProjection();
  private pendingQueue: PendingSyncTask[] = [];
  private syncSchedulerActive = false;

  constructor(
    storageKey = DEFAULT_STORAGE_KEY,
    storage: Storage | null = getBrowserStorage()
  ) {
    this.storageKey = storageKey;
    this.storage = storage;
    this.projection = this.loadProjection();
    this.loadPendingQueue();
    this.startSyncScheduler();
  }

  private loadPendingQueue(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem('kk_pending_sync_queue_v1');
      if (raw) {
        this.pendingQueue = JSON.parse(raw);
      }
    } catch {
      this.pendingQueue = [];
    }
  }

  private savePendingQueue(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem('kk_pending_sync_queue_v1', JSON.stringify(this.pendingQueue));
    } catch {
      // 忽略
    }
  }

  listDocuments(): KnowledgeDocument[] {
    return [...BASELINE_DOCUMENTS];
  }

  listChanges(): KnowledgeChangeRecord[] {
    return [...this.projection.changes];
  }

  listUiChanges(): UiLayoutChangeRecord[] {
    return [...this.projection.uiChanges];
  }

  listSkills(): AgentSkillRecord[] {
    return [...this.projection.skills];
  }

  getPendingTasks(): PendingSyncTask[] {
    return [...this.pendingQueue];
  }

  clearProjection(): void {
    this.projection = emptyProjection();
    this.saveProjection();
  }

  recordChange(input: KnowledgeChangeInput): KnowledgeChangeRecord {
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
    this.syncChangeToBackend(record);

    return record;
  }

  recordLayoutChange(input: UiLayoutChangeInput): UiLayoutChangeRecord {
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
    return record;
  }

  upsertSkill(input: SkillUpsertInput): AgentSkillRecord {
    const now = new Date().toISOString();
    const name = sanitizeString(input.name);
    if (!name || !sanitizeString(input.trigger) || sanitizeStringArray(input.tools).length === 0) {
      throw new Error('skills.upsertSkill requires name, trigger, and tools.');
    }

    const existing = this.projection.skills.find(skill => skill.name === name);
    const record: AgentSkillRecord = {
      id: existing?.id || createId('skill'),
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
    this.syncSkillToBackend(record);

    return record;
  }

  deleteSkill(id: string): void {
    this.projection.skills = this.projection.skills.filter(skill => skill.id !== id);
    this.saveProjection();
    void this.syncDeleteSkillToBackend(id);
  }

  private async syncDeleteSkillToBackend(id: string) {
    const success = await this.executeDeleteSkill(id);
    if (!success) {
      this.enqueueTask('delete_skill', id);
    }
  }

  private async executeDeleteSkill(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/ai-assistant/skills/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async syncChangeToBackend(record: KnowledgeChangeRecord) {
    const success = await this.executeChangeSync(record);
    if (!success) {
      this.enqueueTask('record_change', record);
    }
  }

  private async executeChangeSync(record: KnowledgeChangeRecord): Promise<boolean> {
    try {
      const res = await fetch('/api/ai-assistant/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async syncSkillToBackend(record: AgentSkillRecord) {
    const success = await this.executeSkillSync(record);
    if (!success) {
      this.enqueueTask('upsert_skill', record);
    }
  }

  private async executeSkillSync(record: AgentSkillRecord): Promise<boolean> {
    try {
      const res = await fetch('/api/ai-assistant/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private enqueueTask(type: PendingSyncTask['type'], payload: any): void {
    const isDup = this.pendingQueue.some(t => 
      t.type === type && 
      (type === 'delete_skill' ? t.payload === payload : t.payload.id === payload.id)
    );
    if (isDup) return;

    const task: PendingSyncTask = {
      id: createId('synctask'),
      type,
      payload,
      retries: 0,
      nextRetryTime: Date.now(),
    };
    this.pendingQueue.push(task);
    this.savePendingQueue();
  }

  private startSyncScheduler(): void {
    if (this.syncSchedulerActive || typeof window === 'undefined') return;
    this.syncSchedulerActive = true;

    const runScheduler = async () => {
      if (!navigator.onLine) {
        setTimeout(runScheduler, 15000);
        return;
      }

      const now = Date.now();
      const tasksToRun = this.pendingQueue.filter(t => now >= t.nextRetryTime);
      
      for (const task of tasksToRun) {
        let success = false;
        if (task.type === 'delete_skill') {
          success = await this.executeDeleteSkill(task.payload);
        } else if (task.type === 'upsert_skill') {
          success = await this.executeSkillSync(task.payload);
        } else if (task.type === 'record_change') {
          success = await this.executeChangeSync(task.payload);
        }

        if (success) {
          this.pendingQueue = this.pendingQueue.filter(t => t.id !== task.id);
        } else {
          task.retries += 1;
          const backoff = Math.min(300000, 5000 * Math.pow(2, task.retries));
          task.nextRetryTime = Date.now() + backoff;
        }
      }

      if (tasksToRun.length > 0) {
        this.savePendingQueue();
      }

      setTimeout(runScheduler, 10000);
    };

    window.addEventListener('online', () => {
      this.pendingQueue.forEach(t => { t.nextRetryTime = Date.now(); });
    });

    setTimeout(runScheduler, 5000);
  }

  searchProject(query: string, limit = 8): KnowledgeSearchResult[] {
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
    if (!this.storage) return emptyProjection();

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return emptyProjection();
      const parsed = JSON.parse(raw) as Partial<KnowledgeProjection>;
      return {
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        uiChanges: Array.isArray(parsed.uiChanges) ? parsed.uiChanges : [],
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      };
    } catch {
      return emptyProjection();
    }
  }

  private saveProjection(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.projection));
    } catch {
      // localStorage is only a browser projection/cache; quota failures should not block tool execution.
    }
  }
}

export const knowledgeStore = new KnowledgeStore();
