const { getPool } = require('./db');
const { mapAgentRunRow, mapAgentToolCallRow } = require('./ai-assistant-dto');

const RUN_LIST_LIMIT = 50;

function groupToolCallsByRun(rows) {
  const groupedCalls = new Map();
  for (const row of rows) {
    const calls = groupedCalls.get(row.run_id) || [];
    calls.push(mapAgentToolCallRow(row));
    groupedCalls.set(row.run_id, calls);
  }
  return groupedCalls;
}

async function readToolCalls(client, runIds) {
  if (runIds.length === 0) return new Map();
  const result = await client.query(
    `SELECT *
       FROM public.agent_tool_calls
      WHERE run_id = ANY($1::text[])
      ORDER BY started_at ASC, id ASC`,
    [runIds],
  );
  return groupToolCallsByRun(result.rows);
}

/**
 * 按 owner 读取最近的 Agent Run，并批量装配工具调用以避免 N+1 查询。
 */
async function listAgentRuns(ownerId, { client = getPool() } = {}) {
  const result = await client.query(
    `SELECT *
       FROM public.agent_runs
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT $2`,
    [ownerId, RUN_LIST_LIMIT],
  );
  const toolCallsByRun = await readToolCalls(client, result.rows.map((row) => row.id));
  return result.rows.map((row) => mapAgentRunRow(row, toolCallsByRun.get(row.id) || []));
}

/**
 * 使用 run id 与 owner 双重约束读取单条 Agent Run，避免跨用户枚举。
 */
async function getAgentRun(ownerId, runId, { client = getPool() } = {}) {
  const result = await client.query(
    `SELECT *
       FROM public.agent_runs
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [runId, ownerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const toolCallsByRun = await readToolCalls(client, [row.id]);
  return mapAgentRunRow(row, toolCallsByRun.get(row.id) || []);
}

module.exports = {
  listAgentRuns,
  getAgentRun,
};
