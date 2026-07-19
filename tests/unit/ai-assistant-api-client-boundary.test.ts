import assert from 'node:assert/strict';
import test from 'node:test';
import { createKkApiClient } from '../../packages/shared/src/index.ts';

test('KkApiClient exposes typed Agent Run, Tool Call, Knowledge and Skill methods', async () => {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: String(init?.method || 'GET'),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });

  for (const methodName of [
    'upsertAgentRun',
    'recordAgentToolCall',
    'recordKnowledgeChange',
    'searchAgentKnowledge',
    'upsertAgentSkill',
    'deleteAgentSkill',
  ] as const) {
    assert.equal(typeof (client as any)[methodName], 'function', `missing ${methodName}`);
  }

  await (client as any).upsertAgentRun({
    id: 'run-1', userMessage: 'test', intent: 'help', plan: {}, status: 'completed', toolCalls: [], createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
  });
  await (client as any).recordAgentToolCall({
    id: 'tool-1', runId: 'run-1', toolName: 'canvas.getState', inputSummary: '{}', status: 'success', startedAt: '2026-07-15T00:00:00.000Z',
  });
  await (client as any).recordKnowledgeChange({
    id: 'change-1', title: 'Scoped change', summary: 'Only the current user can update it.', source: 'runtime', paths: [],
  });
  await (client as any).searchAgentKnowledge({ query: 'scoped change' });
  await (client as any).upsertAgentSkill({
    id: 'skill-1', name: 'scoped-skill', trigger: 'test', tools: ['canvas.getState'], steps: ['read'], safety: [], validation: [], knowledgeUpdates: [], createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
  });
  await (client as any).deleteAgentSkill('skill/user scoped', {
    name: 'scoped-skill',
    updatedAt: '2026-07-15T00:00:01.000Z',
  });

  assert.deepEqual(requests.map(({ url, method }) => ({ url, method })), [
    { url: 'https://api.example.test/api/ai-assistant/runs', method: 'POST' },
    { url: 'https://api.example.test/api/ai-assistant/tool-calls', method: 'POST' },
    { url: 'https://api.example.test/api/ai-assistant/changes', method: 'POST' },
    { url: 'https://api.example.test/api/ai-assistant/knowledge?query=scoped+change', method: 'GET' },
    { url: 'https://api.example.test/api/ai-assistant/skills', method: 'POST' },
    { url: 'https://api.example.test/api/ai-assistant/skills/skill%2Fuser%20scoped', method: 'DELETE' },
  ]);
  assert.equal((requests[0].body as any).id, 'run-1');
  assert.equal((requests[4].body as any).name, 'scoped-skill');
  assert.equal((requests[5].body as any).updatedAt, '2026-07-15T00:00:01.000Z');
  assert.equal((requests[5].body as any).name, 'scoped-skill');
});
