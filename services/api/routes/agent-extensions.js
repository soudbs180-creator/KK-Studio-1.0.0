const express = require('express');
const {
  AgentExtensionTypeSchema,
  UpsertAgentExtensionRequestSchema,
} = require('@kk/shared');
const { getPool } = require('../lib/db');
const { wrapError, wrapSuccess } = require('../lib/generation/generationResponseEnvelope');
const { verifyJWT } = require('../lib/jwt');

const router = express.Router();

function responseMeta(req) {
  return { requestId: req.headers['x-request-id'], surface: 'agent-extensions' };
}

function sendError(req, res, status, code, message) {
  return res.status(status).json(wrapError({ code, message, statusCode: status }, responseMeta(req)));
}

function requireOwner(req, res, next) {
  const ownerId = verifyJWT(req.headers.authorization);
  if (!ownerId) {
    return sendError(req, res, 401, 'UNAUTHORIZED', 'Authentication required.');
  }
  req.userId = ownerId;
  return next();
}

function toIso(value) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Reconstructs the public manifest without ever resolving or returning a secret value. */
function mapExtensionRow(row) {
  const storedManifest = row.manifest && typeof row.manifest === 'object' ? row.manifest : {};
  return {
    id: row.id,
    type: row.extension_type,
    manifest: {
      schemaVersion: 1,
      key: row.manifest_key,
      displayName: row.display_name,
      ...(storedManifest.description ? { description: storedManifest.description } : {}),
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
      ...(row.secret_ref ? { secretRef: row.secret_ref } : {}),
      ...(storedManifest.configuration ? { configuration: storedManifest.configuration } : {}),
    },
    enabled: Boolean(row.enabled),
    importSource: row.import_source,
    ...(row.legacy_readonly_until ? { legacyReadonlyUntil: toIso(row.legacy_readonly_until) } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

router.get('/v1/agent-extensions', requireOwner, async (req, res) => {
  const parsedType = req.query.type === undefined
    ? { success: true, data: undefined }
    : AgentExtensionTypeSchema.safeParse(req.query.type);
  if (!parsedType.success) {
    return sendError(req, res, 400, 'INVALID_EXTENSION_TYPE', 'Unknown agent extension type.');
  }

  try {
    const result = await getPool().query(
      `SELECT * FROM public.agent_extensions
        WHERE user_id = $1
          AND ($2::text IS NULL OR extension_type = $2)
        ORDER BY extension_type ASC, updated_at DESC, id ASC
        LIMIT 200`,
      [req.userId, parsedType.data || null],
    );
    return res.json(wrapSuccess(result.rows.map(mapExtensionRow), responseMeta(req)));
  } catch {
    return sendError(req, res, 503, 'AGENT_EXTENSIONS_UNAVAILABLE', 'Agent extensions are temporarily unavailable.');
  }
});

router.put('/v1/agent-extensions/:extensionId', requireOwner, async (req, res) => {
  const parsed = UpsertAgentExtensionRequestSchema.safeParse({
    ...req.body,
    id: req.params.extensionId,
  });
  if (!parsed.success) {
    return sendError(req, res, 400, 'INVALID_AGENT_EXTENSION', 'Agent extension manifest is invalid.');
  }

  const { id, type, manifest, enabled } = parsed.data;
  const pool = getPool();
  try {
    const idOwner = await pool.query(
      'SELECT user_id FROM public.agent_extensions WHERE id = $1 LIMIT 1',
      [id],
    );
    if (idOwner.rows[0] && idOwner.rows[0].user_id !== req.userId) {
      return sendError(req, res, 409, 'EXTENSION_OWNERSHIP_CONFLICT', 'Agent extension id belongs to another owner.');
    }
    const result = await pool.query(
      `INSERT INTO public.agent_extensions (
         id, user_id, extension_type, manifest_key, display_name, manifest,
         permissions, secret_ref, enabled, import_source, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, 'user', now(), now())
       ON CONFLICT (user_id, extension_type, manifest_key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         manifest = EXCLUDED.manifest,
         permissions = EXCLUDED.permissions,
         secret_ref = EXCLUDED.secret_ref,
         enabled = EXCLUDED.enabled,
         updated_at = now()
       RETURNING *`,
      [
        id,
        req.userId,
        type,
        manifest.key,
        manifest.displayName,
        JSON.stringify({
          schemaVersion: manifest.schemaVersion,
          ...(manifest.description ? { description: manifest.description } : {}),
          ...(manifest.configuration ? { configuration: manifest.configuration } : {}),
        }),
        JSON.stringify(manifest.permissions),
        manifest.secretRef || null,
        enabled,
      ],
    );
    return res.json(wrapSuccess(mapExtensionRow(result.rows[0]), responseMeta(req)));
  } catch {
    return sendError(req, res, 503, 'AGENT_EXTENSION_WRITE_UNAVAILABLE', 'Agent extension could not be saved.');
  }
});

router.delete('/v1/agent-extensions/:extensionId', requireOwner, async (req, res) => {
  try {
    const result = await getPool().query(
      `DELETE FROM public.agent_extensions
        WHERE id = $1
          AND user_id = $2
          AND NOT (
            import_source = 'local-import'
            AND legacy_readonly_until IS NOT NULL
            AND legacy_readonly_until > now()
          )
        RETURNING id`,
      [req.params.extensionId, req.userId],
    );
    if (!result.rows[0]) {
      return sendError(req, res, 404, 'EXTENSION_NOT_DELETABLE', 'Agent extension was not found or is still in its read-only compatibility window.');
    }
    return res.json(wrapSuccess({ id: result.rows[0].id, deleted: true }, responseMeta(req)));
  } catch {
    return sendError(req, res, 503, 'AGENT_EXTENSION_DELETE_UNAVAILABLE', 'Agent extension could not be deleted.');
  }
});

module.exports = router;
