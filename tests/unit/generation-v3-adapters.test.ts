import assert from 'node:assert/strict';
import test from 'node:test';

const loadModule = async (path: string) => {
  const mod: any = await import(path);
  return mod.default || mod;
};

test('generation-v3 index registers expected adapters', async () => {
  const { registry } = await loadModule('../../services/api/lib/generation-v3/index.js');
  const adapters = registry.list();
  const ids = adapters.map((a: any) => a.adapterId);

  assert.ok(ids.includes('fake-provider'), 'fake-provider should be registered');
  assert.ok(ids.includes('openai-compatible-image'), 'openai-compatible-image should be registered');
  assert.ok(ids.includes('google-image'), 'google-image should be registered');
  assert.ok(ids.includes('wuyin-image'), 'wuyin-image should be registered');
  assert.ok(ids.includes('wuyin-documented'), 'wuyin-documented should be registered');
});

test('every registered adapter implements submit and poll', async () => {
  const { registry } = await loadModule('../../services/api/lib/generation-v3/index.js');
  for (const adapter of registry.list()) {
    assert.equal(typeof adapter.submit, 'function', `${adapter.adapterId} should implement submit`);
    assert.equal(typeof adapter.poll, 'function', `${adapter.adapterId} should implement poll`);
    assert.equal(typeof adapter.cancel, 'function', `${adapter.adapterId} should implement cancel`);
  }
});

test('route engine selects wuyin-documented for wuyin video models', async () => {
  const { selectRoute } = await loadModule('../../services/api/lib/generation-v3/routeEngine.js');
  const route = selectRoute({ mediaType: 'video', model: 'video_google_omni', channel: 'platform-credits' });
  assert.equal(route.providerId, 'wuyinkeji');
  assert.equal(route.adapterId, 'wuyin-documented');
  assert.equal(typeof route.adapter.submit, 'function');
});

test('route engine selects google-image for gemini image models', async () => {
  const { selectRoute } = await loadModule('../../services/api/lib/generation-v3/routeEngine.js');
  const route = selectRoute({ mediaType: 'image', model: 'gemini-2.5-flash-image', channel: 'platform-credits' });
  assert.equal(route.providerId, 'google');
  assert.equal(route.adapterId, 'google-image');
  assert.equal(typeof route.adapter.submit, 'function');
});

test('route engine selects openai-compatible-image for gpt-best image models', async () => {
  const { selectRoute } = await loadModule('../../services/api/lib/generation-v3/routeEngine.js');
  const route = selectRoute({ mediaType: 'image', model: 'gpt-best-001', channel: 'platform-credits' });
  assert.equal(route.providerId, 'gpt-best');
  assert.equal(route.adapterId, 'openai-compatible-image');
  assert.equal(typeof route.adapter.submit, 'function');
});
