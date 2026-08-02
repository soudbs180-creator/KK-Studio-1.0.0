const { getPool } = require('../db');
const cryptoUtil = require('../../utils/crypto');
const {
  CreateProviderConnectionRequestSchema,
  ProviderConnectionDtoSchema,
  UpdateProviderConnectionRequestSchema,
} = require('@kk/shared');

const SAFE_CONNECTION_COLUMNS = `
  connection_id AS "connectionId",
  provider_id AS "providerId",
  display_name AS "displayName",
  protocol_profile AS "protocolProfile",
  endpoint_url AS "endpoint",
  routing_priority AS "routingPriority",
  status,
  (secret_ref IS NOT NULL) AS "hasSecret",
  verified_at AS "verifiedAt",
  verification_error_code AS "verificationErrorCode",
  verification_message AS "verificationMessage",
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

function toIsoString(value) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseSafeConnectionRow(row) {
  return ProviderConnectionDtoSchema.parse({
    connectionId: row.connectionId,
    providerId: row.providerId,
    displayName: row.displayName,
    protocolProfile: row.protocolProfile,
    endpoint: row.endpoint || undefined,
    status: row.status,
    hasSecret: Boolean(row.hasSecret),
    ...(Number.isInteger(row.routingPriority) ? { routingPriority: row.routingPriority } : {}),
    verifiedAt: toIsoString(row.verifiedAt),
    verificationErrorCode: row.verificationErrorCode || undefined,
    verificationMessage: row.verificationMessage || undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  });
}

/** 每次访问新多租户表前设置事务级 owner context，使 RLS 与显式 user_id 条件双重生效。 */
async function withUserScopedClient(userId, operation, pool = getPool()) {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('A non-empty userId is required for provider connection storage.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Serializes every owner-scoped priority mutation behind the same revision row. */
async function lockOwnerOrderRevision(client, userId) {
  await client.query(
    `INSERT INTO public.provider_connection_order_revisions (user_id, revision)
     VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const result = await client.query(
    `SELECT revision AS "orderRevision"
     FROM public.provider_connection_order_revisions
     WHERE user_id = $1
     FOR UPDATE`,
    [userId],
  );
  return Number(result.rows[0]?.orderRevision || 0);
}

/** 创建 Connection 时立即加密 secret，RETURNING 列表不包含 secret_ref。 */
async function createProviderConnection(userId, input, dependencies = {}) {
  const request = CreateProviderConnectionRequestSchema.parse(input);
  const encrypt = dependencies.encrypt || cryptoUtil.encrypt;
  const secretRef = encrypt(request.secret);
  return withUserScopedClient(userId, async (client) => {
    await lockOwnerOrderRevision(client, userId);
    const result = await client.query(
      `INSERT INTO public.provider_connections (
        user_id, provider_id, display_name, protocol_profile, endpoint_url, secret_ref, routing_priority
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        (SELECT COALESCE(MAX(routing_priority) + 1, 0)
         FROM public.provider_connections WHERE user_id = $1 AND revoked_at IS NULL)
      )
      RETURNING ${SAFE_CONNECTION_COLUMNS}`,
      [userId, request.providerId, request.displayName, request.protocolProfile, request.endpoint || null, secretRef],
    );
    await client.query(
      `UPDATE public.provider_connection_order_revisions
       SET revision = revision + 1, updated_at = now()
       WHERE user_id = $1`,
      [userId],
    );
    return parseSafeConnectionRow(result.rows[0]);
  }, dependencies.pool);
}

/** 列表查询只投影 hasSecret，不读取或返回加密 envelope。 */
async function listProviderConnections(userId, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    const result = await client.query(
      `SELECT ${SAFE_CONNECTION_COLUMNS}
       FROM public.provider_connections
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY routing_priority ASC, updated_at DESC, connection_id`,
      [userId],
    );
    return result.rows.map(parseSafeConnectionRow);
  }, dependencies.pool);
}

