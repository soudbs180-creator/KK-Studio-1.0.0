import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createKkApiClient } from '../../packages/shared/src/index.ts';
import { readSource } from '../support/workspacePaths.js';

const catalogItem = {
  id: 'image_nanoBanana2',
  name: 'NanoBanana2',
  displayName: 'NanoBanana2',
  categoryName: '图片模型',
  kind: 'image' as const,
  executionMode: 'async-detail' as const,
  endpointPath: '/api/async/image_nanoBanana2',
  endpointUrl: 'https://api.wuyinkeji.com/api/async/image_nanoBanana2',
  method: 'POST' as const,
  contentType: 'application/json',
  submitContentType: 'application/json' as const,
  aliases: ['image_nanoBanana2', 'NanoBanana2'],
  enabled: true,
  lastCrawledAt: '2026-07-13T00:00:00.000Z',
};

function createCatalogClient(source: 'cache' | 'remote' | 'fallback' = 'cache') {
  const requests: Array<{ url: string; method: string }> = [];
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: String(init?.method || 'GET'),
      });
      return new Response(JSON.stringify({
        success: true,
        data: [catalogItem],
        source,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });

  return { client, requests };
}

function collectSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.resolve(relativeDir);
  const files: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(path.relative(process.cwd(), absolutePath)));
      continue;
    }
    if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

test('KkApiClient reads and normalizes the cached Wuyin catalog', async () => {
  const { client, requests } = createCatalogClient('cache');

  const result = await client.getWuyinCatalog();

  assert.deepEqual(requests, [{
    url: 'https://api.example.test/api/v1/wuyin/catalog',
    method: 'GET',
  }]);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.source, 'cache');
    assert.deepEqual(result.data.items, [catalogItem]);
  }
});

test('KkApiClient refreshes the Wuyin catalog through the documented POST route', async () => {
  const { client, requests } = createCatalogClient('remote');

  const result = await client.refreshWuyinCatalog();

  assert.deepEqual(requests, [{
    url: 'https://api.example.test/api/v1/wuyin/catalog/refresh',
    method: 'POST',
  }]);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.source, 'remote');
    assert.equal(result.data.items.length, 1);
  }
});

test('KkApiClient rejects malformed Wuyin catalog payloads with a standard client error', async () => {
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: (async () => new Response(JSON.stringify({
      success: true,
      data: { unexpected: true },
      source: 'cache',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch,
  });

  const result = await client.getWuyinCatalog();

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'INVALID_RESPONSE_PAYLOAD');
  }
});

test('KkApiClient rejects catalog items outside the shared Wuyin capability contract', async () => {
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: (async () => new Response(JSON.stringify({
      success: true,
      data: [{ ...catalogItem, kind: 'spreadsheet' }],
      source: 'cache',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch,
  });

  const result = await client.getWuyinCatalog();

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'INVALID_RESPONSE_PAYLOAD');
  }
});

test('ApiSettingsView uses typed Wuyin catalog client methods instead of direct fetch', () => {
  const source = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /kkWebApiClient\.getWuyinCatalog\(/);
  assert.match(source, /kkWebApiClient\.refreshWuyinCatalog\(/);
  assert.doesNotMatch(source, /fetch\(['"]\/api\/v1\/wuyin\/catalog/);
});

test('active Web source has no implementation of the nonexistent auth signin endpoint', () => {
  const activeSources = collectSourceFiles('apps/web/src');
  const offenders = activeSources
    .filter((file) => readFileSync(file, 'utf8').includes('/api/auth/signin'))
    .map((file) => path.relative(process.cwd(), file).split(path.sep).join('/'));

  assert.deepEqual(offenders, []);
  assert.equal(existsSync(path.resolve('apps/web/src/shims/authCreateReact.tsx')), false);
  assert.equal(existsSync(path.resolve('apps/web/src/utils/useAuth.js')), false);
});
