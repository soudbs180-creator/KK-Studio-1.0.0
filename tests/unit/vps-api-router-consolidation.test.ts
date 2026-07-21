// tests/unit/vps-api-router-consolidation.test.ts
/**
 * @file vps-api-router-consolidation.test.ts
 * @description 单元测试：校验后端 API 网关合并收口后的路由正确分发与前向兼容性。
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { test, describe, before, after } from 'node:test';
import { fetch as nativeFetch } from 'undici';

const require = createRequire(import.meta.url);

describe('VPS API Router Consolidation and Unified Forwarding', () => {
  let server: any;
  let baseUrl: string;

  before(async () => {
    // 强制清理 index.js 缓存以重新加载修改后的路由挂载
    const indexModulePath = require.resolve('../../services/api/index.js');
    delete require.cache[indexModulePath];

    const { createApp } = require('../../services/api/index.js');
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      server.close();
    }
  });

  test('1. generateV1Router 代理分发 - /api/v1/generate 应当正常拦截 401', async () => {
    const res = await nativeFetch(`${baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] })
    });
    assert.equal(res.status, 401);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.code, 'UNAUTHORIZED');
  });

  test('2. userApiPayloadRouter 代理分发 - /api/v1/profile/key-manager 应当被拦截 401', async () => {
    const res = await nativeFetch(`${baseUrl}/api/v1/profile/key-manager`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 401);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('3. adminRouter 代理分发 - /api/admin/users 应当被拦截 401', async () => {
    const res = await nativeFetch(`${baseUrl}/api/admin/users`);
    assert.equal(res.status, 401);
    const body = await res.json() as any;
    assert.equal(body.error, 'Unauthorized.');
  });

  test('4. ocrRouter 代理分发 - /api/ocr 校验空 body 应当返回 400', async () => {
    const res = await nativeFetch(`${baseUrl}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.code, 'INVALID_PROVIDER');
  });

  test('5. aiAssistantRouter 代理分发 - /api/ai-assistant/runs 应当拦截 401', async () => {
    const res = await nativeFetch(`${baseUrl}/api/ai-assistant/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test' })
    });
    assert.equal(res.status, 401);
    const body = await res.json() as any;
    assert.equal(body.error, 'Unauthorized');
  });

  test('6. configRouter 代理分发 - /api/config/keys 应当成功返回 200 配置状态', async () => {
    const res = await nativeFetch(`${baseUrl}/api/config/keys`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok('ACTIVE_API_PROVIDER' in body);
    assert.ok('_configured' in body);
  });
});