async function listProviderConnectionsWithRevision(userId, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    await client.query(
      `INSERT INTO public.provider_connection_order_revisions (user_id, revision)
       VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    const [connectionsResult, revisionResult] = await Promise.all([
      client.query(
        `SELECT ${SAFE_CONNECTION_COLUMNS}
         FROM public.provider_connections
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY routing_priority ASC, updated_at DESC, connection_id`,
        [userId],
      ),
      client.query(
        `SELECT revision AS "orderRevision"
         FROM public.provider_connection_order_revisions
         WHERE user_id = $1`,
        [userId],
      ),
    ]);
    return {
      connections: connectionsResult.rows.map(parseSafeConnectionRow),
      orderRevision: Number(revisionResult.rows[0]?.orderRevision || 0),
    };
  }, dependencies.pool);
}

/** Reorders the complete active owner set under a revision lock in one transaction. */
async function reorderProviderConnections(userId, request, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    const orderRevision = await lockOwnerOrderRevision(client, userId);
    const currentResult = await client.query(
      `SELECT connection_id AS "connectionId"
       FROM public.provider_connections
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY routing_priority ASC, updated_at DESC, connection_id
       FOR UPDATE`,
      [userId],
    );
    const currentIds = currentResult.rows.map((row) => row.connectionId);
    if (orderRevision !== request.expectedOrderRevision) {
      return { conflict: true, orderRevision, connectionIds: currentIds };
    }
    const requestedSet = new Set(request.connectionIds);
    const sameSet = requestedSet.size === currentIds.length
      && currentIds.every((connectionId) => requestedSet.has(connectionId));
    if (!sameSet) {
      return { setMismatch: true, orderRevision, connectionIds: currentIds };
    }
    await client.query(
      `UPDATE public.provider_connections AS connection
       SET routing_priority = ordered.ordinality - 1
       FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered(connection_id, ordinality)
       WHERE connection.user_id = $1
         AND connection.connection_id = ordered.connection_id
         AND connection.revoked_at IS NULL`,
      [userId, request.connectionIds],
    );
    const nextRevisionResult = await client.query(
      `UPDATE public.provider_connection_order_revisions
       SET revision = revision + 1, updated_at = now()
       WHERE user_id = $1
       RETURNING revision AS "orderRevision"`,
      [userId],
    );
    const connectionsResult = await client.query(
      `SELECT ${SAFE_CONNECTION_COLUMNS}
       FROM public.provider_connections
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY routing_priority ASC, updated_at DESC, connection_id`,
      [userId],
    );
    return {
      orderRevision: Number(nextRevisionResult.rows[0]?.orderRevision || orderRevision + 1),
      connections: connectionsResult.rows.map(parseSafeConnectionRow),
    };
  }, dependencies.pool);
}

function buildUpdateParts(request, encrypt) {
  const assignments = [];
  const values = [];
  if (request.displayName !== undefined) {
    values.push(request.displayName);
    assignments.push(`display_name = $${values.length}`);
  }
  if (request.endpoint !== undefined) {
    values.push(request.endpoint);
    assignments.push(`endpoint_url = $${values.length}`);
  }
  if (request.secret !== undefined) {
    values.push(encrypt(request.secret));
    assignments.push(`secret_ref = $${values.length}`);
  }
  if (request.endpoint !== undefined || request.secret !== undefined) {
    assignments.push("status = 'unverified'", 'verified_at = NULL', 'verification_error_code = NULL', 'verification_message = NULL');
  }
  assignments.push('updated_at = now()');
  return { assignments, values };
}

/** 更新 endpoint 或 secret 会让已有验证失效，防止旧能力绑定被错误继续使用。 */
async function updateProviderConnection(userId, connectionId, input, dependencies = {}) {
  const request = UpdateProviderConnectionRequestSchema.parse(input);
  const { assignments, values } = buildUpdateParts(request, dependencies.encrypt || cryptoUtil.encrypt);
  values.push(connectionId, userId);
  return withUserScopedClient(userId, async (client) => {
    const result = await client.query(
      `UPDATE public.provider_connections
       SET ${assignments.join(', ')}
       WHERE connection_id = $${values.length - 1} AND user_id = $${values.length} AND revoked_at IS NULL
       RETURNING ${SAFE_CONNECTION_COLUMNS}`,
      values,
    );
    return result.rows[0] ? parseSafeConnectionRow(result.rows[0]) : null;
  }, dependencies.pool);
}

async function deleteProviderConnection(userId, connectionId, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    await lockOwnerOrderRevision(client, userId);
    const result = await client.query(
      `DELETE FROM public.provider_connections
       WHERE connection_id = $1 AND user_id = $2
       RETURNING connection_id`,
      [connectionId, userId],
    );
    if (result.rows.length === 0) return false;
    await client.query(
      `WITH ranked AS (
         SELECT connection_id, row_number() OVER (ORDER BY routing_priority, updated_at DESC, connection_id) - 1 AS priority
         FROM public.provider_connections
         WHERE user_id = $1 AND revoked_at IS NULL
       )
       UPDATE public.provider_connections AS connection
       SET routing_priority = ranked.priority
       FROM ranked
       WHERE connection.connection_id = ranked.connection_id`,
      [userId],
    );
    await client.query(
      `INSERT INTO public.provider_connection_order_revisions (user_id, revision)
       VALUES ($1, 1)
       ON CONFLICT (user_id) DO UPDATE
       SET revision = public.provider_connection_order_revisions.revision + 1, updated_at = now()`,
      [userId],
    );
    return true;
  }, dependencies.pool);
}

/** 仅 verify 服务可读取 secret_ref；调用方必须在返回公共 DTO 前解密并丢弃。 */
async function getProviderConnectionSecretRecord(userId, connectionId, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    const result = await client.query(
      `SELECT connection_id AS "connectionId", provider_id AS "providerId",
              protocol_profile AS "protocolProfile", endpoint_url AS "endpoint",
              secret_ref AS "secretRef"
       FROM public.provider_connections
       WHERE connection_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [connectionId, userId],
    );
    return result.rows[0] || null;
  }, dependencies.pool);
}

