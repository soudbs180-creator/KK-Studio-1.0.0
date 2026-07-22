import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiResponse, AssetDto, CreateAssetRequestDto } from '@kk/shared';
import {
  resolveCanonicalChatAssets,
  type ChatAssetApi,
} from '../../apps/web/src/components/layout/chat-sidebar/session/chatCanonicalAssetResolver.ts';
import type { Message } from '../../apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts';
import { readSource } from '../support/workspacePaths.js';

const timestamp = Date.parse('2026-07-22T09:00:00.000Z');
const pngDataUrl = 'data:image/png;base64,aGVsbG8=';

const response = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
  meta: { requestId: 'request-1', timestamp: '2026-07-22T09:00:00.000Z' },
});

const asset = (overrides: Partial<AssetDto> = {}): AssetDto => ({
  id: 'asset-canonical-1',
  kind: 'image',
  storagePath: '/api/v1/assets/asset-canonical-1/content',
  mimeType: 'image/png',
  sizeBytes: 5,
  metadata: {},
  createdAt: '2026-07-22T09:00:00.000Z',
  ...overrides,
});

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'message-1',
  role: 'user',
  content: 'Use this image',
  timestamp,
  attachments: [{
    id: 'attachment-local-1',
    type: 'image',
    name: 'reference.png',
    data: pngDataUrl,
    mimeType: 'image/png',
    size: 5,
  }],
  ...overrides,
});

test('canonical resolver uploads bounded data through the typed owner-scoped Asset API', async () => {
  const createInputs: CreateAssetRequestDto[] = [];
  const api: ChatAssetApi = {
    async listAssets() { return response({ items: [] }); },
    async createAsset(input) {
      createInputs.push(input);
      return response({
        asset: asset({ id: input.id, metadata: input.metadata }),
        url: `/api/v1/assets/${input.id}/content`,
      });
    },
  };
  const result = await resolveCanonicalChatAssets([message()], {
    api,
    ownerId: 'owner-a',
    getOwnerId: () => 'owner-a',
    approvedDocumentAttachmentIds: new Set(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(createInputs.length, 1);
  assert.equal(result.canonicalAssetIds['attachment-local-1'], createInputs[0].id);
  assert.match(String(createInputs[0].id), /^chat_[a-f0-9]{64}$/);
  assert.equal(createInputs[0].dataUrl, pngDataUrl);
  assert.equal(createInputs[0].metadata?.source, 'chat-attachment');
  assert.match(String(createInputs[0].metadata?.contentSha256), /^[a-f0-9]{64}$/);
  assert.equal('ownerId' in createInputs[0], false);
});

test('canonical resolver reuses an owner-visible content hash without uploading again', async () => {
  let createCount = 0;
  let storedAsset: AssetDto | undefined;
  const api: ChatAssetApi = {
    async listAssets() { return response({ items: storedAsset ? [storedAsset] : [] }); },
    async createAsset(input) {
      createCount += 1;
      storedAsset = asset({ id: input.id, metadata: input.metadata });
      return response({ asset: storedAsset, url: storedAsset.storagePath });
    },
  };
  const context = {
    api, ownerId: 'owner-a', getOwnerId: () => 'owner-a',
    approvedDocumentAttachmentIds: new Set<string>(),
  };

  assert.equal((await resolveCanonicalChatAssets([message()], context)).ok, true);
  assert.equal((await resolveCanonicalChatAssets([message()], context)).ok, true);
  assert.equal(createCount, 1);
});

test('canonical resolver rejects unsafe attachment payloads before any network mutation', async () => {
  let calls = 0;
  const api: ChatAssetApi = {
    async listAssets() { calls += 1; return response({ items: [] }); },
    async createAsset() { calls += 1; return response({ asset: asset(), url: 'unused' }); },
  };
  const context = {
    api, ownerId: 'owner-a', getOwnerId: () => 'owner-a',
    approvedDocumentAttachmentIds: new Set<string>(),
  };
  const urlAttachment = message({
    attachments: [{ id: 'url-1', type: 'url', name: 'site', data: 'https://example.com' }],
  });
  const documentAttachment = message({
    attachments: [{
      id: 'doc-1', type: 'document', name: 'brief.txt',
      data: 'data:text/plain;base64,aGVsbG8=', mimeType: 'text/plain',
    }],
  });

  assert.deepEqual(await resolveCanonicalChatAssets([urlAttachment], context), {
    ok: false, reason: 'unsupported_attachment',
  });
  assert.deepEqual(await resolveCanonicalChatAssets([documentAttachment], context), {
    ok: false, reason: 'document_approval_required',
  });
  assert.equal(calls, 0);
});

test('canonical resolver discards an upload response after the authenticated owner changes', async () => {
  let currentOwner = 'owner-a';
  const api: ChatAssetApi = {
    async listAssets() { return response({ items: [] }); },
    async createAsset() {
      currentOwner = 'owner-b';
      return response({ asset: asset(), url: '/api/v1/assets/asset-canonical-1/content' });
    },
  };
  const result = await resolveCanonicalChatAssets([message()], {
    api,
    ownerId: 'owner-a',
    getOwnerId: () => currentOwner,
    approvedDocumentAttachmentIds: new Set(),
  });

  assert.deepEqual(result, { ok: false, reason: 'owner_changed' });
});

test('canonical resolver rejects malformed Asset API envelopes and MIME mismatches', async () => {
  const malformedApi: ChatAssetApi = {
    async listAssets() { return response({ items: [{ id: 'forged' }] }) as ApiResponse<never>; },
    async createAsset() { throw new Error('must not upload'); },
  };
  const mismatchApi: ChatAssetApi = {
    async listAssets() { return response({ items: [] }); },
    async createAsset() {
      return response({ asset: asset({ mimeType: 'image/jpeg' }), url: 'unused' });
    },
  };
  const base = { ownerId: 'owner-a', getOwnerId: () => 'owner-a', approvedDocumentAttachmentIds: new Set<string>() };

  assert.deepEqual(await resolveCanonicalChatAssets([message()], { ...base, api: malformedApi }), {
    ok: false, reason: 'invalid_asset_response',
  });
  assert.deepEqual(await resolveCanonicalChatAssets([message()], { ...base, api: mismatchApi }), {
    ok: false, reason: 'invalid_asset_response',
  });
});

test('Asset API keeps content-addressed ids and payloads inside the authenticated owner store', () => {
  const route = readSource('services/api/routes/compat/workspace.js');
  const server = readSource('services/api/index.js');

  assert.match(route, /ensureProfileStore\(store, req\.userId\)/);
  assert.match(route, /normalizeAssetId\(req\.body\?\.id, req\.userId, parsed\.base64\)/);
  assert.match(route, /metadata: isObjectRecord\(req\.body\?\.metadata\)/);
  assert.match(route, /profileStore\.assets\.findIndex\(\(item\) => item\.id === assetId\)/);
  assert.match(server, /app\.use\('\/api\/v1\/assets', express\.json\(\{ limit: '10mb'/);
});
