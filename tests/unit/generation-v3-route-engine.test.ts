import assert from 'node:assert/strict';
import test from 'node:test';

const loadModule = async () => {
  const mod: any = await import('../../server/lib/generation-v3/routeEngine.js');
  return mod.default || mod;
};

test('route engine selects fake-provider for unknown models', async () => {
  const { selectRoute } = await loadModule();
  const route = selectRoute({ mediaType: 'image', model: 'unknown-model-v1', channel: 'platform-credits' });
  assert.equal(route.providerId, 'fake-provider');
  assert.equal(route.adapterId, 'fake-provider');
  assert.ok(route.adapter);
  assert.equal(typeof route.adapter.submit, 'function');
});

test('route engine maps gemini models to google provider and falls back to fake adapter', async () => {
  const { selectRoute } = await loadModule();
  const route = selectRoute({
    mediaType: 'image',
    model: 'gemini-2.5-flash',
    channel: 'platform-credits',
    options: { useFakeProvider: true },
  });
  assert.equal(route.providerId, 'fake-provider');
  assert.equal(route.adapterId, 'fake-provider');
});

test('route engine rejects setup-required channel', async () => {
  const { selectRoute } = await loadModule();
  await assert.rejects(
    async () => selectRoute({ mediaType: 'image', model: 'gemini-test', channel: 'setup-required' }),
    (err: any) => err.code === 'SETUP_REQUIRED',
  );
});

test('route engine honors providerHint', async () => {
  const { selectRoute } = await loadModule();
  const route = selectRoute({
    mediaType: 'image',
    model: 'anything',
    channel: 'platform-credits',
    providerHint: 'wuyin',
    options: { useFakeProvider: true },
  });
  assert.equal(route.providerId, 'fake-provider');
});
