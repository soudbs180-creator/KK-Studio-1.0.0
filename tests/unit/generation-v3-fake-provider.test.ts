import assert from 'node:assert/strict';
import test from 'node:test';

// 通过 dynamic import 加载 CommonJS 模块，ESM 会把 module.exports 包装为 default
const loadModule = async () => {
  const mod: any = await import('../../services/api/lib/generation-v3/fakeProviderAdapter.js');
  return mod.default || mod;
};

test('fake provider returns success synchronously by default', async () => {
  const { fakeProviderAdapter, clearFakeTasks } = await loadModule();
  clearFakeTasks();

  const result = await fakeProviderAdapter.submit({
    requestId: 'req-1',
    modelId: 'gemini-test',
    prompt: 'a cat',
  });

  assert.equal(result.status, 'success');
  assert.ok(result.providerTaskId);
  assert.ok(Array.isArray(result.urls));
  assert.ok(result.urls[0].includes('fake-provider.kkstudio.local'));
});

test('fake provider supports async pending -> success poll flow', async () => {
  const { fakeProviderAdapter, clearFakeTasks } = await loadModule();
  clearFakeTasks();

  const submitResult = await fakeProviderAdapter.submit({
    requestId: 'req-2',
    modelId: 'gemini-test',
    prompt: 'a dog',
    payload: { async: true },
  });

  assert.equal(submitResult.status, 'pending');
  assert.ok(submitResult.providerTaskId);

  await new Promise((resolve) => setTimeout(resolve, 100));
  const pollResult = await fakeProviderAdapter.poll(submitResult.providerTaskId);
  assert.equal(pollResult.status, 'success');
  assert.ok(pollResult.urls[0].includes('fake-provider.kkstudio.local'));
});

test('fake provider setup-required throws with correct code', async () => {
  const { fakeProviderAdapter, clearFakeTasks } = await loadModule();
  clearFakeTasks();

  await assert.rejects(
    async () => fakeProviderAdapter.submit({
      requestId: 'req-3',
      modelId: 'gemini-test',
      prompt: 'a bird',
      payload: { behavior: 'setup-required' },
    }),
    (err: any) => err.code === 'SETUP_REQUIRED' && err.statusCode === 403,
  );
});

test('fake provider fail-after-submit returns failed status', async () => {
  const { fakeProviderAdapter, clearFakeTasks } = await loadModule();
  clearFakeTasks();

  const result = await fakeProviderAdapter.submit({
    requestId: 'req-4',
    modelId: 'gemini-test',
    prompt: 'a fish',
    payload: { behavior: 'fail-after-submit' },
  });

  assert.equal(result.status, 'failed');
  assert.ok(result.errorMessage);
});

test('fake provider fail-at-poll returns failed on poll', async () => {
  const { fakeProviderAdapter, clearFakeTasks } = await loadModule();
  clearFakeTasks();

  const submitResult = await fakeProviderAdapter.submit({
    requestId: 'req-5',
    modelId: 'gemini-test',
    prompt: 'a tree',
    payload: { behavior: 'fail-at-poll' },
  });

  assert.equal(submitResult.status, 'pending');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const pollResult = await fakeProviderAdapter.poll(submitResult.providerTaskId);
  assert.equal(pollResult.status, 'failed');
});

test('fake provider cancel marks task as cancelled', async () => {
  const { fakeProviderAdapter, clearFakeTasks } = await loadModule();
  clearFakeTasks();

  const submitResult = await fakeProviderAdapter.submit({
    requestId: 'req-6',
    modelId: 'gemini-test',
    prompt: 'a car',
    payload: { async: true },
  });

  await fakeProviderAdapter.cancel(submitResult.providerTaskId);
  const pollResult = await fakeProviderAdapter.poll(submitResult.providerTaskId);
  assert.equal(pollResult.status, 'cancelled');
});
