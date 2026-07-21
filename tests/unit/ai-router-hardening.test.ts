import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { isPrivateHost, fetchWithRetries } from '../../services/api/lib/fetchClient.js';
import localUserRouteStore from '../../services/api/lib/dispatcher/localUserRouteStore.js';
import metricsCollector from '../../services/api/lib/dispatcher/metricsCollector.js';

describe('AI Router Hardening Tests', () => {
  test('isPrivateHost SSRF 防御拦截校验', () => {
    assert.strictEqual(isPrivateHost('localhost'), true);
    assert.strictEqual(isPrivateHost('127.0.0.1'), true);
    assert.strictEqual(isPrivateHost('10.0.0.1'), true);
    assert.strictEqual(isPrivateHost('192.168.1.100'), true);
    assert.strictEqual(isPrivateHost('172.20.10.2'), true);
    assert.strictEqual(isPrivateHost('::1'), true);
    assert.strictEqual(isPrivateHost('[::1]'), true);
    assert.strictEqual(isPrivateHost('fe80::1'), true);

    // 公网域名/IP 应允许通过
    assert.strictEqual(isPrivateHost('api.openai.com'), false);
    assert.strictEqual(isPrivateHost('8.8.8.8'), false);
    assert.strictEqual(isPrivateHost('api.wuyinkeji.com'), false);
  });

  test('localUserRouteStore 异步读写及 Map O(1) 索引定位', async () => {
    const rawData = await localUserRouteStore.readLocalStorage();
    assert.ok(rawData !== null);
    assert.ok(typeof rawData === 'object');

    // 模拟构造 profile 并写入
    const mockProfile = {
      version: 2,
      slots: [
        {
          id: 'test_slot_1',
          name: '测试通道',
          baseUrl: 'https://api.openai.com',
          key: 'sk-test-key-123',
          supportedModels: ['gpt-4o'],
        }
      ],
      providers: [],
      entries: []
    };

    const userId = 'temp-test-user-999';
    const originalProfiles = { ...rawData.profiles };
    
    // 写入测试
    rawData.profiles[userId] = mockProfile;
    await localUserRouteStore.writeLocalStorage(rawData);

    // 重新读取并以 Map 检索路由
    const route = await localUserRouteStore.resolveLocalUserRoute(userId, 'test_slot_1');
    assert.ok(route !== null);
    assert.strictEqual(route.id, 'test_slot_1');
    assert.strictEqual(route.apiKey, 'sk-test-key-123');
    assert.strictEqual(route.baseUrl, 'https://api.openai.com');

    // 校验前缀兼容性
    const routeWithPrefix = await localUserRouteStore.resolveLocalUserRoute(userId, 'slot_test_slot_1');
    assert.ok(routeWithPrefix !== null);
    assert.strictEqual(routeWithPrefix.apiKey, 'sk-test-key-123');

    // 清理测试数据
    delete rawData.profiles[userId];
    await localUserRouteStore.writeLocalStorage(rawData);
  });

  test('fetchWithRetries 自动指数退避与 Retry-After 头部处理', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    
    // mock 全局 fetch
    globalThis.fetch = async (url, options) => {
      callCount++;
      if (callCount === 1) {
        // 第一次返回 429 并带 Retry-After 0.1 秒
        return new Response('Too Many Requests', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({
            'retry-after': '0.1',
          }),
        });
      }
      // 第二次返回成功
      return new Response(JSON.stringify({ content: '成功通过重试' }), {
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
        }),
      });
    };
    
    try {
      const res = await fetchWithRetries('https://api.openai.com/v1/chat/completions', {
        maxRetries: 2,
        timeout: 1000,
      });
      assert.strictEqual(callCount, 2);
      const json = await res.json();
      assert.strictEqual(json.content, '成功通过重试');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fetchWithRetries 大小限制 10 字节报错', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      return new Response('超出了限制大小的内容', {
        status: 200,
        headers: new Headers({
          'content-type': 'text/plain',
        }),
      });
    };
    
    try {
      await assert.rejects(
        fetchWithRetries('https://api.openai.com/v1/chat/completions', {
          maxRetries: 0,
          limitBytes: 10,
        }),
        /limit exceeded/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('metricsCollector 数据统计指标收集', () => {
    metricsCollector.reset();

    metricsCollector.recordRequest({ modelId: 'gpt-4o', providerId: 'openai', success: true, latency: 100 });
    metricsCollector.recordRequest({ modelId: 'gpt-4o', providerId: 'openai', success: true, latency: 200 });
    metricsCollector.recordRequest({ modelId: 'gpt-4o', providerId: 'openai', success: false, latency: 150 });
    metricsCollector.recordRequest({ modelId: 'claude-3-5', providerId: 'anthropic', success: true, latency: 300 });

    const metrics = metricsCollector.getMetrics();
    
    assert.strictEqual(metrics.global.totalRequests, 4);
    assert.strictEqual(metrics.global.successRequests, 3);
    assert.strictEqual(metrics.global.failedRequests, 1);
    assert.strictEqual(metrics.global.successRate, 0.75);
    assert.strictEqual(metrics.global.averageLatencyMs, 188);

    assert.ok(metrics.models['gpt-4o']);
    assert.strictEqual(metrics.models['gpt-4o'].total, 3);
    assert.strictEqual(metrics.models['gpt-4o'].success, 2);
    assert.strictEqual(metrics.models['gpt-4o'].failed, 1);
    assert.strictEqual(metrics.models['gpt-4o'].successRate, parseFloat((2/3).toFixed(4)));

    assert.ok(metrics.providers['openai']);
    assert.strictEqual(metrics.providers['openai'].total, 3);
  });

  test('自带 Key 路由熔断状态置换逻辑 (invalid / rate_limited)', async () => {
    const rawData = await localUserRouteStore.readLocalStorage();
    const userId = 'temp-test-user-circuit-breaker';
    
    const mockProfile = {
      version: 2,
      slots: [
        {
          id: 'test_slot_cb',
          name: '熔断测试通道',
          baseUrl: 'https://api.openai.com',
          key: 'sk-test-cb',
          supportedModels: ['gpt-4o'],
          status: 'active'
        }
      ],
      providers: [],
      entries: []
    };
    
    rawData.profiles[userId] = mockProfile;
    await localUserRouteStore.writeLocalStorage(rawData);

    let profile = localUserRouteStore.readProfileState(rawData, userId);
    let slot = profile.slots.find(s => s.id === 'test_slot_cb');
    assert.ok(slot);
    
    slot.status = 'invalid';
    slot.updatedAt = Date.now();
    localUserRouteStore.writeProfileState(rawData, userId, profile);
    await localUserRouteStore.writeLocalStorage(rawData);

    const freshData = await localUserRouteStore.readLocalStorage();
    const freshProfile = localUserRouteStore.readProfileState(freshData, userId);
    const freshSlot = freshProfile.slots.find(s => s.id === 'test_slot_cb');
    assert.strictEqual(freshSlot.status, 'invalid');

    delete freshData.profiles[userId];
    await localUserRouteStore.writeLocalStorage(freshData);
  });
});
