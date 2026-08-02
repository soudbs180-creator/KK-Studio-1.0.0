const crypto = require('crypto');
const { PairedRuntimeExecutionEnvelopeSchema } = require('@kk/shared');
const { getPool } = require('./db');

const CREDENTIAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LEASE_TTL_MS = 30 * 1000;

function getCredentialPepper() {
  const pepper = process.env.PAIRED_RUNTIME_CREDENTIAL_PEPPER;
  if (pepper) return pepper;
  if (process.env.NODE_ENV === 'test') return 'paired-runtime-test-pepper';
  throw new Error('PAIRED_RUNTIME_CREDENTIAL_PEPPER is required.');
}

function hashSecret(secret) {
  return crypto.createHmac('sha256', getCredentialPepper()).update(secret).digest('hex');
}

function safeHashEqual(actualHash, expectedHash) {
  const actual = Buffer.from(String(actualHash || ''), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && actual.length > 0 && crypto.timingSafeEqual(actual, expected);
}

async function registerRuntime(ownerId, input, { client = getPool() } = {}) {
  const runtimeId = crypto.randomUUID();
  const credential = crypto.randomBytes(32).toString('base64url');
  const credentialExpiresAt = new Date(Date.now() + CREDENTIAL_TTL_MS).toISOString();
  await client.query(
    `INSERT INTO public.paired_runtimes (
       id, user_id, display_name, credential_hash, credential_expires_at,
       capability_manifest, status, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb, 'offline', now(), now())`,
    [
      runtimeId,
      ownerId,
      input.displayName,
      hashSecret(credential),
      credentialExpiresAt,
      JSON.stringify(input.capabilityManifest),
    ],
  );
  return { runtimeId, credential, credentialExpiresAt };
}

async function authenticateRuntime(runtimeId, credential, { client = getPool() } = {}) {
  const result = await client.query(
    `SELECT * FROM public.paired_runtimes WHERE id = $1 LIMIT 1`,
    [runtimeId],
  );
  const runtime = result.rows[0];
  if (!runtime || runtime.revoked_at || new Date(runtime.credential_expires_at).getTime() <= Date.now()) {
    return null;
  }
  return safeHashEqual(hashSecret(credential), runtime.credential_hash) ? runtime : null;
}

async function heartbeatRuntime(runtimeId, credential, input, { client = getPool() } = {}) {
  const runtime = await authenticateRuntime(runtimeId, credential, { client });
  if (!runtime) return null;
  const result = await client.query(
    `UPDATE public.paired_runtimes
        SET capability_manifest = $3::jsonb,
            status = 'online',
            last_heartbeat_at = $4::timestamptz,
            updated_at = now()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
      RETURNING id, user_id, status, last_heartbeat_at`,
    [runtimeId, runtime.user_id, JSON.stringify(input.capabilityManifest), input.observedAt],
  );
  return result.rows[0] || null;
}

async function enqueueAgentRunCommand(ownerId, run, { client = getPool() } = {}) {
  if (run.executionTarget !== 'paired-desktop' || !run.pairedRuntimeId) return null;
  const parsedEnvelope = PairedRuntimeExecutionEnvelopeSchema.safeParse(run.plan?.pairedExecution);
  if (!parsedEnvelope.success || parsedEnvelope.data.runId !== run.id) {
    const error = new Error('Paired desktop runs require a strict, matching pairedExecution envelope.');
    error.code = 'INVALID_PAIRED_RUNTIME_ENVELOPE';
    error.statusCode = 400;
    throw error;
  }
  const result = await client.query(
    `INSERT INTO public.paired_runtime_commands (
       id, user_id, runtime_id, run_id, idempotency_key, command_envelope, status
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'queued')
     ON CONFLICT (user_id, idempotency_key) DO UPDATE
       SET updated_at = public.paired_runtime_commands.updated_at
     RETURNING *`,
    [
      crypto.randomUUID(),
      ownerId,
      run.pairedRuntimeId,
      run.id,
      `agent-run:${run.id}`,
      JSON.stringify(parsedEnvelope.data),
    ],
  );
  return result.rows[0] || null;
}

async function claimRuntimeCommand(runtimeId, credential, { pool = getPool() } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runtime = await authenticateRuntime(runtimeId, credential, { client });
    if (!runtime) {
      await client.query('ROLLBACK');
      return { outcome: 'unauthorized' };
    }
    const pending = await client.query(
      `SELECT * FROM public.paired_runtime_commands
        WHERE runtime_id = $1
          AND user_id = $2
          AND (
            status = 'queued'
            OR (status = 'leased' AND leased_until <= now())
          )
        ORDER BY created_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
      [runtimeId, runtime.user_id],
    );
    if (!pending.rows[0]) {
      await client.query(
        `UPDATE public.paired_runtimes
            SET status = 'online', last_heartbeat_at = now(), updated_at = now()
          WHERE id = $1 AND user_id = $2`,
        [runtimeId, runtime.user_id],
      );
      await client.query('COMMIT');
      return { outcome: 'empty' };
    }
    const leaseToken = crypto.randomBytes(32).toString('base64url');
    const leaseExpiresAt = new Date(Date.now() + LEASE_TTL_MS).toISOString();
    const updated = await client.query(
      `UPDATE public.paired_runtime_commands
          SET status = 'leased',
              lease_token_hash = $2,
              leased_until = $3::timestamptz,
              attempt_count = attempt_count + 1,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [pending.rows[0].id, hashSecret(leaseToken), leaseExpiresAt],
    );
    await client.query('COMMIT');
    const command = updated.rows[0];
    return {
      outcome: 'claimed',
      data: {
        commandId: command.id,
        runId: command.run_id,
        kind: 'agent_run',
        leaseToken,
        leaseExpiresAt,
        attempt: Number(command.attempt_count),
        executionEnvelope: command.command_envelope,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function completeRuntimeCommand(
  runtimeId,
  commandId,
  credential,
  input,
  { client = getPool() } = {},
) {
  const runtime = await authenticateRuntime(runtimeId, credential, { client });
  if (!runtime) return { outcome: 'unauthorized' };
  const commandResult = await client.query(
    `SELECT * FROM public.paired_runtime_commands
      WHERE id = $1 AND runtime_id = $2 AND user_id = $3
      LIMIT 1`,
    [commandId, runtimeId, runtime.user_id],
  );
  const command = commandResult.rows[0];
  if (!command) return { outcome: 'not_found' };
  if (['completed', 'failed'].includes(command.status)) {
    return { outcome: 'idempotent', data: command };
  }
  const validLease = command.status === 'leased'
    && new Date(command.leased_until).getTime() > Date.now()
    && safeHashEqual(hashSecret(input.leaseToken), command.lease_token_hash);
  if (!validLease) return { outcome: 'lease_conflict' };
  const result = await client.query(
    `WITH completed_command AS (
       UPDATE public.paired_runtime_commands
          SET status = $4,
              result_summary = $5,
              error_code = $6,
              completed_at = now(),
              updated_at = now()
        WHERE id = $1 AND runtime_id = $2 AND user_id = $3
        RETURNING *
     )
     UPDATE public.agent_runs
        SET status = CASE WHEN $4 = 'completed' THEN 'completed' ELSE 'failed' END,
            updated_at = now()
      WHERE id = (SELECT run_id FROM completed_command)
        AND user_id = $3
      RETURNING id`,
    [
      commandId,
      runtimeId,
      runtime.user_id,
      input.status,
      input.resultSummary || null,
      input.errorCode || null,
    ],
  );
  return result.rows[0] ? { outcome: 'accepted' } : { outcome: 'not_found' };
}

module.exports = {
  authenticateRuntime,
  claimRuntimeCommand,
  completeRuntimeCommand,
  enqueueAgentRunCommand,
  heartbeatRuntime,
  registerRuntime,
};
