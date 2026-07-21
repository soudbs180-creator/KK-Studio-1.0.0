const cryptoUtil = require('../../utils/crypto');
const providerConnectionStore = require('./providerConnectionStore');

const ADAPTER_BY_CAPABILITY = new Map([
  ['google:image.generate', 'google-image'],
]);

function createRouteError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function resolveDependencies(overrides = {}) {
  return {
    decrypt: overrides.decrypt || cryptoUtil.decrypt,
    store: overrides.store || providerConnectionStore,
  };
}

/** A quote can only freeze a route that verification projected for this exact user Connection. */
async function resolveQuoteConnectionRoute(userId, request, overrides = {}) {
  if (!request.connectionId) return null;
  const { store } = resolveDependencies(overrides);
  const binding = await store.getVerifiedRouteBinding(userId, request, overrides);
  if (!binding) {
    throw createRouteError('CONNECTION_ROUTE_UNAVAILABLE', 'No verified Connection supports the requested capability and model.', 409);
  }
  const adapterId = ADAPTER_BY_CAPABILITY.get(`${binding.providerId}:${binding.capabilityId}`);
  if (!adapterId) {
    throw createRouteError('CONNECTION_ROUTE_UNAVAILABLE', 'The verified Connection has no supported server adapter.', 409);
  }
  return { ...binding, adapterId, capabilityVersion: '1.0.0' };
}

function assertFrozenVersions(snapshot, record) {
  if (
    record.connectionUpdatedAt !== snapshot.connectionUpdatedAt
    || record.bindingUpdatedAt !== snapshot.bindingUpdatedAt
  ) {
    throw createRouteError('CONNECTION_ROUTE_STALE', 'Provider Connection changed after the quote. Request a new quote.', 409);
  }
}

/** Credentials are decrypted only after the current binding matches the immutable quote snapshot. */
async function resolveExecutionConnectionAuth(userId, snapshot, overrides = {}) {
  if (!snapshot?.connectionId) return undefined;
  const dependencies = resolveDependencies(overrides);
  const record = await dependencies.store.getConnectionExecutionRecord(userId, snapshot, overrides);
  if (!record) {
    throw createRouteError('CONNECTION_ROUTE_UNAVAILABLE', 'The quoted Provider Connection is no longer available.', 409);
  }
  assertFrozenVersions(snapshot, record);
  let apiKey;
  try {
    apiKey = dependencies.decrypt(record.secretRef);
  } catch {
    throw createRouteError('CONNECTION_SECRET_UNAVAILABLE', 'The quoted Provider Connection credential cannot be decrypted.', 500);
  }
  return { apiKey, connectionId: record.connectionId, endpoint: record.endpoint };
}

module.exports = { resolveExecutionConnectionAuth, resolveQuoteConnectionRoute };
