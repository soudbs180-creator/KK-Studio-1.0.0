import test from 'node:test';
import assert from 'node:assert/strict';

import { KnowledgeStore } from '../../apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts';

const createMemoryStorage = () => {
  let store: Record<string, string> = {};

  return {
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
    paths: ['apps/web/src/features/ai-takeover/core/toolRegistry.ts'],
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
