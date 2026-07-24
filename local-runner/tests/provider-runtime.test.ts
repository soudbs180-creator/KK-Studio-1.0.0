import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

import {
  parseProviderRuntimeConfig,
  ProviderRuntimeConfigurationError,
} from '../src/provider-runtime/config';
import {
  ProviderRuntimeClient,
  ProviderRuntimeError,
} from '../src/provider-runtime/client';
import { createProviderRuntimeRouter } from '../src/routes/providerRuntime';

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

test('CLIProxyAPI supply-chain pin keeps management disabled', () => {
  const repositoryRoot = path.resolve(__dirname, '../../../..');
  const manifestPath = path.join(repositoryRoot, 'config', 'third-party', 'cliproxyapi.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;

  assert.equal(manifest.repository, 'https://github.com/router-for-me/CLIProxyAPI');
  assert.equal(manifest.tag, 'v7.2.97');
  assert.equal(manifest.commit, '42f36b94e0805a9897c3aa3be46a2b124be0057e');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.defaultEnabled, false);
  assert.equal(manifest.managementApiEnabled, false);
  assert.deepEqual(manifest.allowedRuntimeEndpoints, ['/healthz', '/v1/models']);
});

async function listen(server: Server): Promise<TestServer> {
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

test('provider runtime is disabled by default and rejects non-loopback endpoints', () => {
  assert.equal(parseProviderRuntimeConfig({}).enabled, false);

  for (const baseUrl of [
    'https://provider.example.com',
    'http://localhost:8317',
    'http://127.0.0.1.example.com:8317',
    'http://user:password@127.0.0.1:8317',
    'file:///tmp/provider.sock',
    'http://127.0.0.1:8317/v0/management',
  ]) {
    assert.throws(
      () => parseProviderRuntimeConfig({
        KK_CLI_PROXY_ENABLED: 'true',
        KK_CLI_PROXY_BASE_URL: baseUrl,
        KK_CLI_PROXY_API_KEY: 'local-test-key',
      }),
      ProviderRuntimeConfigurationError,
    );
  }
});

test('provider runtime routes require local authentication before sidecar access', async (context) => {
  let healthRequests = 0;
  const app = express();
  app.use(createProviderRuntimeRouter({
    client: {
      enabled: true,
      getHealth: async () => {
        healthRequests += 1;
        return { status: 'ok' };
      },
      listModels: async () => [],
    },
    validateLocalToken: (authorization) => authorization === 'Bearer local-route-token',
  }));
  const server = await listen(createServer(app));
  context.after(server.close);

  const deniedResponse = await fetch(`${server.baseUrl}/health`);
  assert.equal(deniedResponse.status, 401);
  assert.equal(healthRequests, 0);

  const allowedResponse = await fetch(`${server.baseUrl}/health`, {
    headers: { Authorization: 'Bearer local-route-token' },
  });
  assert.equal(allowedResponse.status, 200);
  assert.deepEqual(await allowedResponse.json(), {
    runtime: 'cliproxyapi',
    status: 'ready',
    reachable: true,
  });
  assert.equal(healthRequests, 1);
});

test('provider runtime only reads bounded health and model projections', async (context) => {
  const requests: Array<{ path: string; authorization?: string }> = [];
  const server = await listen(createServer((request, response) => {
    requests.push({
      path: request.url || '',
      authorization: request.headers.authorization,
    });
    response.setHeader('Content-Type', 'application/json');

    if (request.url === '/healthz') {
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (request.url === '/v1/models') {
      response.end(JSON.stringify({
        object: 'list',
        data: [
          { id: 'gpt-test', object: 'model', created: 1, owned_by: 'openai' },
        ],
      }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not found' }));
  }));
  context.after(server.close);

  const client = new ProviderRuntimeClient(parseProviderRuntimeConfig({
    KK_CLI_PROXY_ENABLED: 'true',
    KK_CLI_PROXY_BASE_URL: server.baseUrl,
    KK_CLI_PROXY_API_KEY: 'local-test-key',
    KK_CLI_PROXY_TIMEOUT_MS: '1000',
  }));

  assert.deepEqual(await client.getHealth(), { status: 'ok' });
  assert.deepEqual(await client.listModels(), [
    { id: 'gpt-test', ownedBy: 'openai' },
  ]);
  assert.deepEqual(requests, [
    { path: '/healthz', authorization: undefined },
    { path: '/v1/models', authorization: 'Bearer local-test-key' },
  ]);
  assert.doesNotMatch(JSON.stringify(await client.listModels()), /local-test-key/);
});

test('provider runtime rejects malformed responses and times out', async (context) => {
  const malformedServer = await listen(createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ data: [{ id: '' }] }));
  }));
  context.after(malformedServer.close);

  const malformedClient = new ProviderRuntimeClient(parseProviderRuntimeConfig({
    KK_CLI_PROXY_ENABLED: 'true',
    KK_CLI_PROXY_BASE_URL: malformedServer.baseUrl,
    KK_CLI_PROXY_API_KEY: 'local-test-key',
  }));
  await assert.rejects(
    malformedClient.listModels(),
    (error: unknown) => error instanceof ProviderRuntimeError
      && error.code === 'PROVIDER_RUNTIME_INVALID_RESPONSE',
  );

  const timeoutServer = await listen(createServer(() => undefined));
  context.after(timeoutServer.close);
  const timeoutClient = new ProviderRuntimeClient(parseProviderRuntimeConfig({
    KK_CLI_PROXY_ENABLED: 'true',
    KK_CLI_PROXY_BASE_URL: timeoutServer.baseUrl,
    KK_CLI_PROXY_API_KEY: 'local-test-key',
    KK_CLI_PROXY_TIMEOUT_MS: '20',
  }));
  await assert.rejects(
    timeoutClient.getHealth(),
    (error: unknown) => error instanceof ProviderRuntimeError
      && error.code === 'PROVIDER_RUNTIME_TIMEOUT',
  );
});

test('provider runtime stops reading oversized chunked responses', async (context) => {
  const oversizedServer = await listen(createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Transfer-Encoding', 'chunked');
    response.write('{"padding":"');
    response.write('x'.repeat(1024 * 1024));
    response.end('"}');
  }));
  context.after(oversizedServer.close);

  const client = new ProviderRuntimeClient(parseProviderRuntimeConfig({
    KK_CLI_PROXY_ENABLED: 'true',
    KK_CLI_PROXY_BASE_URL: oversizedServer.baseUrl,
    KK_CLI_PROXY_API_KEY: 'local-test-key',
  }));
  await assert.rejects(
    client.getHealth(),
    (error: unknown) => error instanceof ProviderRuntimeError
      && error.code === 'PROVIDER_RUNTIME_INVALID_RESPONSE',
  );
});
