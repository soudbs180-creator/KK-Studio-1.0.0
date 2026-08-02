const express = require('express');
const {
  CreateProviderConnectionRequestSchema,
  ProviderConnectionIdSchema,
  ReorderProviderConnectionsRequestSchema,
  UpdateProviderConnectionRequestSchema,
} = require('@kk/shared');
const { verifyJWT } = require('../lib/jwt');
const { isImageProviderSliceEnabled } = require('../lib/capability-graph/featureFlag');
const providerConnectionService = require('../lib/capability-graph/providerConnectionService');
const { wrapError, wrapSuccess } = require('../lib/generation/generationResponseEnvelope');

function sendError(response, error) {
  const isValidationError = error?.name === 'ZodError';
  const safeError = isValidationError
    ? { code: 'INVALID_INPUT', message: 'Provider Connection request is invalid.', statusCode: 400 }
    : error;
  const statusCode = Number(safeError?.statusCode) || 500;
  response.status(statusCode).json(wrapError(safeError, {
    surface: 'capability-graph',
    ...(safeError?.canonicalOrder ? { canonicalOrder: safeError.canonicalOrder } : {}),
  }));
}

function asyncRoute(handler) {
  return async (request, response) => {
    try {
      await handler(request, response);
    } catch (error) {
      sendError(response, error);
    }
  };
}

function createAuthMiddleware(jwtVerifier) {
  return (request, response, next) => {
    const userId = jwtVerifier(request.headers.authorization);
    if (!userId) {
      return sendError(response, { code: 'UNAUTHORIZED', message: 'A valid bearer token is required.', statusCode: 401 });
    }
    request.authenticatedUserId = userId;
    return next();
  };
}

function createFlagMiddleware(flagResolver) {
  return (request, response, next) => {
    if (!flagResolver(request.authenticatedUserId)) {
      return sendError(response, { code: 'FEATURE_DISABLED', message: 'Capability Graph is not enabled for this user.', statusCode: 404 });
    }
    return next();
  };
}

function registerCapabilityGraphRoutes(router, service) {
  router.get('/v1/capability-graph/snapshot', asyncRoute(async (request, response) => {
    const snapshot = await service.getCapabilitySnapshot(request.authenticatedUserId);
    response.json(wrapSuccess(snapshot, { surface: 'capability-graph' }));
  }));
  router.get('/v1/provider-connections', asyncRoute(async (request, response) => {
    const connections = await service.listConnections(request.authenticatedUserId);
    response.json(wrapSuccess(connections, { surface: 'capability-graph' }));
  }));
  router.post('/v1/provider-connections', asyncRoute(async (request, response) => {
    const input = CreateProviderConnectionRequestSchema.parse(request.body);
    const connection = await service.createConnection(request.authenticatedUserId, input);
    response.status(201).json(wrapSuccess(connection, { surface: 'capability-graph' }));
  }));
  router.put('/v1/provider-connections/order', asyncRoute(async (request, response) => {
    const input = ReorderProviderConnectionsRequestSchema.parse(request.body);
    const connections = await service.reorderConnections(request.authenticatedUserId, input);
    response.json(wrapSuccess(connections, { surface: 'capability-graph' }));
  }));
  router.patch('/v1/provider-connections/:connectionId', asyncRoute(async (request, response) => {
    const connectionId = ProviderConnectionIdSchema.parse(request.params.connectionId);
    const input = UpdateProviderConnectionRequestSchema.parse(request.body);
    const connection = await service.updateConnection(request.authenticatedUserId, connectionId, input);
    if (!connection) throw Object.assign(new Error('Provider Connection not found.'), { code: 'CONNECTION_NOT_FOUND', statusCode: 404 });
    response.json(wrapSuccess(connection, { surface: 'capability-graph' }));
  }));
  router.delete('/v1/provider-connections/:connectionId', asyncRoute(async (request, response) => {
    const connectionId = ProviderConnectionIdSchema.parse(request.params.connectionId);
    const deleted = await service.deleteConnection(request.authenticatedUserId, connectionId);
    if (!deleted) throw Object.assign(new Error('Provider Connection not found.'), { code: 'CONNECTION_NOT_FOUND', statusCode: 404 });
    response.json(wrapSuccess({ connectionId, deleted: true }, { surface: 'capability-graph' }));
  }));
  router.post('/v1/provider-connections/:connectionId/verify', asyncRoute(async (request, response) => {
    const connectionId = ProviderConnectionIdSchema.parse(request.params.connectionId);
    const connection = await service.verifyConnection(request.authenticatedUserId, connectionId);
    response.json(wrapSuccess(connection, { surface: 'capability-graph' }));
  }));
}

/**
 * Dependency injection keeps route tests offline and prevents real Provider probes.
 */
function createCapabilityGraphRouter(overrides = {}) {
  const router = express.Router();
  const service = overrides.service || providerConnectionService;
  const authMiddleware = createAuthMiddleware(overrides.verifyJWT || verifyJWT);
  const flagMiddleware = createFlagMiddleware(overrides.isEnabled || isImageProviderSliceEnabled);

  // 将认证与功能开关中间件限定在 capability-graph 相关路径，避免通过无路径 router.use()
  // 挂载后泄漏到 apiRouter 中后续的所有路由（如 /v1/auth/login、/v1/profile）。
  router.use('/v1/capability-graph', authMiddleware, flagMiddleware);
  router.use('/v1/provider-connections', authMiddleware, flagMiddleware);

  registerCapabilityGraphRoutes(router, service);
  return router;
}

const capabilityGraphRouter = createCapabilityGraphRouter();

module.exports = capabilityGraphRouter;
module.exports.createCapabilityGraphRouter = createCapabilityGraphRouter;
