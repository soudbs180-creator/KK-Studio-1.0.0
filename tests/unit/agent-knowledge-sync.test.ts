import test from 'node:test';
import assert from 'node:assert/strict';

import { KnowledgeStore } from '../../apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts';
import { kkWebApiClient } from '../../apps/web/src/services/api/kkApiClient.ts';

const createMemoryStorage = () => {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    key(index: number) {
      return Object.keys(store)[index] || null;
    },
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  } as any;
};

test('KnowledgeStore searches baseline assistant documents', () => {
  const store = new KnowledgeStore('test-knowledge-baseline', createMemoryStorage());
  const results = store.searchProject('tool registry zip originals', 5);

  assert.ok(results.some(result => result.path === 'docs/ai-assistant/tool-registry.md'));
  assert.ok(results.some(result => result.path === 'docs/ai-assistant/flow-map.md'));
});

test('KnowledgeStore records change summaries and redacts sensitive strings', () => {
  const storage = createMemoryStorage();
  const store = new KnowledgeStore('test-knowledge-redaction', storage);
  const fakeApiKey = 'sk-' + 'test-1234567890';
  const fakeBearer = 'Bearer ' + 'abcdefghijklmnopqrstuvwxyz';

  const change = store.recordChange({
    title: 'Secret handling update',
    summary: `Never store ${fakeApiKey} or ${fakeBearer} in knowledge records.`,
    source: 'runtime',
    paths: ['apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts'],
    tools: ['knowledge.recordChange'],
    validation: ['npm run governance:check'],
  });

  assert.equal(change.summary.includes(fakeApiKey), false);
  assert.equal(change.summary.includes(fakeBearer), false);
  assert.equal(change.summary.includes('sk-***'), true);

  const reloaded = new KnowledgeStore('test-knowledge-redaction', storage);
  assert.equal(reloaded.listChanges().length, 1);
});

test('KnowledgeStore records UI layout changes and upserts skills', () => {
  const store = new KnowledgeStore('test-knowledge-ui-skill', createMemoryStorage());

  const uiChange = store.recordLayoutChange({
    component: 'AI takeover toggle',
    summary: 'Moved next to prompt composer controls.',
    selector: '#btn-ai-takeover-toggle',
    affectedTools: ['ui.highlightElement'],
    validation: ['tests/unit/ai-assistant-tool-registry.test.ts'],
  });

  const skill = store.upsertSkill({
    name: 'update-ui-map-after-layout-change',
    trigger: 'UI selector or panel position changed',
    tools: ['ui.recordLayoutChange', 'knowledge.recordChange'],
    steps: ['Record selector change', 'Update ui-map', 'Run governance check'],
    validation: ['npm run governance:check'],
  });

  assert.equal(uiChange.component, 'AI takeover toggle');
  assert.equal(skill.name, 'update-ui-map-after-layout-change');
  assert.ok(store.searchProject('AI takeover toggle', 5).some(result => result.kind === 'ui-change'));
  assert.ok(store.searchProject('update ui map', 5).some(result => result.kind === 'skill'));
});

