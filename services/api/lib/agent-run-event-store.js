const { getPool } = require('./db');
const { mapAgentRunEventRow } = require('./ai-assistant-dto');

const RUN_EVENT_LIST_LIMIT = 100;

/**
 * Reads one metadata-only event page while resolving Run ownership in the same query.
 */
async function listAgentRunEvents(
  ownerId,
  runId,
  afterSequence = 0,
  { client = getPool() } = {},
) {
  const result = await client.query(
    `SELECT
       owned_run.id AS owned_run_id,
       event.run_id,
       event.sequence,
       event.event_type,
       event.status,
       event.run_updated_at,
       event.created_at,
       event.step_id,
       event.tool_name,
       event.outcome,
       event.verification_rule,
       event.retryable,
       event.verified_at
     FROM (
       SELECT id
         FROM public.agent_runs
        WHERE id = $1 AND user_id = $2
        LIMIT 1
     ) AS owned_run
     LEFT JOIN LATERAL (
       SELECT
         run_id, sequence, event_type, status, run_updated_at, created_at,
         step_id, tool_name, outcome, verification_rule, retryable, verified_at
        FROM public.agent_run_events AS event
        WHERE event.run_id = owned_run.id
          AND event.sequence > $3
        ORDER BY event.sequence ASC
        LIMIT $4
     ) AS event ON true
     ORDER BY event.sequence ASC`,
    [runId, ownerId, afterSequence, RUN_EVENT_LIST_LIMIT],
  );
  if (result.rows.length === 0) return null;
  return result.rows
    .filter((row) => row.sequence != null)
    .map(mapAgentRunEventRow);
}

module.exports = {
  listAgentRunEvents,
};
