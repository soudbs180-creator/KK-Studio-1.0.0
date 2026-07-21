// services/api/lib/generation-v3/fakeProviderAdapter.js
// 中文注释：Fake Provider Adapter，覆盖 BYOK/本地 Key/云端 Key/平台积分/setup-required
//          的提交、轮询、失败、取消测试路径。不产生真实外部调用。

const crypto = require('crypto');
const { registry } = require('./providerAdapter');

const FAKE_TASK_STORE = new Map();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFakeUrl(taskId) {
  return `https://fake-provider.kkstudio.local/artifacts/${taskId}.png`;
}

function resolveBehavior(input) {
  const payload = input.payload || {};
  const behavior = String(payload.behavior || 'success').toLowerCase();
  const asyncMode = payload.async === true || behavior === 'async' || behavior === 'fail-at-poll';
  const failAfterSubmit = behavior === 'fail-after-submit';
  const failAtPoll = behavior === 'fail-at-poll';
  const setupRequired = behavior === 'setup-required';
  const latencyMs = Number(payload.latencyMs || 10);
  return {
    behavior,
    asyncMode,
    failAfterSubmit,
    failAtPoll,
    setupRequired,
    latencyMs,
  };
}

async function submit(input) {
  const { behavior, latencyMs, asyncMode, failAfterSubmit, setupRequired } = resolveBehavior(input);
  if (latencyMs > 0) await delay(latencyMs);

  if (setupRequired) {
    const err = new Error('Provider setup required: please configure API key or membership.');
    err.code = 'SETUP_REQUIRED';
    err.statusCode = 403;
    err.retryable = false;
    throw err;
  }

  const providerTaskId = crypto.randomUUID();

  if (failAfterSubmit) {
    FAKE_TASK_STORE.set(providerTaskId, { status: 'failed', errorMessage: 'Fake provider submit failure' });
    return { providerTaskId, status: 'failed', errorMessage: 'Fake provider submit failure' };
  }

  if (asyncMode) {
    FAKE_TASK_STORE.set(providerTaskId, { status: 'pending', resolvedAt: Date.now() + 50, behavior });
    return { providerTaskId, status: 'pending' };
  }

  FAKE_TASK_STORE.set(providerTaskId, { status: 'success', url: buildFakeUrl(providerTaskId) });
  return { providerTaskId, status: 'success', urls: [buildFakeUrl(providerTaskId)] };
}

async function poll(providerTaskId) {
  const record = FAKE_TASK_STORE.get(providerTaskId);
  if (!record) {
    const err = new Error('Fake provider task not found');
    err.code = 'PROVIDER_TASK_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  if (record.status === 'pending') {
    if (Date.now() >= record.resolvedAt) {
      if (record.behavior === 'fail-at-poll') {
        record.status = 'failed';
        record.errorMessage = 'Fake provider poll failure';
      } else {
        record.status = 'success';
        record.url = buildFakeUrl(providerTaskId);
      }
    }
  }

  if (record.status === 'success') {
    return { status: 'success', urls: [record.url], raw: record };
  }

  if (record.status === 'failed') {
    return { status: 'failed', errorMessage: record.errorMessage || 'Fake provider failure', raw: record };
  }

  if (record.status === 'cancelled') {
    return { status: 'cancelled', raw: record };
  }

  return { status: record.status, raw: record };
}

async function cancel(providerTaskId) {
  const record = FAKE_TASK_STORE.get(providerTaskId);
  if (record) {
    record.status = 'cancelled';
  }
}

const fakeProviderAdapter = {
  adapterId: 'fake-provider',
  adapterVersion: '1.0.0',
  submit,
  poll,
  cancel,
};

registry.register(fakeProviderAdapter);

module.exports = {
  fakeProviderAdapter,
  FAKE_TASK_STORE,
  clearFakeTasks: () => FAKE_TASK_STORE.clear(),
};
