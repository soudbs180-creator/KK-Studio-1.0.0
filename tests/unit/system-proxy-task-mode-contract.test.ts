import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();
const LOCAL_STORE_PATH = path.resolve(ROOT_DIR, 'services/api/.kk-local/contract-compat.json');
const TEMP_USER_HEADER = 'x-kk-temp-user-id';
const TEMP_USER_ID = 'temp-system-proxy-task-test';
const require = createRequire(import.meta.url);

async function httpRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: Buffer; json: () => Promise<any> }> {
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
          body,
          json: async () => JSON.parse(body.toString('utf8')),
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

test('system model proxy task modes use persisted generation tasks instead of returning 501 placeholders', async () => {
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    KKAI_LOCAL_ONLY: process.env.KKAI_LOCAL_ONLY,
    NODE_ENV: process.env.NODE_ENV,
    PASSWORD_SALT: process.env.PASSWORD_SALT,
  };

  let originalStore: string | null = null;
  let server: any = null;

  try {
    try {
      originalStore = await fs.readFile(LOCAL_STORE_PATH, 'utf8');
    } catch {
      originalStore = null;
    }

    await fs.mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
    await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify({
      version: 1,
      profiles: {
        [TEMP_USER_ID]: {
          profile: {},
          creditBalance: 1000,
          creditTransactions: [],
          workspaceLayout: { canvases: [] },
          workflows: {},
          assets: [],
          rechargeSubmissions: {},
          generationTasks: {
            'system-task-done': {
              id: 'system-task-done',
              requestId: 'req-done',
              attemptId: 'attempt-done',
              status: 'succeeded',
              taskType: 'image',
              results: [{ url: 'https://cdn.example.test/system-task-done.png' }],
              creditAmount: 7,
              billingStatus: 'charged',
              createdAt: new Date().toISOString(),
            },
            'system-task-running': {
              id: 'system-task-running',
              requestId: 'req-running',
              attemptId: 'attempt-running',
              status: 'running',
              taskType: 'image',
              results: [],
              createdAt: new Date().toISOString(),
            },
          },
        },
      },
    }, null, 2), 'utf8');

    for (const key of Object.keys(require.cache)) {
      if (key.includes(`${path.sep}server${path.sep}`)) {
        delete require.cache[key];
      }
    }

    process.env.NODE_ENV = 'test';
    process.env.KKAI_LOCAL_ONLY = 'true';
    process.env.JWT_SECRET = 'system-proxy-task-test-secret';
    process.env.PASSWORD_SALT = 'system-proxy-task-test-salt';
    delete process.env.DATABASE_URL;

    const { createApp } = require('../../services/api/index.js');
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const postTaskMode = async (body: Record<string, unknown>) => {
      const response = await httpRequest(`${baseUrl}/api/v1/model-proxy/system`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [TEMP_USER_HEADER]: TEMP_USER_ID,
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as any;
      return { response, payload };
    };

    const statusResult = await postTaskMode({ mode: 'task_status', taskId: 'system_proxy:system-task-done' });
    assert.equal(statusResult.response.status, 200);
    assert.equal(statusResult.payload.success, true);
    assert.equal(statusResult.payload.data.status, 'success');
    assert.equal(statusResult.payload.data.url, 'https://cdn.example.test/system-task-done.png');
    assert.equal(statusResult.payload.data.requestId, 'req-done');

    const downloadResult = await postTaskMode({ mode: 'download_task', taskId: 'system-task-done' });
    assert.equal(downloadResult.response.status, 200);
    assert.equal(downloadResult.payload.data.url, 'https://cdn.example.test/system-task-done.png');

    const cancelResult = await postTaskMode({ mode: 'cancel_task', taskId: 'system-task-running' });
    assert.equal(cancelResult.response.status, 200);
    assert.match(cancelResult.payload.data.message, /cancelled/i);

    const cancelledStatus = await postTaskMode({ mode: 'task_status', taskId: 'system-task-running' });
    assert.equal(cancelledStatus.response.status, 200);
    assert.equal(cancelledStatus.payload.data.status, 'failed');
    assert.match(cancelledStatus.payload.data.error, /cancelled/i);

    const deleteResult = await postTaskMode({ mode: 'delete_task', taskId: 'system-task-running' });
    assert.equal(deleteResult.response.status, 200);
    assert.match(deleteResult.payload.data.message, /deleted/i);

    const missingResult = await postTaskMode({ mode: 'task_status', taskId: 'system-task-running' });
    assert.equal(missingResult.response.status, 404);
    assert.equal(missingResult.payload.error.code, 'GENERATION_TASK_NOT_FOUND');
  } finally {
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
  }
});
