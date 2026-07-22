const { getPool } = require('./db');
const {
  mapAgentContextSnapshotRow,
  mapAgentSessionListRow,
  mapAgentSessionRow,
} = require('./ai-assistant-dto');
const {
  AgentContextSnapshotDtoSchema,
  AgentSessionDtoSchema,
  AgentSessionListItemDtoSchema,
} = require('@kk/shared');

const SESSION_LIST_LIMIT = 50;

const UPSERT_SESSION_SQL = `
  WITH upserted AS (
    INSERT INTO public.agent_sessions (
      id, user_id, collaboration_mode, messages, summary, tool_results,
      knowledge_refs, token_budget, confirmations, checkpoints,
      last_heartbeat_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb,
      $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb,
      $11::timestamptz, $12::timestamptz, $13::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      collaboration_mode = EXCLUDED.collaboration_mode,
      messages = EXCLUDED.messages,
      summary = EXCLUDED.summary,
      tool_results = EXCLUDED.tool_results,
      knowledge_refs = EXCLUDED.knowledge_refs,
      token_budget = EXCLUDED.token_budget,
      confirmations = EXCLUDED.confirmations,
      checkpoints = EXCLUDED.checkpoints,
      last_heartbeat_at = GREATEST(
        public.agent_sessions.last_heartbeat_at,
        EXCLUDED.last_heartbeat_at
      ),
      updated_at = EXCLUDED.updated_at
    WHERE public.agent_sessions.user_id = EXCLUDED.user_id
      AND public.agent_sessions.updated_at <= EXCLUDED.updated_at
    RETURNING public.agent_sessions.*, false AS stale
  ), authoritative AS (
    SELECT session.*, true AS stale
      FROM public.agent_sessions AS session
     WHERE session.id = $1
       AND session.user_id = $2
       AND NOT EXISTS (SELECT 1 FROM upserted)
  )
  SELECT * FROM upserted
  UNION ALL
  SELECT * FROM authoritative
  LIMIT 1`;

const APPEND_CONTEXT_SNAPSHOT_SQL = `
  WITH owned_session AS (
    SELECT id
      FROM public.agent_sessions AS session
     WHERE session.id = $2 AND session.user_id = $3
  ), inserted AS (
    INSERT INTO public.agent_context_snapshots (
      snapshot_id, session_id, snapshot_data, captured_at
    )
    SELECT $1, owned_session.id, $4::jsonb, $5::timestamptz
      FROM owned_session
    ON CONFLICT (snapshot_id) DO NOTHING
    RETURNING public.agent_context_snapshots.*, false AS stale
  ), existing AS (
    SELECT snapshot.*, true AS stale
      FROM public.agent_context_snapshots AS snapshot
      JOIN owned_session ON owned_session.id = snapshot.session_id
     WHERE snapshot.snapshot_id = $1
       AND snapshot.session_id = $2
       AND NOT EXISTS (SELECT 1 FROM inserted)
  )
  SELECT * FROM inserted
  UNION ALL
  SELECT * FROM existing
  LIMIT 1`;

/** Returns bounded Session headers for one authenticated owner. */
async function listAgentSessions(ownerId, { client = getPool() } = {}) {
  const result = await client.query(
    `SELECT id, user_id, collaboration_mode, jsonb_array_length(messages) AS message_count,
            last_heartbeat_at, created_at, updated_at
       FROM public.agent_sessions
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT $2`,
    [ownerId, SESSION_LIST_LIMIT],
  );
  return result.rows.map((row) => AgentSessionListItemDtoSchema.parse(mapAgentSessionListRow(row)));
}

/** Reads one full Session only when both id and owner match. */
async function getAgentSession(ownerId, sessionId, { client = getPool() } = {}) {
  const result = await client.query(
    `SELECT * FROM public.agent_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [sessionId, ownerId],
  );
  return result.rows[0] ? AgentSessionDtoSchema.parse(mapAgentSessionRow(result.rows[0])) : null;
}

/** Upserts a versioned Session while returning the current row for stale same-owner writes. */
async function upsertAgentSession(ownerId, input, { client = getPool() } = {}) {
  const params = [
    input.sessionId, ownerId, input.collaborationMode, JSON.stringify(input.messages),
    JSON.stringify(input.summary), JSON.stringify(input.toolResults),
    JSON.stringify(input.knowledgeRefs), JSON.stringify(input.tokenBudget),
    JSON.stringify(input.confirmations), JSON.stringify(input.checkpoints),
    input.lastHeartbeatAt, input.createdAt, input.updatedAt,
  ];
  const result = await client.query(UPSERT_SESSION_SQL, params);
  const row = result.rows[0];
  return row ? {
    data: AgentSessionDtoSchema.parse(mapAgentSessionRow(row)),
    stale: row.stale === true,
  } : null;
}

/** Appends or reuses an idempotent metadata-only Context Snapshot for an owned Session. */
async function appendAgentContextSnapshot(ownerId, sessionId, input, { client = getPool() } = {}) {
  const { snapshotId, capturedAt, ...snapshotData } = input;
  const result = await client.query(APPEND_CONTEXT_SNAPSHOT_SQL, [
    snapshotId, sessionId, ownerId, JSON.stringify(snapshotData), capturedAt,
  ]);
  const row = result.rows[0];
  return row ? {
    data: AgentContextSnapshotDtoSchema.parse(mapAgentContextSnapshotRow(row)),
    stale: row.stale === true,
  } : null;
}

/** Distinguishes a missing owner Session from an owned Session without snapshots. */
async function getLatestAgentContextSnapshot(ownerId, sessionId, { client = getPool() } = {}) {
  const result = await client.query(
    `SELECT owned_session.id AS owned_session_id, snapshot.*
       FROM (
         SELECT id FROM public.agent_sessions WHERE id = $1 AND user_id = $2 LIMIT 1
       ) AS owned_session
       LEFT JOIN LATERAL (
         SELECT * FROM public.agent_context_snapshots AS snapshot
          WHERE snapshot.session_id = owned_session.id
          ORDER BY snapshot.sequence DESC
          LIMIT 1
       ) AS snapshot ON true`,
    [sessionId, ownerId],
  );
  if (result.rows.length === 0) return undefined;
  return result.rows[0].snapshot_id
    ? AgentContextSnapshotDtoSchema.parse(mapAgentContextSnapshotRow(result.rows[0]))
    : null;
}

module.exports = {
  appendAgentContextSnapshot,
  getAgentSession,
  getLatestAgentContextSnapshot,
  listAgentSessions,
  upsertAgentSession,
};
