import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

const ROOT_DIR = process.cwd();
const LOCAL_STORE_PATH = path.resolve(ROOT_DIR, 'server/.kk-local/contract-compat.json');
const TEMP_USER_HEADER = 'x-kk-temp-user-id';
const TEMP_USER_ID = 'temp-asset-sync-test';
const require = createRequire(import.meta.url);

async function httpRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer; json: () => Promise<any>; arrayBuffer: () => Promise<ArrayBuffer> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const request = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || 'GET',
      headers: options.headers,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: response.statusCode || 0,
          headers: response.headers,
          body,
          json: async () => JSON.parse(body.toString('utf8')),
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        });
      });
    });
    request.on('error', reject);
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

describe('workspace cloud asset sync contract', () => {
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    KKAI_LOCAL_ONLY: process.env.KKAI_LOCAL_ONLY,
    NODE_ENV: process.env.NODE_ENV,
    PASSWORD_SALT: process.env.PASSWORD_SALT,
  };

  let server: any;
  let baseUrl = '';
  let originalStore: string | null = null;

  before(async () => {
    try {
      originalStore = await fs.readFile(LOCAL_STORE_PATH, 'utf8');
    } catch {
      originalStore = null;
    }

    for (const key of Object.keys(require.cache)) {
      if (key.includes(`${path.sep}server${path.sep}`)) {
        delete require.cache[key];
      }
    }

    process.env.NODE_ENV = 'test';
    process.env.KKAI_LOCAL_ONLY = 'true';
    process.env.JWT_SECRET = 'asset-sync-test-secret';
    process.env.PASSWORD_SALT = 'asset-sync-test-salt';
    delete process.env.DATABASE_URL;

    const { createApp } = require('../../server/index.js');
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    if (originalStore !== null) {
      await fs.mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
      await fs.writeFile(LOCAL_STORE_PATH, originalStore, 'utf8');
    } else {
      try {
        await fs.unlink(LOCAL_STORE_PATH);
      } catch {}
    }

    for (const [key, value] of Object.entries(previousEnv)) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test('VPS compat assets route creates, lists, and serves uploaded image assets', async () => {
    const createResponse = await httpRequest(`${baseUrl}/api/v1/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [TEMP_USER_HEADER]: TEMP_USER_ID,
      },
      body: JSON.stringify({
        id: 'asset-sync-original',
        kind: 'image',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,aGVsbG8=',
        metadata: {
          pairId: 'asset-sync-pair',
          role: 'original',
        },
      }),
    });

    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as any;
    assert.equal(created.success, true);
    assert.equal(created.data.asset.id, 'asset-sync-original');
    assert.equal(created.data.asset.kind, 'image');
    assert.equal(created.data.asset.mimeType, 'image/png');
    assert.equal(created.data.asset.storagePath, '/api/v1/assets/asset-sync-original/content');
    assert.equal(created.data.asset.metadata.role, 'original');
    assert.equal(created.data.url, '/api/v1/assets/asset-sync-original/content');

    const listResponse = await httpRequest(`${baseUrl}/api/v1/assets?kind=image`, {
      headers: { [TEMP_USER_HEADER]: TEMP_USER_ID },
    });
    assert.equal(listResponse.status, 200);
    const listed = await listResponse.json() as any;
    assert.equal(listed.success, true);
    assert.ok(
      listed.data.items.some((item: any) => item.id === 'asset-sync-original' && !('contentBase64' in item)),
      'asset list must include metadata without leaking raw base64 content',
    );

    const contentResponse = await httpRequest(`${baseUrl}/api/v1/assets/asset-sync-original/content`, {
      headers: { [TEMP_USER_HEADER]: TEMP_USER_ID },
    });
    assert.equal(contentResponse.status, 200);
    assert.equal(contentResponse.headers['content-type'], 'image/png');
    assert.equal(Buffer.from(await contentResponse.arrayBuffer()).toString('utf8'), 'hello');
  });

  test('shared client and sync service use a real asset upload path instead of disabled cloud sync', () => {
    const clientSource = readSource('packages/shared/src/contracts/client/kk-api-client.ts');
    const generationRuntimeSource = readSource('apps/web/src/app/useGenerationRuntime.ts');
    const syncServiceSource = readSource('apps/web/src/services/system/syncService.ts');
    const serverSource = readSource('server/index.js');

    assert.match(clientSource, /createAsset\(/);
    assert.match(clientSource, /api\/v1\/assets/);
    assert.match(generationRuntimeSource, /shouldEnableWorkspaceCloudSync\(\)/);
    assert.match(syncServiceSource, /kkWebApiClient\.createAsset/);
    assert.match(syncServiceSource, /blobToDataUrl/);
    assert.match(serverSource, /app\.use\('\/api\/v1\/assets', express\.json\(\{ limit: '10mb'/);
    assert.doesNotMatch(syncServiceSource, /Cloud image sync is disabled until server-backed asset upload is implemented/);
  });

  test('cloud image cleanup removes unreferenced uploaded assets while preserving layout references', async () => {
    const cleanupUserId = `${TEMP_USER_ID}-cleanup`;
    const createAsset = async (id: string) => {
      const response = await httpRequest(`${baseUrl}/api/v1/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [TEMP_USER_HEADER]: cleanupUserId,
        },
        body: JSON.stringify({
          id,
          kind: 'image',
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,aGVsbG8=',
        }),
      });
      assert.equal(response.status, 201);
    };

    await createAsset('cleanup-keep');
    await createAsset('cleanup-delete');

    const saveLayoutResponse = await httpRequest(`${baseUrl}/api/v1/workspaces/layout`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        [TEMP_USER_HEADER]: cleanupUserId,
      },
      body: JSON.stringify({
        canvases: [{
          id: 'cleanup-canvas',
          name: 'Cleanup Canvas',
          promptNodes: [],
          imageNodes: [{
            id: 'cleanup-image-node',
            url: '/api/v1/assets/cleanup-keep/content',
            originalUrl: '/api/v1/assets/cleanup-keep/content',
            storageId: 'cleanup-keep',
            position: { x: 0, y: 0 },
            timestamp: Date.now(),
          }],
          groups: [],
          drawings: [],
          lastModified: Date.now(),
        }],
      }),
    });
    assert.equal(saveLayoutResponse.status, 200);

    const cleanupResponse = await httpRequest(`${baseUrl}/api/v1/workspaces/layout/cloud-images`, {
      method: 'DELETE',
      headers: { [TEMP_USER_HEADER]: cleanupUserId },
    });
    assert.equal(cleanupResponse.status, 200);
    const cleanupPayload = await cleanupResponse.json() as any;
    assert.equal(cleanupPayload.success, true);
    assert.equal(cleanupPayload.data.deletedCount, 1);
    assert.equal(cleanupPayload.data.preservedLayout, true);

    const listResponse = await httpRequest(`${baseUrl}/api/v1/assets?kind=image`, {
      headers: { [TEMP_USER_HEADER]: cleanupUserId },
    });
    const listPayload = await listResponse.json() as any;
    const ids = listPayload.data.items.map((item: any) => item.id);
    assert.ok(ids.includes('cleanup-keep'));
    assert.ok(!ids.includes('cleanup-delete'));

    const layoutResponse = await httpRequest(`${baseUrl}/api/v1/workspaces/layout`, {
      headers: { [TEMP_USER_HEADER]: cleanupUserId },
    });
    const layoutPayload = await layoutResponse.json() as any;
    assert.equal(layoutPayload.data.canvases[0].imageNodes[0].id, 'cleanup-image-node');
  });
});
