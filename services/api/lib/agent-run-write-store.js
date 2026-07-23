const { getPool } = require('./db');
const { mapAgentRunRow } = require('./ai-assistant-dto');

const RUN_UPSERT_SQL = `
  WITH accepted_session AS (
    SELECT NULL::text AS session_id WHERE $9::text IS NULL
    UNION ALL
    SELECT session.id
      FROM public.agent_sessions AS session
     WHERE session.id = $9
       AND session.user_id = $2
  )
  INSERT INTO public.agent_runs AS current_run (
    id, user_id, user_message, intent, plan, status, step_results, updated_at, session_id
  )
  SELECT $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, accepted_session.session_id
    FROM accepted_session
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    plan = EXCLUDED.plan,
    step_results = EXCLUDED.step_results,
    updated_at = EXCLUDED.updated_at,
    session_id = COALESCE(current_run.session_id, EXCLUDED.session_id)
  WHERE current_run.user_id = EXCLUDED.user_id
    AND current_run.updated_at <= EXCLUDED.updated_at
    AND (
      EXCLUDED.session_id IS NULL
      OR current_run.session_id IS NULL
      OR current_run.session_id = EXCLUDED.session_id
    )
    AND (
      current_run.plan = EXCLUDED.plan
      OR current_run.replan_count < 3
    )
  RETURNING *`;

const runParams = (ownerId, input, sessionId) => [
  input.id,
  ownerId,
  input.userMessage,
  input.intent,
  JSON.stringify(input.plan),
  input.status,
  JSON.stringify(input.stepResults || []),
  input.updatedAt || new Date().toISOString(),
  sessionId,
];

async function classifyRejectedRun(client, ownerId, runId, sessionId) {
  const result = await client.query(
    'SELECT * FROM public.agent_runs WHERE id = $1 LIMIT 1',
    [runId],
  );
  const existing = result.rows[0];
  if (existing && existing.user_id !== ownerId) return { outcome: 'ownership_conflict' };
  if (sessionId && existing?.session_id && existing.session_id !== sessionId) {
    return { outcome: 'binding_conflict' };
  }
  if (sessionId && !existing?.session_id) {
    const session = await client.query(
      'SELECT id FROM public.agent_sessions WHERE id = $1 AND user_id = $2 LIMIT 1',
      [sessionId, ownerId],
    );
    if (!session.rows[0]) return { outcome: 'session_conflict' };
  }
  if (!existing) return { outcome: 'ownership_conflict' };
  return { outcome: 'stale', data: mapAgentRunRow(existing) };
}

/** Upserts a Run while accepting only an owned Session and never changing an established binding. */
async function upsertAgentRun(ownerId, input, { client = getPool() } = {}) {
  const sessionId = String(input.sessionId || '').trim() || null;
  const result = await client.query(RUN_UPSERT_SQL, runParams(ownerId, input, sessionId));
  if (result.rows[0]) return { outcome: 'accepted', data: mapAgentRunRow(result.rows[0]) };
  return classifyRejectedRun(client, ownerId, input.id, sessionId);
}

module.exports = {
  upsertAgentRun,
};