async function replaceConnectionBindings(client, userId, connectionId, bindings) {
  await client.query(
    `UPDATE public.capability_bindings
     SET status = 'disabled', updated_at = now()
     WHERE user_id = $1 AND connection_id = $2`,
    [userId, connectionId],
  );
  for (const binding of bindings) {
    await client.query(
      `INSERT INTO public.capability_bindings (
        user_id, connection_id, model_id, capability_id, channel, request_profile, status, constraints_json
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7::jsonb)
      ON CONFLICT (user_id, connection_id, model_id, capability_id, channel, request_profile)
      DO UPDATE SET status = 'active', constraints_json = EXCLUDED.constraints_json, updated_at = now()`,
      [userId, connectionId, binding.modelId, binding.capabilityId, binding.channel, binding.requestProfile, JSON.stringify(binding.constraints || {})],
    );
  }
}

async function saveVerificationResult(userId, connectionId, verification, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    const result = await client.query(
      `UPDATE public.provider_connections
       SET status = $1, verified_at = $2, verification_error_code = NULL,
           verification_message = $3, updated_at = now()
       WHERE connection_id = $4 AND user_id = $5 AND revoked_at IS NULL
       RETURNING ${SAFE_CONNECTION_COLUMNS}`,
      [verification.status, verification.verifiedAt, verification.message, connectionId, userId],
    );
    if (!result.rows[0]) return null;
    await replaceConnectionBindings(client, userId, connectionId, verification.bindings || []);
    return parseSafeConnectionRow(result.rows[0]);
  }, dependencies.pool);
}

async function saveVerificationFailure(userId, connectionId, failure, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    await client.query(
      `UPDATE public.capability_bindings
       SET status = 'disabled', updated_at = now()
       WHERE user_id = $1 AND connection_id = $2`,
      [userId, connectionId],
    );
    const result = await client.query(
      `UPDATE public.provider_connections
       SET status = 'error', verification_error_code = $1,
           verification_message = $2, updated_at = now()
       WHERE connection_id = $3 AND user_id = $4 AND revoked_at IS NULL
       RETURNING ${SAFE_CONNECTION_COLUMNS}`,
      [failure.code, failure.message, connectionId, userId],
    );
    return result.rows[0] ? parseSafeConnectionRow(result.rows[0]) : null;
  }, dependencies.pool);
}

