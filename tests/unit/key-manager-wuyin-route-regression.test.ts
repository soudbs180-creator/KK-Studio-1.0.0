import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../../api/user-model-proxy.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

test('KeyManager: Legacy Slot bypass and route debug contract regression', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  // Verify explicit route target check in legacy slot filtering to prevent deduplication drop
  assert.match(source, /const explicitRouteTarget = extractSlotRouteTarget\(normalizedSuffix\);/);
  assert.match(source, /if \(explicitRouteTarget && slotIdLower === explicitRouteTarget\) \{\s*return true;\s*\}/);

  // Verify routeTarget parsing in preferredKeyId matching
  assert.match(source, /const preferredRouteTarget = preferredSuffix\s*\?\s*extractSlotRouteTarget\(preferredSuffix\)\s*:\s*extractSlotRouteTarget\(normalizedPreferredKeyId\);/);
  assert.match(source, /const hasCompatIssue = !!getSlotModelCompatibilityIssue\(preferred\);/);

  // Verify route debug log statement
  assert.match(source, /\[KeyManager\] route debug:/);
});

test('useImageGeneration: Pre-check block and catch block error status reset contract', () => {
  const source = readSource('apps/web/src/hooks/useImageGeneration.ts');

  // Pre-check resolvedKey existence
  assert.match(source, /const resolvedKey = keyManager\.getNextKey\(node\.model, node\.keySlotId\);/);
  assert.match(source, /if \(!resolvedKey\) \{\s*throw new Error\('No available key for model'\);\s*\}/);

  // Catch block reset logic to avoid old count pollution
  assert.match(source, /lastGenerationSuccessCount: 0,/);
  assert.match(source, /lastGenerationFailCount: actualCount,/);
  assert.match(source, /lastGenerationTotalCount: actualCount,/);
  assert.match(source, /childImageIds: \[\],/);
});

test('imageStorage: Relaxed blob.size limit to preserve small blobs contract', () => {
  const source = readSource('apps/web/src/services/storage/imageStorage.ts');

  // Verify threshold size relaxation for local/repaint small images
  assert.match(source, /\/\/ 防止无效空文档/);
  assert.match(source, /return blob\.size > 0 \? blob : null;/);
});

test('CanvasContext: Hydration cleanup for expired blobs contract', () => {
  const source = readSource('apps/web/src/context/CanvasContext.tsx');

  // Verify startup hydration cleans unrecovered blob urls to "本地临时图片已失效"
  assert.match(source, /errorMsg = '本地临时图片已失效';/);
  assert.match(source, /originalUrl:[\s\S]*?'本地临时图片已失效'[\s\S]*?img\.originalUrl/);
});

test('ImageCard2: Friendly UI for expired blob images contract', () => {
  const source = readSource('apps/web/src/components/image/ImageCard2.tsx');

  // Verify display strings render correctly
  assert.match(source, /'本地临时图片已失效'/);
  assert.match(source, /'\(Expired Blob\)'/);
});

test('UserModelProxy: Whitelist target urls validation runtime tests', async () => {
  const allowedPaths = [
    'https://api.wuyinkeji.com/api/async/detail?id=task-123',
    'https://api.wuyinkeji.com/api/chat/index',
    'https://api.wuyinkeji.com/api/voice/composite',
    'https://api.wuyinkeji.com/api/voice/clone',
    'https://api.wuyinkeji.com/api/sora2-new/submit',
    'https://api.wuyinkeji.com/api/sora2/detail',
    'https://api.wuyinkeji.com/api/img/split',
    'https://api.wuyinkeji.com/api/img/nanoBanana',
    'https://api.wuyinkeji.com/api/img/drawDetail',
  ];

  const blockedPaths = [
    'https://api.wuyinkeji.com/api/admin/recharge',
    'https://api.openai.com/v1/chat/completions',
    'https://evil.com/api/chat/index',
  ];

  const originalFetch = globalThis.fetch;

  try {
    for (const url of allowedPaths) {
      let fetchCalled = false;
      globalThis.fetch = (async (reqUrl: string | URL | Request) => {
        fetchCalled = true;
        assert.ok(String(reqUrl).startsWith(url.split('?')[0]));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      const res = createResponse();
      await handler({
        method: 'POST',
        headers: {
          'x-proxy-target-url': url,
          'x-proxy-api-key': 'wu-api-key-test',
        },
        body: {},
      } as any, res as any);

      assert.equal(res.statusCode, 200, `Should allow target url: ${url}`);
      assert.ok(fetchCalled, `Fetch should have been triggered for: ${url}`);
    }

    for (const url of blockedPaths) {
      globalThis.fetch = (async () => {
        assert.fail('Should not perform upstream fetch for blocked target');
      }) as typeof fetch;

      const res = createResponse();
      await handler({
        method: 'POST',
        headers: {
          'x-proxy-target-url': url,
          'x-proxy-api-key': 'wu-api-key-test',
        },
        body: {},
      } as any, res as any);

      assert.equal(res.statusCode, 404, `Should block target url: ${url}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
