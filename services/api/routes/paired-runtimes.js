const express = require('express');
const {
  CompletePairedRuntimeCommandRequestSchema,
  PairedRuntimeHeartbeatRequestSchema,
  RegisterPairedRuntimeRequestSchema,
} = require('@kk/shared');
const { verifyJWT } = require('../lib/jwt');
const pairedRuntimeStore = require('../lib/paired-runtime-store');

const router = express.Router();
const CREDENTIAL_HEADER = 'x-kk-runtime-credential';

function readCredential(req) {
  return String(req.headers[CREDENTIAL_HEADER] || '').trim();
}

function requireOwner(req, res, next) {
  const ownerId = verifyJWT(req.headers.authorization);
  if (!ownerId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
  req.userId = ownerId;
  return next();
}

router.post('/v1/paired-runtimes', requireOwner, async (req, res) => {
  const parsed = RegisterPairedRuntimeRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_RUNTIME', message: 'Invalid paired runtime payload.' } });
  try {
    const runtime = await pairedRuntimeStore.registerRuntime(req.userId, parsed.data);
    return res.status(201).json({ success: true, data: runtime });
  } catch (error) {
    return res.status(503).json({ error: { code: 'RUNTIME_REGISTRATION_UNAVAILABLE', message: error.message } });
  }
});

router.post('/v1/paired-runtimes/:runtimeId/heartbeat', async (req, res) => {
  const parsed = PairedRuntimeHeartbeatRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_HEARTBEAT', message: 'Invalid heartbeat payload.' } });
  try {
    const runtime = await pairedRuntimeStore.heartbeatRuntime(
      req.params.runtimeId,
      readCredential(req),
      parsed.data,
    );
    if (!runtime) return res.status(401).json({ error: { code: 'INVALID_RUNTIME_CREDENTIAL', message: 'Runtime credential is invalid, expired, or revoked.' } });
    return res.json({
      success: true,
      data: {
        runtimeId: runtime.id,
        status: runtime.status,
        lastHeartbeatAt: runtime.last_heartbeat_at instanceof Date
          ? runtime.last_heartbeat_at.toISOString()
          : String(runtime.last_heartbeat_at),
      },
    });
  } catch (error) {
    return res.status(503).json({ error: { code: 'RUNTIME_HEARTBEAT_UNAVAILABLE', message: error.message } });
  }
});

router.post('/v1/paired-runtimes/:runtimeId/commands/claim', async (req, res) => {
  try {
    const outcome = await pairedRuntimeStore.claimRuntimeCommand(
      req.params.runtimeId,
      readCredential(req),
    );
    if (outcome.outcome === 'unauthorized') return res.status(401).json({ error: { code: 'INVALID_RUNTIME_CREDENTIAL', message: 'Runtime credential is invalid, expired, or revoked.' } });
    return res.json({ success: true, data: outcome.outcome === 'claimed' ? outcome.data : null });
  } catch (error) {
    return res.status(503).json({ error: { code: 'RUNTIME_COMMAND_CLAIM_UNAVAILABLE', message: error.message } });
  }
});

router.post('/v1/paired-runtimes/:runtimeId/commands/:commandId/result', async (req, res) => {
  const parsed = CompletePairedRuntimeCommandRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_COMMAND_RESULT', message: 'Invalid paired runtime result.' } });
  try {
    const outcome = await pairedRuntimeStore.completeRuntimeCommand(
      req.params.runtimeId,
      req.params.commandId,
      readCredential(req),
      parsed.data,
    );
    if (outcome.outcome === 'unauthorized') return res.status(401).json({ error: { code: 'INVALID_RUNTIME_CREDENTIAL', message: 'Runtime credential is invalid, expired, or revoked.' } });
    if (outcome.outcome === 'not_found') return res.status(404).json({ error: { code: 'COMMAND_NOT_FOUND', message: 'Paired runtime command was not found.' } });
    if (outcome.outcome === 'lease_conflict') return res.status(409).json({ error: { code: 'COMMAND_LEASE_CONFLICT', message: 'Command lease expired or does not match.' } });
    return res.json({ success: true, data: { accepted: true, idempotent: outcome.outcome === 'idempotent' } });
  } catch (error) {
    return res.status(503).json({ error: { code: 'RUNTIME_COMMAND_RESULT_UNAVAILABLE', message: error.message } });
  }
});

module.exports = router;