async function listCapabilityBindings(userId, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    const result = await client.query(
      `SELECT cb.connection_id AS "connectionId", pc.provider_id AS "providerId",
              cb.model_id AS "modelId", cb.capability_id AS "capabilityId",
              cb.channel, cb.request_profile AS "requestProfile", cb.status,
              cb.constraints_json AS constraints, cb.updated_at AS "updatedAt"
       FROM public.capability_bindings cb
       JOIN public.provider_connections pc
         ON pc.user_id = cb.user_id AND pc.connection_id = cb.connection_id
       WHERE cb.user_id = $1 AND pc.revoked_at IS NULL
       ORDER BY cb.updated_at DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      ...row,
      constraints: row.constraints || {},
      updatedAt: toIsoString(row.updatedAt),
    }));
  }, dependencies.pool);
}

/** Quote routing reads only an already verified binding and never selects from another owner. */
async function getVerifiedRouteBinding(userId, selection, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    const result = await client.query(
      `SELECT pc.connection_id AS "connectionId", pc.provider_id AS "providerId",
              pc.endpoint_url AS endpoint, cb.model_id AS "modelId",
              cb.capability_id AS "capabilityId", cb.channel,
              cb.request_profile AS "requestProfile",
              pc.updated_at AS "connectionUpdatedAt", cb.updated_at AS "bindingUpdatedAt"
       FROM public.provider_connections pc
       JOIN public.capability_bindings cb
         ON cb.user_id = pc.user_id AND cb.connection_id = pc.connection_id
       WHERE pc.user_id = $1 AND pc.connection_id = $2
         AND cb.model_id = $3 AND cb.capability_id = $4
         AND ($5::text IS NULL OR cb.channel = $5)
         AND pc.status = 'available' AND cb.status = 'active' AND pc.revoked_at IS NULL
       ORDER BY cb.updated_at DESC LIMIT 1`,
      [userId, selection.connectionId, selection.model, selection.capabilityId, selection.preferredChannel || null],
    );
    if (!result.rows[0]) return null;
    return {
      ...result.rows[0],
      connectionUpdatedAt: toIsoString(result.rows[0].connectionUpdatedAt),
      bindingUpdatedAt: toIsoString(result.rows[0].bindingUpdatedAt),
    };
  }, dependencies.pool);
}

/** Automatic Quote selection filters healthy bindings, then honors owner priority. */
async function selectVerifiedRouteBinding(userId, selection, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    const result = await client.query(
      `SELECT pc.connection_id AS "connectionId", pc.provider_id AS "providerId",
              pc.endpoint_url AS endpoint, pc.routing_priority AS "routingPriority",
              cb.model_id AS "modelId", cb.capability_id AS "capabilityId", cb.channel,
              cb.request_profile AS "requestProfile",
              pc.updated_at AS "connectionUpdatedAt", cb.updated_at AS "bindingUpdatedAt"
       FROM public.provider_connections pc
       JOIN public.capability_bindings cb
         ON cb.user_id = pc.user_id AND cb.connection_id = pc.connection_id
       WHERE pc.user_id = $1
         AND cb.model_id = $2 AND cb.capability_id = $3
         AND ($4::text IS NULL OR cb.channel = $4)
         AND pc.status = 'available' AND cb.status = 'active' AND pc.revoked_at IS NULL
       ORDER BY pc.routing_priority ASC, cb.updated_at DESC, pc.connection_id
       LIMIT 1`,
      [userId, selection.model, selection.capabilityId, selection.preferredChannel || null],
    );
    if (!result.rows[0]) return null;
    return {
      ...result.rows[0],
      connectionUpdatedAt: toIsoString(result.rows[0].connectionUpdatedAt),
      bindingUpdatedAt: toIsoString(result.rows[0].bindingUpdatedAt),
    };
  }, dependencies.pool);
}

/** Execution rechecks every frozen route field before encrypted credential material can be read. */
async function getConnectionExecutionRecord(userId, snapshot, dependencies = {}) {
  return withUserScopedClient(userId, async (client) => {
    const result = await client.query(
      `SELECT pc.connection_id AS "connectionId", pc.provider_id AS "providerId",
              pc.endpoint_url AS endpoint, pc.secret_ref AS "secretRef",
              pc.updated_at AS "connectionUpdatedAt", cb.updated_at AS "bindingUpdatedAt",
              cb.model_id AS "modelId", cb.capability_id AS "capabilityId",
              cb.channel, cb.request_profile AS "requestProfile"
       FROM public.provider_connections pc
       JOIN public.capability_bindings cb
         ON cb.user_id = pc.user_id AND cb.connection_id = pc.connection_id
       WHERE pc.user_id = $1 AND pc.connection_id = $2 AND pc.provider_id = $3
         AND cb.model_id = $4 AND cb.capability_id = $5
         AND cb.channel = $6 AND cb.request_profile = $7
         AND pc.status = 'available' AND cb.status = 'active' AND pc.revoked_at IS NULL
       LIMIT 1`,
      [userId, snapshot.connectionId, snapshot.providerId, snapshot.modelId,
        snapshot.capabilityId, snapshot.channel, snapshot.requestProfile],
    );
    if (!result.rows[0]) return null;
    return {
      ...result.rows[0],
      connectionUpdatedAt: toIsoString(result.rows[0].connectionUpdatedAt),
      bindingUpdatedAt: toIsoString(result.rows[0].bindingUpdatedAt),
    };
  }, dependencies.pool);
}

module.exports = {
  createProviderConnection,
  deleteProviderConnection,
  getConnectionExecutionRecord,
  getProviderConnectionSecretRecord,
  getVerifiedRouteBinding,
  listCapabilityBindings,
  listProviderConnections,
  listProviderConnectionsWithRevision,
  reorderProviderConnections,
  saveVerificationFailure,
  saveVerificationResult,
  selectVerifiedRouteBinding,
  updateProviderConnection,
  withUserScopedClient,
};
