const {
  CANONICAL_PROVIDER_CATALOG,
  CapabilityGraphSnapshotDtoSchema,
  CreateProviderConnectionRequestSchema,
  ProviderConnectionListDtoSchema,
} = require('@kk/shared');
const cryptoUtil = require('../../utils/crypto');
const storeModule = require('./providerConnectionStore');
const { projectCapabilityGraph } = require('./projection');
const { verifyConnectionEndpoint } = require('./connectionVerifier');

const PROTOCOL_PROFILE_FAMILY = {
  'google-official': 'gemini-native',
  'gemini-native': 'gemini-native',
  'openai-compatible': 'openai-compatible',
  'claude-native': 'claude-native',
};

function createServiceError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function resolveDependencies(overrides = {}) {
  return {
    decrypt: overrides.decrypt || cryptoUtil.decrypt,
    projectCapabilityGraph: overrides.projectCapabilityGraph || projectCapabilityGraph,
    providers: overrides.providers || CANONICAL_PROVIDER_CATALOG,
    store: overrides.store || storeModule,
    verifyConnectionEndpoint: overrides.verifyConnectionEndpoint || verifyConnectionEndpoint,
  };
}

function resolveProviderRequest(input, providers) {
  const request = CreateProviderConnectionRequestSchema.parse(input);
  const provider = providers.find(({ id }) => id === request.providerId);
  if (!provider) {
    throw createServiceError('PROVIDER_NOT_FOUND', 'Provider is not present in the canonical catalog.', 400);
  }
  const protocolFamily = PROTOCOL_PROFILE_FAMILY[request.protocolProfile];
  if (!protocolFamily || !provider.protocolFamilies.includes(protocolFamily)) {
    throw createServiceError('PROTOCOL_PROFILE_MISMATCH', 'Protocol profile is not supported by this Provider.', 400);
  }
  if (request.protocolProfile === 'google-official' && provider.id !== 'google') {
    throw createServiceError('PROTOCOL_PROFILE_MISMATCH', 'Google official profile is only valid for the Google Provider.', 400);
  }
  const endpoint = request.endpoint || provider.defaultBaseUrl;
  if (!endpoint) {
    throw createServiceError('ENDPOINT_REQUIRED', 'Provider endpoint is required for this Connection.', 400);
  }
  return { ...request, endpoint };
}

/** 创建只完成规范化与加密存储；网络探测必须由显式 verify 操作触发。 */
async function createConnection(userId, input, overrides = {}) {
  const dependencies = resolveDependencies(overrides);
  const request = resolveProviderRequest(input, dependencies.providers);
  return dependencies.store.createProviderConnection(userId, request, overrides);
}

async function listConnections(userId, overrides = {}) {
  const dependencies = resolveDependencies(overrides);
  const connections = await dependencies.store.listProviderConnections(userId, overrides);
  return ProviderConnectionListDtoSchema.parse({ version: 'v1', connections });
}

async function updateConnection(userId, connectionId, input, overrides = {}) {
  const dependencies = resolveDependencies(overrides);
  return dependencies.store.updateProviderConnection(userId, connectionId, input, overrides);
}

async function deleteConnection(userId, connectionId, overrides = {}) {
  const dependencies = resolveDependencies(overrides);
  return dependencies.store.deleteProviderConnection(userId, connectionId, overrides);
}

function normalizeVerificationError(error) {
  if (error?.code && error?.message) return error;
  return createServiceError('PROVIDER_VERIFICATION_FAILED', 'Provider verification failed.', 502);
}

/** secret 仅在本函数局部解密，探测完成后只持久化安全诊断与 capability binding。 */
async function verifyConnection(userId, connectionId, overrides = {}) {
  const dependencies = resolveDependencies(overrides);
  const record = await dependencies.store.getProviderConnectionSecretRecord(userId, connectionId, overrides);
  if (!record) throw createServiceError('CONNECTION_NOT_FOUND', 'Provider Connection not found.', 404);
  let secret;
  try {
    secret = dependencies.decrypt(record.secretRef);
  } catch {
    throw createServiceError('CONNECTION_SECRET_UNAVAILABLE', 'Provider Connection credential cannot be decrypted.', 500);
  }
  try {
    const verification = await dependencies.verifyConnectionEndpoint({ ...record, secret }, overrides.verifierDependencies);
    return await dependencies.store.saveVerificationResult(userId, connectionId, verification, overrides);
  } catch (error) {
    const safeError = normalizeVerificationError(error);
    await dependencies.store.saveVerificationFailure(userId, connectionId, {
      code: safeError.code,
      message: safeError.message,
    }, overrides);
    throw safeError;
  }
}

/** snapshot 只组合 canonical catalog 与用户隔离后的安全 DTO/绑定。 */
async function getCapabilitySnapshot(userId, overrides = {}) {
  const dependencies = resolveDependencies(overrides);
  const [connections, bindings] = await Promise.all([
    dependencies.store.listProviderConnections(userId, overrides),
    dependencies.store.listCapabilityBindings(userId, overrides),
  ]);
  const snapshot = dependencies.projectCapabilityGraph({
    providers: dependencies.providers,
    connections,
    bindings,
  });
  return CapabilityGraphSnapshotDtoSchema.parse(snapshot);
}

module.exports = {
  createConnection,
  deleteConnection,
  getCapabilitySnapshot,
  listConnections,
  updateConnection,
  verifyConnection,
};
