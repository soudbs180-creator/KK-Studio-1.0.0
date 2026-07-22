import assert from 'node:assert/strict';
import test from 'node:test';

test('image provider slice rollout is off by default and honors internal/invited/full scopes', async () => {
  const module = await import('../../services/api/lib/capability-graph/featureFlag.js');
  const { isImageProviderSliceEnabled } = module.default || module;

  assert.equal(isImageProviderSliceEnabled('user-1', {}), false);
  assert.equal(isImageProviderSliceEnabled('user-1', {
    CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE: 'internal',
    CAPABILITY_GRAPH_INTERNAL_USER_IDS: 'user-1,user-2',
  }), true);
  assert.equal(isImageProviderSliceEnabled('user-3', {
    CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE: 'internal',
    CAPABILITY_GRAPH_INTERNAL_USER_IDS: 'user-1,user-2',
  }), false);
  assert.equal(isImageProviderSliceEnabled('invited-user', {
    CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE: 'invited',
    CAPABILITY_GRAPH_INVITED_USER_IDS: 'invited-user',
  }), true);
  assert.equal(isImageProviderSliceEnabled('any-user', {
    CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE: 'full',
  }), true);
  assert.equal(isImageProviderSliceEnabled('user-1', {
    CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE: 'unexpected-scope',
    CAPABILITY_GRAPH_INTERNAL_USER_IDS: 'user-1',
    CAPABILITY_GRAPH_INVITED_USER_IDS: 'user-1',
  }), false);
});
