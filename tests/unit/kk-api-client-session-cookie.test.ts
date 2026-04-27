import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createKkApiClient } from '../../packages/contracts/src/index.ts';

const profile = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'worker@example.com',
  nickname: 'worker',
  role: 'user',
  status: 'active',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
} as const;

test('session endpoints include browser credentials and allow empty refresh bodies', async () => {
  const requests: Array<{
    url: string;
    credentials: RequestCredentials | undefined;
    method: string;
    body?: string;
  }> = [];

  const client = createKkApiClient({
    baseUrl: 'https://app.example.com/',
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        credentials: init?.credentials,
        method: String(init?.method || 'GET'),
        body: typeof init?.body === 'string' ? init.body : undefined,
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          accessToken: 'access-token-1',
          expiresIn: 3600,
          sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          profile,
        },
        meta: {
          requestId: 'req-session-cookie',
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    },
  });

  await client.getSession();
  await client.refreshSession({});
  await client.logout();

  assert.deepEqual(
    requests.map((request) => [request.method, request.credentials]),
    [
      ['GET', 'include'],
      ['POST', 'include'],
      ['POST', 'include'],
    ],
  );
  assert.equal(requests[1]?.body, JSON.stringify({}));
});