test('KnowledgeStore syncs UI layout knowledge through the typed KK API client', async (t) => {
  const originalRecordKnowledgeChange = kkWebApiClient.recordKnowledgeChange;
  let syncedRecord: any;
  kkWebApiClient.recordKnowledgeChange = (async (record: any) => {
    syncedRecord = record;
    return { success: true, data: { ok: true, data: record } } as any;
  }) as typeof kkWebApiClient.recordKnowledgeChange;
  t.after(() => {
    kkWebApiClient.recordKnowledgeChange = originalRecordKnowledgeChange;
  });

  const store = new KnowledgeStore('test-ui-layout-sync', createMemoryStorage(), () => 'user-layout');
  const uiChange = store.recordLayoutChange({
    component: 'Assistant permissions panel',
    summary: 'Moved beside plan verification details.',
    selector: '[data-testid="assistant-permissions"]',
    affectedTools: ['ui.recordLayoutChange'],
    validation: ['npm run typecheck'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(syncedRecord.id, uiChange.id);
  assert.equal(syncedRecord.source, 'ui');
  assert.equal(syncedRecord.title, 'Assistant permissions panel');
  assert.deepEqual(syncedRecord.paths, ['docs/ai-assistant/ui-map.md']);
});

test('KnowledgeStore validates required fields', () => {
  const store = new KnowledgeStore('test-knowledge-validation', createMemoryStorage());

  assert.throws(
    () => store.recordChange({ title: '', summary: '' }),
    /requires title and summary/
  );

  assert.throws(
    () => store.upsertSkill({ name: '', trigger: '', tools: [], steps: [] }),
    /requires name, trigger, and tools/
  );
});

test('KnowledgeStore keeps browser projections isolated by the current runtime owner', () => {
  const storage = createMemoryStorage();
  const userA = new KnowledgeStore('test-user-scope', storage, () => 'user-a');

  userA.recordChange({ title: 'Only A', summary: 'private projection for A' });
  assert.equal(userA.searchProject('Only A').some((result) => result.title === 'Only A'), true);
  const userB = new KnowledgeStore('test-user-scope', storage, () => 'user-b');
  assert.equal(userB.searchProject('Only A').some((result) => result.title === 'Only A'), false);

  userB.recordChange({ title: 'Only B', summary: 'private projection for B' });
  const reloadedA = new KnowledgeStore('test-user-scope', storage, () => 'user-a');
  assert.equal(reloadedA.searchProject('Only B').some((result) => result.title === 'Only B'), false);
  assert.equal(userB.searchProject('Only B').some((result) => result.title === 'Only B'), true);
});

test('KnowledgeStore keeps a failed async sync retry with the owner that created it', async (t) => {
  const originalRecordKnowledgeChange = kkWebApiClient.recordKnowledgeChange;
  let releaseRequest!: (response: any) => void;
  const pendingRequest = new Promise<any>((resolve) => { releaseRequest = resolve; });
  kkWebApiClient.recordKnowledgeChange = (() => pendingRequest) as typeof kkWebApiClient.recordKnowledgeChange;
  t.after(() => {
    kkWebApiClient.recordKnowledgeChange = originalRecordKnowledgeChange;
  });

  const storage = createMemoryStorage();
  let ownerId = 'user-a';
  const store = new KnowledgeStore('test-pending-owner-scope', storage, () => ownerId);
  store.recordChange({ title: 'Only A retry', summary: 'must remain in user A queue' });

  ownerId = 'user-b';
  assert.equal(store.getPendingTasks().length, 0);
  releaseRequest({ success: false });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getPendingTasks().length, 0);

  ownerId = 'user-a';
  const pendingForA = store.getPendingTasks();
  assert.equal(pendingForA.length, 1);
  assert.equal(pendingForA[0]?.payload.title, 'Only A retry');
});

test('KnowledgeStore stops an owner retry batch before sending the next task with a new owner', async (t) => {
  const originalRecordKnowledgeChange = kkWebApiClient.recordKnowledgeChange;
  let ownerId = 'user-a';
  let queueFailures = true;
  const observedTitles: string[] = [];
  kkWebApiClient.recordKnowledgeChange = (async (record: any) => {
    if (queueFailures) return { success: false } as any;
    observedTitles.push(record.title);
    ownerId = 'user-b';
    return { success: true, data: { ok: true, data: record } } as any;
  }) as typeof kkWebApiClient.recordKnowledgeChange;
  t.after(() => {
    kkWebApiClient.recordKnowledgeChange = originalRecordKnowledgeChange;
  });

  const store = new KnowledgeStore('test-owner-batch-scope', createMemoryStorage(), () => ownerId);
  store.recordChange({ title: 'A retry one', summary: 'first A task' });
  store.recordChange({ title: 'A retry two', summary: 'second A task' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getPendingTasks().length, 2);

  queueFailures = false;
  await (store as any).flushPendingTasksForActiveOwner();
  assert.equal(observedTitles.length, 1);
  assert.match(observedTitles[0] || '', /^A retry (one|two)$/);
  assert.equal(store.getPendingTasks().length, 0);

  ownerId = 'user-a';
  assert.equal(store.getPendingTasks().length, 1);
});

test('KnowledgeStore retains the newest pending Skill payload for one user-scoped id', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.upsertAgentSkill = (async () => ({ success: false } as any)) as typeof kkWebApiClient.upsertAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
  });

  const store = new KnowledgeStore('test-latest-skill-payload', createMemoryStorage(), () => 'user-skill');
  const first = store.upsertSkill({
    name: 'owner-safe-skill',
    trigger: 'version one',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  const second = store.upsertSkill({
    name: 'owner-safe-skill',
    trigger: 'version two',
    tools: ['knowledge.searchProject'],
    steps: ['read latest'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const pending = store.getPendingTasks().filter((task) => task.type === 'upsert_skill');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.payload.trigger, 'version two');
  assert.equal(pending[0]?.payload.updatedAt, second.updatedAt);
  assert.ok(second.updatedAt > first.updatedAt);
});

test('KnowledgeStore only acknowledges a Skill sync with an authoritative API ok result', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.upsertAgentSkill = (async () => ({
    success: true,
    data: {} as any,
  } as any)) as typeof kkWebApiClient.upsertAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
  });

  const store = new KnowledgeStore('test-skill-authoritative-ack', createMemoryStorage(), () => 'user-authoritative-ack');
  store.upsertSkill({
    name: 'authoritative-skill',
    trigger: 'requires nested ok',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(store.getPendingTasks().filter((task) => task.type === 'upsert_skill').length, 1);
});

test('KnowledgeStore does not let an older Skill sync success clear a newer pending retry', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  let releaseFirstRequest!: (response: any) => void;
  const firstRequest = new Promise<any>((resolve) => {
    releaseFirstRequest = resolve;
  });
  let requestCount = 0;
  kkWebApiClient.upsertAgentSkill = ((record: any) => {
    requestCount += 1;
    if (requestCount === 1) return firstRequest;
    return Promise.resolve({ success: false });
  }) as typeof kkWebApiClient.upsertAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
  });

  const store = new KnowledgeStore('test-skill-out-of-order-ack', createMemoryStorage(), () => 'user-skill-race');
  const first = store.upsertSkill({
    name: 'versioned-skill',
    trigger: 'version one',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  const second = store.upsertSkill({
    name: 'versioned-skill',
    trigger: 'version two',
    tools: ['knowledge.searchProject'],
    steps: ['read latest'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  let pending = store.getPendingTasks().filter((task) => task.type === 'upsert_skill');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.payload.updatedAt, second.updatedAt);

  releaseFirstRequest({ success: true, data: { ok: true, data: first } });
  await new Promise((resolve) => setTimeout(resolve, 0));

  pending = store.getPendingTasks().filter((task) => task.type === 'upsert_skill');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.payload.trigger, 'version two');
  assert.equal(pending[0]?.payload.updatedAt, second.updatedAt);
});

test('KnowledgeStore retry scheduler only acknowledges the Skill payload version it sent', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  let releaseRetryRequest!: (response: any) => void;
  const retryRequest = new Promise<any>((resolve) => {
    releaseRetryRequest = resolve;
  });
  let requestCount = 0;
  kkWebApiClient.upsertAgentSkill = ((record: any) => {
    requestCount += 1;
    if (requestCount === 2) return retryRequest;
    return Promise.resolve({ success: false });
  }) as typeof kkWebApiClient.upsertAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
  });

  const store = new KnowledgeStore('test-skill-scheduler-version-ack', createMemoryStorage(), () => 'user-scheduler-race');
  store.upsertSkill({
    name: 'scheduled-skill',
    trigger: 'version one',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const retryBatch = (store as any).flushPendingTasksForActiveOwner() as Promise<void>;
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = store.upsertSkill({
    name: 'scheduled-skill',
    trigger: 'version two',
    tools: ['knowledge.searchProject'],
    steps: ['read latest'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  releaseRetryRequest({ success: true, data: { ok: true } });
  await retryBatch;

  const pending = store.getPendingTasks().filter((task) => task.type === 'upsert_skill');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.payload.trigger, 'version two');
  assert.equal(pending[0]?.payload.updatedAt, second.updatedAt);
});

test('KnowledgeStore suppresses an obsolete upsert retry when that Skill was deleted in flight', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  let releaseUpsert!: (response: any) => void;
  const upsertRequest = new Promise<any>((resolve) => {
    releaseUpsert = resolve;
  });
  kkWebApiClient.upsertAgentSkill = (() => upsertRequest) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (async () => ({
    success: true,
    data: { ok: true },
  } as any)) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const store = new KnowledgeStore('test-skill-delete-late-failure', createMemoryStorage(), () => 'user-delete-race');
  const skill = store.upsertSkill({
    name: 'deleted-while-syncing',
    trigger: 'late failure',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  store.deleteSkill(skill.id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.listSkills().length, 0);

  releaseUpsert({ success: false });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(store.getPendingTasks().some((task) => task.type === 'upsert_skill'), false);
});

test('KnowledgeStore sends a newer deletion version that protects against a late upsert success', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  let releaseUpsert!: (response: any) => void;
  const upsertRequest = new Promise<any>((resolve) => {
    releaseUpsert = resolve;
  });
  let deletionInput: any;
  kkWebApiClient.upsertAgentSkill = (() => upsertRequest) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (async (_skillId: string, input: any) => {
    deletionInput = input;
    return { success: true, data: { ok: true } } as any;
  }) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const store = new KnowledgeStore('test-skill-delete-late-success', createMemoryStorage(), () => 'user-delete-version');
  const skill = store.upsertSkill({
    name: 'delete-wins-by-version',
    trigger: 'late success',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  store.deleteSkill(skill.id);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(typeof deletionInput?.updatedAt, 'string');
  assert.ok(deletionInput.updatedAt > skill.updatedAt);

  releaseUpsert({ success: true, data: { ok: true } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.listSkills().length, 0);
  assert.equal(store.getPendingTasks().some((task) => task.type === 'upsert_skill'), false);
});

test('KnowledgeStore recreates a same-name Skill strictly after its deletion tombstone', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-07-19T00:00:00.000Z');
  kkWebApiClient.upsertAgentSkill = (async () => ({ success: false } as any)) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (async () => ({
    success: true,
    data: { ok: true },
  } as any)) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    Date.now = originalNow;
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const storage = createMemoryStorage();
  const storageKey = 'test-skill-delete-recreate';
  const ownerId = 'user-delete-recreate';
  const store = new KnowledgeStore(storageKey, storage, () => ownerId);
  const first = store.upsertSkill({
    name: 'recreated-logical-skill',
    trigger: 'first version',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  store.deleteSkill(first.id);
  const recreated = store.upsertSkill({
    name: 'recreated-logical-skill',
    trigger: 'explicit recreation',
    tools: ['knowledge.searchProject'],
    steps: ['read newest'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const projection = JSON.parse(storage.getItem(`${storageKey}:owner:${ownerId}`) || '{}');
  const deletionVersion = projection.skillDeletionVersions?.['name:recreated-logical-skill'];
  assert.equal(typeof deletionVersion, 'string');
  assert.ok(recreated.updatedAt > deletionVersion);
  assert.deepEqual(store.listSkills().map((skill) => skill.id), [recreated.id]);
  const pendingUpserts = store.getPendingTasks().filter((task) => task.type === 'upsert_skill');
  assert.equal(pendingUpserts.length, 1);
  assert.equal(pendingUpserts[0]?.payload.id, recreated.id);
  assert.equal(pendingUpserts[0]?.payload.updatedAt, recreated.updatedAt);
});

test('KnowledgeStore refreshes same-owner Skill reads across tabs before use', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  kkWebApiClient.upsertAgentSkill = (async (record: any) => ({
    success: true,
    data: { ok: true, data: record },
  } as any)) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (async () => ({
    success: true,
    data: { ok: true },
  } as any)) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const storage = createMemoryStorage();
  const owner = () => 'user-live-tab-projection';
  const firstTab = new KnowledgeStore('test-skill-live-tab-projection', storage, owner);
  const secondTab = new KnowledgeStore('test-skill-live-tab-projection', storage, owner);
  const created = firstTab.upsertSkill({
    name: 'cross-tab-visible-skill',
    trigger: 'visible until another tab deletes it',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });

  assert.equal(secondTab.listSkills()[0]?.id, created.id);
  secondTab.deleteSkill(created.id);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(firstTab.listSkills().some((skill) => skill.name === created.name), false);
  assert.equal(firstTab.searchProject(created.name).some((result) => result.kind === 'skill'), false);
});

test('KnowledgeStore shares a deletion marker across same-name Skills created with different tab ids', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  const releases: Array<(response: any) => void> = [];
  kkWebApiClient.upsertAgentSkill = (() => new Promise<any>((resolve) => {
    releases.push(resolve);
  })) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (async () => ({
    success: true,
    data: { ok: true },
  } as any)) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const storage = createMemoryStorage();
  const isolatedSecondTabStorage = createMemoryStorage();
  let secondTabBacking = isolatedSecondTabStorage;
  const secondTabStorage = {
    get length() {
      return secondTabBacking.length;
    },
    key: (index: number) => secondTabBacking.key(index),
    getItem: (key: string) => secondTabBacking.getItem(key),
    setItem: (key: string, value: string) => secondTabBacking.setItem(key, value),
    removeItem: (key: string) => secondTabBacking.removeItem(key),
    clear: () => secondTabBacking.clear(),
  } as any;
  const firstTab = new KnowledgeStore('test-skill-cross-tab-name', storage, () => 'user-cross-tab');
  const secondTab = new KnowledgeStore('test-skill-cross-tab-name', secondTabStorage, () => 'user-cross-tab');
  const first = firstTab.upsertSkill({
    name: 'same-logical-skill',
    trigger: 'first tab',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  const second = secondTab.upsertSkill({
    name: 'same-logical-skill',
    trigger: 'second tab',
    tools: ['knowledge.searchProject'],
    steps: ['read latest'],
  });
  assert.notEqual(first.id, second.id);

  const projectionKey = 'test-skill-cross-tab-name:owner:user-cross-tab';
  const isolatedProjection = isolatedSecondTabStorage.getItem(projectionKey);
  assert.ok(isolatedProjection);
  storage.setItem(projectionKey, isolatedProjection);
  secondTabBacking = storage;
  secondTab.deleteSkill(second.id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  releases[0]?.({ success: false });
  releases[1]?.({ success: true, data: { ok: true } });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(firstTab.getPendingTasks().some((task) => task.type === 'upsert_skill'), false);
});

test('KnowledgeStore cross-tab cleanup preserves a newer persisted delete retry', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  kkWebApiClient.upsertAgentSkill = (() => new Promise<any>(() => {})) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (async () => ({ success: false } as any)) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const storage = createMemoryStorage();
  const owner = () => 'user-cross-tab-queue';
  const firstTab = new KnowledgeStore('test-skill-cross-tab-queue', storage, owner);
  const secondTab = new KnowledgeStore('test-skill-cross-tab-queue', storage, owner);
  const first = firstTab.upsertSkill({
    name: 'queued-logical-skill',
    trigger: 'first tab',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  const second = secondTab.upsertSkill({
    name: 'queued-logical-skill',
    trigger: 'second tab',
    tools: ['knowledge.searchProject'],
    steps: ['read latest'],
  });
  (firstTab as any).enqueueTask('upsert_skill', first);

  secondTab.deleteSkill(second.id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(
    new KnowledgeStore('test-skill-cross-tab-queue', storage, owner)
      .getPendingTasks()
      .some((task) => task.type === 'delete_skill'),
    true,
  );

  await (firstTab as any).flushPendingTasksForActiveOwner();
  const reloaded = new KnowledgeStore('test-skill-cross-tab-queue', storage, owner);
  assert.equal(reloaded.getPendingTasks().some((task) => task.type === 'delete_skill'), true);
  assert.equal(reloaded.getPendingTasks().some((task) => task.type === 'upsert_skill'), false);
});

test('KnowledgeStore unrelated cross-tab writes cannot overwrite a Skill deletion version', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  const originalRecordKnowledgeChange = kkWebApiClient.recordKnowledgeChange;
  const upsertReleases: Array<(response: any) => void> = [];
  let releaseDelete!: (response: any) => void;
  kkWebApiClient.upsertAgentSkill = (() => new Promise<any>((resolve) => {
    upsertReleases.push(resolve);
  })) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (() => new Promise<any>((resolve) => {
    releaseDelete = resolve;
  })) as typeof kkWebApiClient.deleteAgentSkill;
  kkWebApiClient.recordKnowledgeChange = (async (record: any) => ({
    success: true,
    data: { ok: true, data: record },
  } as any)) as typeof kkWebApiClient.recordKnowledgeChange;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
    kkWebApiClient.recordKnowledgeChange = originalRecordKnowledgeChange;
  });

  const storage = createMemoryStorage();
  const owner = () => 'user-cross-tab-projection';
  const firstTab = new KnowledgeStore('test-skill-cross-tab-projection', storage, owner);
  const secondTab = new KnowledgeStore('test-skill-cross-tab-projection', storage, owner);
  const first = firstTab.upsertSkill({
    name: 'projection-safe-skill',
    trigger: 'first tab',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  const second = secondTab.upsertSkill({
    name: 'projection-safe-skill',
    trigger: 'second tab',
    tools: ['knowledge.searchProject'],
    steps: ['read latest'],
  });

  secondTab.deleteSkill(second.id);
  firstTab.recordChange({
    title: 'Unrelated cross-tab note',
    summary: 'must merge instead of replacing the deletion marker',
  });
  releaseDelete({ success: false });
  upsertReleases[0]?.({ success: false });
  upsertReleases[1]?.({ success: true, data: { ok: true } });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const reloaded = new KnowledgeStore('test-skill-cross-tab-projection', storage, owner);
  assert.equal(reloaded.getPendingTasks().some((task) => task.type === 'delete_skill'), true);
  assert.equal(reloaded.getPendingTasks().some((task) => task.type === 'upsert_skill'), false);
  assert.equal(reloaded.listSkills().some((skill) => skill.name === first.name), false);
});

test('KnowledgeStore preserves an unseen cross-tab deletion shard during a stale projection write', (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  const originalRecordKnowledgeChange = kkWebApiClient.recordKnowledgeChange;
  kkWebApiClient.upsertAgentSkill = (() => new Promise<any>(() => {})) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (() => new Promise<any>(() => {})) as typeof kkWebApiClient.deleteAgentSkill;
  kkWebApiClient.recordKnowledgeChange = (() => new Promise<any>(() => {})) as typeof kkWebApiClient.recordKnowledgeChange;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
    kkWebApiClient.recordKnowledgeChange = originalRecordKnowledgeChange;
  });

  const storageKey = 'test-conflict-safe-projection-shards';
  const ownerId = 'user-conflict-safe-projection';
  const backingStorage = createMemoryStorage();
  const projectionEntryPrefix = `${storageKey}:owner:${ownerId}:entry:`;
  let beforeNextProjectionEntryWrite: (() => void) | undefined;
  const firstTabStorage = {
    get length() {
      return backingStorage.length;
    },
    key: (index: number) => backingStorage.key(index),
    getItem: (key: string) => backingStorage.getItem(key),
    setItem(key: string, value: string) {
      if (beforeNextProjectionEntryWrite && key.startsWith(projectionEntryPrefix)) {
        const callback = beforeNextProjectionEntryWrite;
        beforeNextProjectionEntryWrite = undefined;
        callback();
      }
      backingStorage.setItem(key, value);
    },
    removeItem: (key: string) => backingStorage.removeItem(key),
    clear: () => backingStorage.clear(),
  } as any;
  const owner = () => ownerId;
  const firstTab = new KnowledgeStore(storageKey, firstTabStorage, owner);
  const skill = firstTab.upsertSkill({
    name: 'deletion-shard-must-survive',
    trigger: 'created before the interleaving write',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  const secondTab = new KnowledgeStore(storageKey, backingStorage, owner);

  let deletionInterleaved = false;
  beforeNextProjectionEntryWrite = () => {
    deletionInterleaved = true;
    secondTab.deleteSkill(skill.id);
  };
  firstTab.recordChange({
    title: 'Concurrent unrelated projection write',
    summary: 'must retain the deletion shard created after this tab read its baseline',
  });

  const reloaded = new KnowledgeStore(storageKey, backingStorage, owner);
  assert.equal(deletionInterleaved, true);
  assert.equal(reloaded.listSkills().some((candidate) => candidate.name === skill.name), false);
  assert.equal(
    reloaded.listChanges().some((change) => change.title === 'Concurrent unrelated projection write'),
    true,
  );
});

test('KnowledgeStore preserves both pending writes when tabs interleave after reading the same queue', () => {
  const storageKey = 'test-conflict-safe-pending-shards';
  const ownerId = 'user-conflict-safe-pending';
  const backingStorage = createMemoryStorage();
  const pendingEntryPrefix = `${storageKey}:pending:${ownerId}:entry:`;
  let beforeNextPendingEntryWrite: (() => void) | undefined;
  const firstTabStorage = {
    get length() {
      return backingStorage.length;
    },
    key: (index: number) => backingStorage.key(index),
    getItem: (key: string) => backingStorage.getItem(key),
    setItem(key: string, value: string) {
      if (beforeNextPendingEntryWrite && key.startsWith(pendingEntryPrefix)) {
        const callback = beforeNextPendingEntryWrite;
        beforeNextPendingEntryWrite = undefined;
        callback();
      }
      backingStorage.setItem(key, value);
    },
    removeItem: (key: string) => backingStorage.removeItem(key),
    clear: () => backingStorage.clear(),
  } as any;
  const owner = () => ownerId;
  const firstTab = new KnowledgeStore(storageKey, firstTabStorage, owner);
  const secondTab = new KnowledgeStore(storageKey, backingStorage, owner);
  const payload = (id: string, updatedAt: string) => ({
    id,
    title: id,
    summary: `${id} pending payload`,
    source: 'runtime',
    paths: [],
    affectedModules: [],
    tools: [],
    validation: [],
    createdAt: updatedAt,
    updatedAt,
  });

  (firstTab as any).enqueueTask('record_change', payload('seed-change', '2026-07-19T01:00:00.000Z'), ownerId);
  let secondWriteInterleaved = false;
  beforeNextPendingEntryWrite = () => {
    secondWriteInterleaved = true;
    (secondTab as any).enqueueTask('record_change', payload('second-tab-change', '2026-07-19T01:00:02.000Z'), ownerId);
  };
  (firstTab as any).enqueueTask('record_change', payload('first-tab-change', '2026-07-19T01:00:01.000Z'), ownerId);

  const ids = new KnowledgeStore(storageKey, backingStorage, owner)
    .getPendingTasks()
    .map((task) => task.payload.id)
    .sort();
  assert.equal(secondWriteInterleaved, true);
  assert.deepEqual(ids, ['first-tab-change', 'second-tab-change', 'seed-change']);
});

test('KnowledgeStore keeps the canonical Skill name when duplicate deletes fail out of order', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-07-19T02:00:00.000Z');
  kkWebApiClient.upsertAgentSkill = (() => new Promise<any>(() => {})) as typeof kkWebApiClient.upsertAgentSkill;
  const deleteInputs: Array<{ skillId: string; input: any }> = [];
  const deleteReleases: Array<(response: any) => void> = [];
  kkWebApiClient.deleteAgentSkill = ((skillId: string, input: any) => {
    deleteInputs.push({ skillId, input });
    return new Promise<any>((resolve) => deleteReleases.push(resolve));
  }) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    Date.now = originalNow;
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const store = new KnowledgeStore(
    'test-duplicate-delete-canonical-name',
    createMemoryStorage(),
    () => 'user-duplicate-delete',
  );
  const skill = store.upsertSkill({
    name: 'canonical-delete-name',
    trigger: 'duplicate delete',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  store.deleteSkill(skill.id);
  store.deleteSkill(skill.id);

  const writeAheadTask = store.getPendingTasks().find((task) => task.type === 'delete_skill');
  assert.equal(deleteInputs.length, 2);
  assert.equal(writeAheadTask?.payload.name, skill.name);
  assert.equal(writeAheadTask?.payload.updatedAt, deleteInputs[1]?.input.updatedAt);
  assert.ok(deleteInputs[1]?.input.updatedAt > deleteInputs[0]?.input.updatedAt);

  deleteReleases[1]?.({ success: false });
  await new Promise((resolve) => setTimeout(resolve, 0));
  deleteReleases[0]?.({ success: false });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const pendingDeletes = store.getPendingTasks().filter((task) => task.type === 'delete_skill');
  assert.equal(pendingDeletes.length, 1);
  assert.equal(pendingDeletes[0]?.payload.id, skill.id);
  assert.equal(pendingDeletes[0]?.payload.name, skill.name);
  assert.equal(pendingDeletes[0]?.payload.updatedAt, deleteInputs[1]?.input.updatedAt);
});

test('KnowledgeStore deterministically converges equal-version same-name Skill snapshots', (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-07-19T03:00:00.000Z');
  kkWebApiClient.upsertAgentSkill = (() => new Promise<any>(() => {})) as typeof kkWebApiClient.upsertAgentSkill;
  t.after(() => {
    Date.now = originalNow;
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
  });

  const storageKey = 'test-equal-version-skill-convergence';
  const ownerId = 'user-equal-version-convergence';
  const firstStorage = createMemoryStorage();
  const secondStorage = createMemoryStorage();
  const first = new KnowledgeStore(storageKey, firstStorage, () => ownerId).upsertSkill({
    name: 'same-version-logical-skill',
    trigger: 'first isolated tab',
    tools: ['knowledge.searchProject'],
    steps: ['first'],
  });
  const second = new KnowledgeStore(storageKey, secondStorage, () => ownerId).upsertSkill({
    name: 'same-version-logical-skill',
    trigger: 'second isolated tab',
    tools: ['knowledge.searchProject'],
    steps: ['second'],
  });
  assert.equal(first.updatedAt, second.updatedAt);
  assert.notEqual(first.id, second.id);

  const sharedStorage = createMemoryStorage();
  for (const source of [firstStorage, secondStorage]) {
    for (let index = 0; index < source.length; index += 1) {
      const key = source.key(index);
      if (key) sharedStorage.setItem(key, source.getItem(key));
    }
  }
  const firstReload = new KnowledgeStore(storageKey, sharedStorage, () => ownerId).listSkills();
  const secondReload = new KnowledgeStore(storageKey, sharedStorage, () => ownerId).listSkills();
  assert.equal(firstReload.length, 1);
  assert.deepEqual(firstReload, secondReload);
});

test('KnowledgeStore consumes the authoritative Skill returned for an equal-version upsert', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.upsertAgentSkill = (async (record: any) => ({
    success: true,
    data: {
      ok: true,
      stale: true,
      data: {
        ...record,
        id: 'skill_server_authoritative',
        trigger: 'server authoritative content',
      },
    },
  } as any)) as typeof kkWebApiClient.upsertAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
  });

  const store = new KnowledgeStore(
    'test-authoritative-skill-response',
    createMemoryStorage(),
    () => 'user-authoritative-skill',
  );
  const requested = store.upsertSkill({
    name: 'authoritative-logical-skill',
    trigger: 'local competing content',
    tools: ['knowledge.searchProject'],
    steps: ['local'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const skills = store.listSkills();
  assert.equal(skills.length, 1);
  assert.equal(skills[0]?.id, 'skill_server_authoritative');
  assert.equal(skills[0]?.trigger, 'server authoritative content');
  assert.ok((skills[0]?.updatedAt || '') > requested.updatedAt);
});

test('KnowledgeStore applies an authoritative deletion returned for a stale Skill upsert', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.upsertAgentSkill = (async () => ({
    success: true,
    data: {
      ok: true,
      stale: true,
      authoritativeDeleted: true,
      authoritativeUpdatedAt: '2099-07-19T05:00:00.000Z',
    },
  } as any)) as typeof kkWebApiClient.upsertAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
  });

  const store = new KnowledgeStore(
    'test-stale-upsert-authoritative-delete',
    createMemoryStorage(),
    () => 'user-stale-upsert-delete',
  );
  const requested = store.upsertSkill({
    name: 'server-deleted-skill',
    trigger: 'must disappear after authoritative tombstone',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(store.listSkills().some((skill) => skill.id === requested.id), false);
  assert.equal(store.getPendingTasks().some((task) => task.type === 'upsert_skill'), false);
});

test('KnowledgeStore keeps a stale upsert pending when the server omits authoritative state', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.upsertAgentSkill = (async () => ({
    success: true,
    data: { ok: true, stale: true },
  } as any)) as typeof kkWebApiClient.upsertAgentSkill;
  t.after(() => {
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
  });

  const store = new KnowledgeStore(
    'test-stale-upsert-missing-authority',
    createMemoryStorage(),
    () => 'user-stale-upsert-missing-authority',
  );
  const requested = store.upsertSkill({
    name: 'unresolved-stale-skill',
    trigger: 'must remain pending without server state',
    tools: ['knowledge.searchProject'],
    steps: ['read'],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const pending = store.getPendingTasks().filter((task) => task.type === 'upsert_skill');
  assert.equal(store.listSkills().some((skill) => skill.id === requested.id), true);
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.payload.id, requested.id);
});

test('KnowledgeStore lets a newer authoritative Skill supersede an in-flight local deletion', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-07-19T06:00:00.000Z');
  let releaseUpsert!: (response: any) => void;
  kkWebApiClient.upsertAgentSkill = (() => new Promise<any>((resolve) => {
    releaseUpsert = resolve;
  })) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (() => new Promise<any>(() => {})) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    Date.now = originalNow;
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const store = new KnowledgeStore(
    'test-authoritative-skill-newer-than-local-delete',
    createMemoryStorage(),
    () => 'user-authoritative-newer-skill',
  );
  const requested = store.upsertSkill({
    name: 'server-newer-than-delete',
    trigger: 'request v1',
    tools: ['knowledge.searchProject'],
    steps: ['v1'],
  });
  store.deleteSkill(requested.id);
  assert.equal(store.listSkills().length, 0);

  releaseUpsert({
    success: true,
    data: {
      ok: true,
      stale: true,
      authoritativeDeleted: false,
      authoritativeUpdatedAt: '2026-07-19T06:00:00.010Z',
      data: {
        ...requested,
        id: 'skill_server_v3',
        trigger: 'server v3',
        steps: ['v3'],
        updatedAt: '2026-07-19T06:00:00.010Z',
      },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const visible = store.listSkills();
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, 'skill_server_v3');
  assert.equal(visible[0]?.trigger, 'server v3');
});

test('KnowledgeStore applies a newer authoritative Skill returned for a stale delete', async (t) => {
  const originalUpsertAgentSkill = kkWebApiClient.upsertAgentSkill;
  const originalDeleteAgentSkill = kkWebApiClient.deleteAgentSkill;
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-07-19T07:00:00.000Z');
  let requestedRecord: any;
  kkWebApiClient.upsertAgentSkill = (async (record: any) => {
    requestedRecord = record;
    return { success: true, data: { ok: true, data: record } } as any;
  }) as typeof kkWebApiClient.upsertAgentSkill;
  kkWebApiClient.deleteAgentSkill = (async () => ({
    success: true,
    data: {
      ok: true,
      stale: true,
      authoritativeDeleted: false,
      authoritativeUpdatedAt: '2026-07-19T07:00:00.010Z',
      data: {
        ...requestedRecord,
        id: 'skill_server_after_stale_delete',
        trigger: 'server update newer than delete',
        updatedAt: '2026-07-19T07:00:00.010Z',
      },
    },
  } as any)) as typeof kkWebApiClient.deleteAgentSkill;
  t.after(() => {
    Date.now = originalNow;
    kkWebApiClient.upsertAgentSkill = originalUpsertAgentSkill;
    kkWebApiClient.deleteAgentSkill = originalDeleteAgentSkill;
  });

  const store = new KnowledgeStore(
    'test-stale-delete-authoritative-skill',
    createMemoryStorage(),
    () => 'user-stale-delete-authority',
  );
  const local = store.upsertSkill({
    name: 'delete-loses-to-server-update',
    trigger: 'local version',
    tools: ['knowledge.searchProject'],
    steps: ['local'],
  });
  store.deleteSkill(local.id);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const visible = store.listSkills();
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, 'skill_server_after_stale_delete');
  assert.equal(visible[0]?.trigger, 'server update newer than delete');
  assert.equal(store.getPendingTasks().some((task) => task.type === 'delete_skill'), false);
});
