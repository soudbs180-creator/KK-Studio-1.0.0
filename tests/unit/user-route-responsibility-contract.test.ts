import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { test } from 'node:test';
import { fetch as nativeFetch } from 'undici';

const ROOT_DIR = process.cwd();
const require = createRequire(import.meta.url);

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('user route modules have one HTTP ownership boundary each', () => {
  const authSource = readSource('services/api/routes/user/auth.js');
  const profileSource = readSource('services/api/routes/user/profile.js');
  const wuyinSource = readSource('services/api/routes/user/wuyin.js');

  assert.match(authSource, /router\.get\('\/v1\/auth\/session'/);
  assert.doesNotMatch(authSource, /router\.get\('\/v1\/profile'/);
  assert.doesNotMatch(authSource, /WUYIN_|\/v1\/wuyin\/|\/pricing-proxy/);

  assert.match(profileSource, /router\.get\('\/v1\/profile'/);
  assert.match(profileSource, /'\/v1\/profile\/key-manager'/);
  assert.doesNotMatch(profileSource, /router\.(?:get|post)\('\/v1\/wuyin\/catalog/);
  assert.doesNotMatch(profileSource, /router\.all\('\/pricing-proxy'/);

  assert.match(wuyinSource, /router\.get\('\/v1\/wuyin\/catalog'/);
  assert.match(wuyinSource, /router\.post\('\/v1\/wuyin\/catalog\/refresh'/);
  assert.match(wuyinSource, /router\.all\('\/pricing-proxy'/);
  assert.doesNotMatch(wuyinSource, /\/v1\/auth\/|\/v1\/profile|LOCAL_STORAGE_PATH/);
});

test('auth and profile share request identity and envelope helpers', () => {
  const requestContextSource = readSource('services/api/routes/user/shared/requestContext.js');
  const authSource = readSource('services/api/routes/user/auth.js');
  const profileSource = readSource('services/api/routes/user/profile.js');

  for (const exportedName of [
    'verifyRequestJwt',
    'resolveProfileUserId',
    'buildMeta',
    'okEnvelope',
    'authErrorEnvelope',
  ]) {
    assert.match(requestContextSource, new RegExp(`\\b${exportedName}\\b`));
  }

  assert.match(authSource, /require\('\.\/shared\/requestContext'\)/);
  assert.match(profileSource, /require\('\.\/shared\/requestContext'\)/);
  assert.doesNotMatch(authSource, /function verifyRequestJwt|function buildMeta|function okEnvelope|function authErrorEnvelope/);
  assert.doesNotMatch(profileSource, /function verifyRequestJwt|function resolveProfileUserId|function buildMeta|function okEnvelope|function authErrorEnvelope/);
});

test('split Wuyin routes preserve the public catalog and pricing-proxy responses', async (t) => {
  const { createApp } = require('../../services/api/index.js') as typeof import('../../services/api/index.js');
  const server = createApp().listen(0);
  t.after(() => server.close());
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const catalogResponse = await nativeFetch(`${baseUrl}/v1/wuyin/catalog`);
  assert.equal(catalogResponse.status, 200);
  const catalogPayload = await catalogResponse.json() as { success?: boolean; data?: unknown[]; source?: string };
  assert.equal(catalogPayload.success, true);
  assert.ok(Array.isArray(catalogPayload.data));
  assert.equal(catalogPayload.source, 'cache');

  const pricingResponse = await nativeFetch(`${baseUrl}/pricing-proxy`);
  assert.equal(pricingResponse.status, 405);
  const pricingPayload = await pricingResponse.json() as { error?: string; data?: unknown[] };
  assert.equal(pricingPayload.error, 'Method not allowed');
  assert.deepEqual(pricingPayload.data, []);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { api_list: [{ id: 'catalog-item' }], api_type_data: [{ id: 'image' }] },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  t.after(() => { globalThis.fetch = originalFetch; });

  const remotePricingResponse = await nativeFetch(`${baseUrl}/pricing-proxy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'Wuyin', baseUrl: 'https://api.wuyinkeji.com' }),
  });
  assert.equal(remotePricingResponse.status, 200);
  const remotePricingPayload = await remotePricingResponse.json() as {
    success?: boolean;
    endpointUrl?: string;
    data?: unknown[];
  };
  assert.equal(remotePricingPayload.success, true);
  assert.equal(remotePricingPayload.endpointUrl, 'https://api.wuyinkeji.com/type/all');
  assert.deepEqual(remotePricingPayload.data, [{ id: 'catalog-item' }]);
});
