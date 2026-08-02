import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BrowserBridgeService,
  type BrowserSessionAdapter,
} from '../src/services/browserBridgeService';

test('browser bridge reports no sessions when no real adapter is connected', async () => {
  const service = new BrowserBridgeService();

  assert.deepEqual(await service.getActiveSessions(), []);
});

test('browser bridge returns sessions only from the configured adapter', async () => {
  const adapter: BrowserSessionAdapter = {
    async listActiveSessions() {
      return [{
        sessionId: 'desktop-session-1',
        url: 'https://www.zhihu.com/',
        title: 'Zhihu',
        createdAt: 1_700_000_000_000,
      }];
    },
  };
  const service = new BrowserBridgeService(adapter);

  assert.deepEqual(await service.getActiveSessions(), [{
    sessionId: 'desktop-session-1',
    url: 'https://www.zhihu.com/',
    title: 'Zhihu',
    createdAt: 1_700_000_000_000,
  }]);
});
