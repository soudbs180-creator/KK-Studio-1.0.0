import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

import { createLocalRunnerApp, LOCAL_RUNNER_JSON_LIMIT_BYTES } from '../src/app';

test('local runner rejects oversized JSON before route execution', async (context) => {
  const server = createLocalRunnerApp().listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/api/opencli/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: 'x'.repeat(LOCAL_RUNNER_JSON_LIMIT_BYTES + 1) }),
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Local Runner request body exceeds the allowed size.',
    },
  });
});

