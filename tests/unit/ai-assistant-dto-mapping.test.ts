import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  mapAgentRunRow,
  mapAgentToolCallRow,
  mapKnowledgeDocumentRow,
  mapAgentSkillRow,
} = require('../../services/api/lib/ai-assistant-dto.js');

test('AI assistant database rows are mapped to the public camelCase DTO contract', () => {
  assert.deepEqual(mapAgentRunRow({
    id: 'run-1',
    user_message: 'hello',
    intent: 'help',
    plan: { id: 'plan-1' },
    status: 'completed',
    step_results: [{ stepId: 'step-1', outcome: 'success' }],
    created_at: '2026-07-15T00:00:00.000Z',
    updated_at: '2026-07-15T00:00:01.000Z',
  }), {
    id: 'run-1',
    userMessage: 'hello',
    intent: 'help',
    plan: { id: 'plan-1' },
    status: 'completed',
    toolCalls: [],
    stepResults: [{ stepId: 'step-1', outcome: 'success' }],
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:01.000Z',
  });

  assert.deepEqual(mapAgentToolCallRow({
    id: 'tool-1', run_id: 'run-1', step_id: 'step-1', tool_name: 'canvas.getState',
    input_summary: '{}', output_summary: '{"ok":true}', status: 'success', outcome: 'success',
    failure_class: null, error_code: null, retryable: false, error: null,
    started_at: '2026-07-15T00:00:00.000Z', completed_at: '2026-07-15T00:00:01.000Z', idempotency_key: 'key-1',
  }), {
    id: 'tool-1', runId: 'run-1', stepId: 'step-1', toolName: 'canvas.getState',
    inputSummary: '{}', outputSummary: '{"ok":true}', status: 'success', outcome: 'success',
    retryable: false, startedAt: '2026-07-15T00:00:00.000Z', completedAt: '2026-07-15T00:00:01.000Z', idempotencyKey: 'key-1',
  });

  assert.deepEqual(mapKnowledgeDocumentRow({
    id: 'doc-1', user_id: 'user-1', owner_scope: 'user', source: 'runtime', path: 'docs/a.md',
    title: 'Scoped', summary: 'Private', content_hash: 'hash-1', updated_at: '2026-07-15T00:00:00.000Z',
  }), {
    id: 'doc-1', userId: 'user-1', ownerScope: 'user', source: 'runtime', path: 'docs/a.md',
    title: 'Scoped', summary: 'Private', contentHash: 'hash-1', updatedAt: '2026-07-15T00:00:00.000Z',
  });

  assert.deepEqual(mapAgentSkillRow({
    id: 'skill-1', user_id: 'user-1', owner_scope: 'user', name: 'skill', trigger_text: 'when needed',
    tools: ['canvas.getState'], steps: ['read'], safety: [], validation: [], knowledge_updates: [],
    created_at: '2026-07-15T00:00:00.000Z', updated_at: '2026-07-15T00:00:01.000Z',
  }), {
    id: 'skill-1', userId: 'user-1', ownerScope: 'user', name: 'skill', trigger: 'when needed',
    tools: ['canvas.getState'], steps: ['read'], safety: [], validation: [], knowledgeUpdates: [],
    createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:01.000Z',
  });
});
