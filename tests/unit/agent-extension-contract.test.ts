import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  AgentExtensionListDtoSchema,
  createKkApiClient,
  UpsertAgentExtensionRequestSchema,
} from '../../packages/shared/src/index.ts';

const EXTENSION_ID = '11111111-1111-4111-8111-111111111111';

test('agent extension writes accept only typed owner-safe manifests and opaque secret references', () => {
  const request = UpsertAgentExtensionRequestSchema.parse({
    id: EXTENSION_ID,
    type: 'mcp',
    manifest: {
      schemaVersion: 1,
      key: 'docs-mcp',
      displayName: 'Docs MCP',
      description: 'Read documentation through an approved MCP server.',
      permissions: ['documents:read'],
      secretRef: 'vault://agent-extensions/docs-mcp',
      configuration: { transport: 'stdio' },
    },
    enabled: true,
  });

  assert.equal(request.type, 'mcp');
  assert.equal(UpsertAgentExtensionRequestSchema.safeParse({
    ...request,
    manifest: { ...request.manifest, secretRef: 'plain-secret-value' },
  }).success, false);
});

test('agent extension list is bounded and keeps extension types explicit', () => {
  const parsed = AgentExtensionListDtoSchema.parse([{
    id: EXTENSION_ID,
    type: 'plugin',
    manifest: {
      schemaVersion: 1,
      key: 'review-plugin',
      displayName: 'Review Plugin',
      permissions: ['repository:read'],
    },
    enabled: false,
    importSource: 'user',
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  }]);

  assert.equal(parsed[0]?.type, 'plugin');
});

test('agent extension client uses the canonical v1 collection without leaking secret values', async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        method: String(init?.method || 'GET'),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify({ success: true, data: [], meta: {} }), {
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await client.listAgentExtensions('mcp');
  await client.upsertAgentExtension({
    id: EXTENSION_ID,
    type: 'mcp',
    enabled: true,
    manifest: {
      schemaVersion: 1,
      key: 'docs-mcp',
      displayName: 'Docs MCP',
      permissions: ['documents:read'],
      secretRef: 'vault://agent-extensions/docs-mcp',
    },
  });
  await client.deleteAgentExtension(EXTENSION_ID);

  assert.deepEqual(calls.map(({ url, method }) => ({ url, method })), [
    { url: 'https://api.example.test/api/v1/agent-extensions?type=mcp', method: 'GET' },
    { url: `https://api.example.test/api/v1/agent-extensions/${EXTENSION_ID}`, method: 'PUT' },
    { url: `https://api.example.test/api/v1/agent-extensions/${EXTENSION_ID}`, method: 'DELETE' },
  ]);
  assert.doesNotMatch(JSON.stringify(calls[1]?.body), /plain-secret-value/);
});

test('server and client expose the owner-scoped agent extension boundary', () => {
  const apiRouter = fs.readFileSync('services/api/routes/api.js', 'utf8');
  const routeSource = fs.readFileSync('services/api/routes/agent-extensions.js', 'utf8');
  const clientSource = fs.readFileSync('packages/shared/src/contracts/client/kk-api-client.ts', 'utf8');
  const settingsSource = fs.readFileSync('apps/web/src/components/settings/AgentExtensionsSection.tsx', 'utf8');
  const settingsStyles = fs.readFileSync('apps/web/src/styles/settings-ui-v4.css', 'utf8');

  assert.match(apiRouter, /agent-extensions/);
  assert.match(routeSource, /verifyJWT/);
  assert.match(routeSource, /user_id\s*=\s*\$\d/);
  assert.match(routeSource, /UpsertAgentExtensionRequestSchema/);
  assert.match(clientSource, /listAgentExtensions/);
  assert.match(clientSource, /upsertAgentExtension/);
  assert.match(clientSource, /deleteAgentExtension/);
  assert.match(settingsSource, /EXTENSION_TYPES:[^\n]*\['skill', 'mcp', 'plugin'\]/);
  assert.match(settingsSource, /vault:\/\//);
  assert.match(settingsSource, /SettingSwitchControl/);
  assert.match(settingsStyles, /\.settings-agent-extension-tabs/);
});
