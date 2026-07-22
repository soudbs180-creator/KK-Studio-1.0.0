// services/api/routes/ai-assistant.js
// 职责：处理 AI 助手的运行日志、工具审计与知识库的后端读写同步，并实施强安全隔离鉴权。
// 遵守规范：所有注释使用中文，说明设计意图和安全机制。

const express = require('express');
const router = express.Router();
const { getPool } = require('../lib/db');
const {
  mapAgentToolCallRow,
  mapKnowledgeDocumentRow,
  mapAgentSkillRow,
} = require('../lib/ai-assistant-dto');
const { TEMP_USER_ID_HEADER } = require('./compat/compatHelper');
const { verifyJWT } = require('../lib/jwt');
const agentRunReadStore = require('../lib/agent-run-read-store');
const agentRunWriteStore = require('../lib/agent-run-write-store');
const agentRunEventStore = require('../lib/agent-run-event-store');
const agentSessionStore = require('../lib/agent-session-store');
const {
  AgentContextSnapshotInputDtoSchema,
  AgentSessionUpsertDtoSchema,
} = require('@kk/shared');

/**
 * 验证请求头中的 JWT 令牌，杜绝非法调用和越权审计。
 */
function verifyAuth(req, res, next) {
  const method = String(req.method || '').toUpperCase();
  const isJsonRequest = typeof req.is === 'function'
    ? Boolean(req.is('application/json'))
    : /^application\/json(?:\s*;|$)/i.test(String(req.headers?.['content-type'] || ''));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !isJsonRequest) {
    return res.status(415).json({ error: 'Unsupported media type', details: 'AI assistant mutations require application/json.' });
  }

  if (process.env.NODE_ENV === 'test') {
    req.userId = 'test-user';
    return next();
  }

  const authorization = String(req.headers.authorization || '').trim();
  const hasBearer = /^Bearer\s+\S+$/i.test(authorization);
  const hasLocalTempHeader = process.env.KKAI_LOCAL_ONLY === 'true'
    && Boolean(String(req.headers[TEMP_USER_ID_HEADER] || '').trim());
  if (authorization && !hasBearer) {
    return res.status(401).json({ error: 'Unauthorized', details: 'Malformed Authorization Bearer credential.' });
  }
  if (!authorization && !hasLocalTempHeader) {
    return res.status(401).json({ error: 'Unauthorized', details: 'AI assistant routes require Bearer authentication.' });
  }

  const localTempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  const userId = hasBearer
    ? verifyJWT(authorization)
    : hasLocalTempHeader && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(localTempUserId)
      ? localTempUserId
      : null;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', details: '未授权，请提供合法的 Authorization Bearer 凭据' });
  }

  req.userId = userId;
  next();
}

function parseAfterSequence(value) {
  if (value === undefined) return 0;
  if (Array.isArray(value)) return null;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return null;
  const sequence = Number(normalized);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

async function readAuthoritativeSkillState(pool, userId, skillName) {
  const result = await pool.query(
    `SELECT
       skill.*,
       version.updated_at AS authoritative_updated_at,
       version.deleted AS authoritative_deleted
     FROM public.agent_skill_versions AS version
     LEFT JOIN public.agent_skills AS skill
       ON skill.user_id = version.user_id
      AND skill.owner_scope = 'user'
      AND skill.name = version.skill_key
     WHERE version.user_id = $1
       AND version.skill_key = $2
     LIMIT 1`,
    [userId, skillName]
  );
  const row = result.rows[0];
  if (!row) return {};
  const authoritativeDeleted = row.authoritative_deleted === true;
  const authoritativeUpdatedAt = row.authoritative_updated_at instanceof Date
    ? row.authoritative_updated_at.toISOString()
    : String(row.authoritative_updated_at || '');
  return {
    authoritativeUpdatedAt: authoritativeUpdatedAt || undefined,
    authoritativeDeleted,
    data: !authoritativeDeleted && row.id ? mapAgentSkillRow(row) : undefined,
  };
}

/** 按认证 owner 返回最近的 Session 轻量投影，不展开消息正文。 */
router.get('/ai-assistant/sessions', verifyAuth, async (req, res) => {
  try {
    const sessions = await agentSessionStore.listAgentSessions(req.userId);
    return res.json({ ok: true, data: sessions });
  } catch (err) {
    console.error('[AI assistant] Failed to list Sessions:', err);
    return res.status(500).json({ error: 'Failed to list Agent Sessions' });
  }
});

/** 以 Session id 与认证 owner 双重约束读取完整权威记录。 */
router.get('/ai-assistant/sessions/:sessionId', verifyAuth, async (req, res) => {
  try {
    const session = await agentSessionStore.getAgentSession(req.userId, req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Agent session not found' });
    return res.json({ ok: true, data: session });
  } catch (err) {
    console.error('[AI assistant] Failed to read Session:', err);
    return res.status(500).json({ error: 'Failed to read Agent Session' });
  }
});

/** 校验严格共享契约后，以客户端 updatedAt 协调 Session 快照。 */
router.post('/ai-assistant/sessions', verifyAuth, async (req, res) => {
  const parsed = AgentSessionUpsertDtoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid Agent Session payload' });
  try {
    const outcome = await agentSessionStore.upsertAgentSession(req.userId, parsed.data);
    if (!outcome) return res.status(409).json({ error: 'Agent session ownership conflict' });
    return res.json({ ok: true, stale: outcome.stale, data: outcome.data });
  } catch (err) {
    console.error('[AI assistant] Failed to upsert Session:', err);
    return res.status(500).json({ error: 'Failed to upsert Agent Session' });
  }
});

/** 为 owned Session 追加幂等、无原始输入文本的上下文快照。 */
router.post('/ai-assistant/sessions/:sessionId/context-snapshots', verifyAuth, async (req, res) => {
  const parsed = AgentContextSnapshotInputDtoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid Agent Context Snapshot payload' });
  try {
    const outcome = await agentSessionStore.appendAgentContextSnapshot(
      req.userId,
      req.params.sessionId,
      parsed.data,
    );
    if (!outcome) return res.status(409).json({ error: 'Context snapshot ownership conflict' });
    return res.json({ ok: true, stale: outcome.stale, data: outcome.data });
  } catch (err) {
    console.error('[AI assistant] Failed to append Context Snapshot:', err);
    return res.status(500).json({ error: 'Failed to append Agent Context Snapshot' });
  }
});

/** 返回 owned Session 的最新上下文投影；尚无快照时 data 为 null。 */
router.get('/ai-assistant/sessions/:sessionId/context-snapshots/latest', verifyAuth, async (req, res) => {
  try {
    const snapshot = await agentSessionStore.getLatestAgentContextSnapshot(
      req.userId,
      req.params.sessionId,
    );
    if (snapshot === undefined) return res.status(404).json({ error: 'Agent session not found' });
    return res.json({ ok: true, data: snapshot });
  } catch (err) {
    console.error('[AI assistant] Failed to read Context Snapshot:', err);
    return res.status(500).json({ error: 'Failed to read Agent Context Snapshot' });
  }
});

/**
 * GET /api/ai-assistant/runs
 * 职责：按认证 owner 返回最近的 Agent Run 权威快照。
 */
router.get('/ai-assistant/runs', verifyAuth, async (req, res) => {
  try {
    const runs = await agentRunReadStore.listAgentRuns(req.userId);
    res.json({ ok: true, data: runs });
  } catch (err) {
    console.error('[后端AI助手] 读取 Runs 失败:', err);
    res.status(500).json({ error: '读取失败' });
  }
});

/**
 * GET /api/ai-assistant/runs/:runId
 * 职责：以 run id 与认证 owner 双重约束读取单条权威记录。
 */
router.get('/ai-assistant/runs/:runId', verifyAuth, async (req, res) => {
  try {
    const run = await agentRunReadStore.getAgentRun(req.userId, req.params.runId);
    if (!run) return res.status(404).json({ error: 'Agent run not found' });
    return res.json({ ok: true, data: run });
  } catch (err) {
    console.error('[后端AI助手] 读取 Run 失败:', err);
    return res.status(500).json({ error: '读取失败' });
  }
});

/**
 * GET /api/ai-assistant/runs/:runId/events
 * Returns bounded metadata-only events for incremental projection recovery.
 */
router.get('/ai-assistant/runs/:runId/events', verifyAuth, async (req, res) => {
  const afterSequence = parseAfterSequence(req.query.afterSequence);
  if (afterSequence === null) {
    return res.status(400).json({ error: 'afterSequence must be a non-negative safe integer' });
  }
  try {
    const events = await agentRunEventStore.listAgentRunEvents(
      req.userId,
      req.params.runId,
      afterSequence,
    );
    if (events === null) return res.status(404).json({ error: 'Agent run not found' });
    return res.json({ ok: true, data: events });
  } catch (err) {
    console.error('[AI assistant] Failed to read Agent Run events:', err);
    return res.status(500).json({ error: 'Failed to read Agent Run events' });
  }
});

/**
 * POST /api/ai-assistant/runs
 * 职责：同步持久化 Agent 运行计划记录，状态变化时自动更新。
 */
router.post('/ai-assistant/runs', verifyAuth, async (req, res) => {
  const {
    id, sessionId, userMessage, intent, plan, status,
    stepResults = [], updatedAt = new Date().toISOString(),
  } = req.body;
  if (!id || !userMessage || !intent || !plan || !status) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  if (sessionId !== undefined && (
    typeof sessionId !== 'string' || !sessionId.trim() || sessionId.trim().length > 200
  )) {
    return res.status(400).json({ error: 'Invalid Agent Session binding' });
  }

  try {
    const outcome = await agentRunWriteStore.upsertAgentRun(req.userId, {
      id, sessionId: sessionId?.trim(), userMessage, intent, plan, status, stepResults, updatedAt,
    });
    if (outcome.outcome === 'ownership_conflict') {
      return res.status(403).json({ error: 'Agent run ownership conflict' });
    }
    if (outcome.outcome === 'session_conflict') {
      return res.status(409).json({ error: 'Agent session ownership conflict' });
    }
    if (outcome.outcome === 'binding_conflict') {
      return res.status(409).json({ error: 'Agent run Session binding conflict' });
    }
    if (outcome.outcome === 'stale') {
      return res.json({ ok: true, stale: true, data: outcome.data });
    }
    return res.json({ ok: true, data: outcome.data });
  } catch (err) {
    console.error('[后端AI助手] 同步 Runs 失败:', err);
    res.status(500).json({ error: '同步失败' });
  }
});

/**
 * POST /api/ai-assistant/tool-calls
 * 职责：同步持久化工具审计调用日志。
 */
router.post('/ai-assistant/tool-calls', verifyAuth, async (req, res) => {
  const {
    id, runId, stepId, toolName, inputSummary, outputSummary, status, outcome,
    failureClass, errorCode, retryable, error, startedAt, completedAt, idempotencyKey
  } = req.body;
  if (!id || !runId || !toolName || !inputSummary || !status || !startedAt) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const pool = getPool();
  try {
    const ownedRun = await pool.query('SELECT id FROM public.agent_runs WHERE id = $1 AND user_id = $2', [runId, req.userId]);
    if (!ownedRun.rows[0]) return res.status(404).json({ error: 'Agent run not found' });
    const query = `
      INSERT INTO public.agent_tool_calls (
        id, run_id, step_id, tool_name, input_summary, output_summary, status, outcome,
        failure_class, error_code, retryable, error, started_at, completed_at, idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query(query, [
      id, runId, stepId, toolName, inputSummary, outputSummary, status, outcome,
      failureClass, errorCode, retryable, error, startedAt, completedAt, idempotencyKey
    ]);
    if (!result.rows[0]) {
      const existing = await pool.query(
        `SELECT tool_call.*, agent_run.user_id
         FROM public.agent_tool_calls AS tool_call
         JOIN public.agent_runs AS agent_run ON agent_run.id = tool_call.run_id
         WHERE tool_call.id = $1`,
        [id],
      );
      const existingCall = existing.rows[0];
      if (!existingCall || existingCall.user_id !== req.userId || existingCall.run_id !== runId) {
        return res.status(409).json({ error: 'Agent tool-call ownership conflict' });
      }
      return res.json({ ok: true, stale: true, data: mapAgentToolCallRow(existingCall) });
    }
    res.json({ ok: true, data: mapAgentToolCallRow(result.rows[0]) });
  } catch (err) {
    console.error('[后端AI助手] 同步 Tool-calls 失败:', err);
    res.status(500).json({ error: '同步失败' });
  }
});

/**
 * POST /api/ai-assistant/skills
 * 职责：同步/更新系统中的 Skill 手册。
 */
router.post('/ai-assistant/skills', verifyAuth, async (req, res) => {
  const {
    id, name, trigger, tools, steps, safety = [], validation = [], knowledgeUpdates = [], updatedAt,
  } = req.body;
  if (!id || !name || !trigger || !tools || !steps || !updatedAt || !Number.isFinite(Date.parse(updatedAt))) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  const clientUpdatedAt = new Date(Date.parse(updatedAt)).toISOString();

  const pool = getPool();
  try {
    const existingSkillResult = await pool.query(
      `SELECT id, name, user_id, owner_scope
       FROM public.agent_skills
       WHERE id = $1`,
      [id]
    );
    const existingSkill = existingSkillResult.rows[0];
    if (existingSkill && (existingSkill.owner_scope !== 'user' || existingSkill.user_id !== req.userId)) {
      return res.status(409).json({ error: 'Skill id ownership conflict' });
    }
    if (existingSkill && existingSkill.name !== name) {
      return res.status(409).json({ error: 'Skill name is immutable' });
    }
    const query = `
      WITH accepted_version AS (
        INSERT INTO public.agent_skill_versions (user_id, skill_key, updated_at, deleted)
        VALUES ($2, $3, $10::timestamptz, false)
        ON CONFLICT (user_id, skill_key)
        DO UPDATE SET
          updated_at = EXCLUDED.updated_at,
          deleted = EXCLUDED.deleted
        WHERE public.agent_skill_versions.updated_at < EXCLUDED.updated_at
        RETURNING skill_key
      ),
      updated_by_id AS (
        UPDATE public.agent_skills AS skill
        SET trigger_text = $4,
            tools = $5,
            steps = $6,
            safety = $7,
            validation = $8,
            knowledge_updates = $9,
            updated_at = $10::timestamptz
        FROM accepted_version
        WHERE skill.id = $1
          AND skill.user_id = $2
          AND skill.owner_scope = 'user'
          AND skill.name = $3
        RETURNING skill.*
      ),
      upserted_by_name AS (
        INSERT INTO public.agent_skills (
          id, user_id, owner_scope, name, trigger_text, tools, steps,
          safety, validation, knowledge_updates, updated_at
        )
        SELECT $1, $2, 'user', $3, $4, $5, $6, $7, $8, $9, $10::timestamptz
        FROM accepted_version
        WHERE NOT EXISTS (SELECT 1 FROM updated_by_id)
        ON CONFLICT (user_id, name) WHERE owner_scope = 'user'
        DO UPDATE SET
          trigger_text = EXCLUDED.trigger_text,
          tools = EXCLUDED.tools,
          steps = EXCLUDED.steps,
          safety = EXCLUDED.safety,
          validation = EXCLUDED.validation,
          knowledge_updates = EXCLUDED.knowledge_updates,
          updated_at = EXCLUDED.updated_at
        WHERE public.agent_skills.updated_at <= EXCLUDED.updated_at
        RETURNING *
      )
      SELECT * FROM updated_by_id
      UNION ALL
      SELECT * FROM upserted_by_name
      LIMIT 1;
    `;
    const result = await pool.query(query, [
      id, req.userId, name, trigger, tools, steps, safety, validation, knowledgeUpdates, clientUpdatedAt
    ]);
    if (!result.rows[0]) {
      const authoritative = await readAuthoritativeSkillState(pool, req.userId, name);
      return res.json({
        ok: true,
        stale: true,
        ...authoritative,
      });
    }
    const data = mapAgentSkillRow(result.rows[0]);
    res.json({
      ok: true,
      data,
      authoritativeUpdatedAt: data.updatedAt,
      authoritativeDeleted: false,
    });
  } catch (err) {
    console.error('[后端AI助手] Upsert Skill 失败:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

/**
 * POST /api/ai-assistant/changes
 * 职责：向数据库权威源同步添加项目变更审计记录（折叠到 knowledge_documents）。
 */
router.post('/ai-assistant/changes', verifyAuth, async (req, res) => {
  const { id, title, summary, source, paths = [] } = req.body;
  if (!id || !title || !summary || !source) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const pool = getPool();
  try {
    const conflictingDocument = await pool.query(
      `SELECT id FROM public.knowledge_documents
       WHERE id = $1 AND NOT (owner_scope = 'user' AND user_id = $2)`,
      [id, req.userId]
    );
    if (conflictingDocument.rows[0]) {
      return res.status(409).json({ error: 'Knowledge document ownership conflict' });
    }
    const pathVal = paths[0] || '';
    const contentHash = 'change_hash_' + Date.now();
    const query = `
      INSERT INTO public.knowledge_documents (id, user_id, owner_scope, source, path, title, summary, content_hash, updated_at)
      VALUES ($1, $2, 'user', $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        path = EXCLUDED.path,
        updated_at = NOW()
      WHERE public.knowledge_documents.owner_scope = 'user'
        AND public.knowledge_documents.user_id = EXCLUDED.user_id
      RETURNING *;
    `;
    const result = await pool.query(query, [id, req.userId, source, pathVal, title, summary, contentHash]);
    if (!result.rows[0]) return res.status(409).json({ error: 'Knowledge document ownership conflict' });
    res.json({ ok: true, data: mapKnowledgeDocumentRow(result.rows[0]) });
  } catch (err) {
    console.error('[后端AI助手] 同步 Changes 失败:', err);
    res.status(500).json({ error: '同步失败' });
  }
});

/**
 * GET /api/ai-assistant/knowledge
 * 职责：简单检索后端知识库中的内容，结合前端返回。
 */
router.get('/ai-assistant/knowledge', verifyAuth, async (req, res) => {
  const { query = '' } = req.query;
  const pool = getPool();
  try {
    let result;
    if (query) {
      result = await pool.query(
        `SELECT * FROM public.knowledge_documents
         WHERE (owner_scope = 'system' OR (owner_scope = 'user' AND user_id = $2))
           AND (title ILIKE $1 OR summary ILIKE $1)
         ORDER BY updated_at DESC LIMIT 20`,
        [`%${query}%`, req.userId]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM public.knowledge_documents
         WHERE owner_scope = 'system' OR (owner_scope = 'user' AND user_id = $1)
         ORDER BY updated_at DESC LIMIT 20`,
        [req.userId]
      );
    }
    res.json({ ok: true, data: result.rows.map(mapKnowledgeDocumentRow) });
  } catch (err) {
    console.error('[后端AI助手] 查询知识库失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

/**
 * DELETE /api/ai-assistant/skills/:id
 * 职责：删除指定 Skill 记录，保持前端 KnowledgeStore 删除动作不落 404。
 */
router.delete('/ai-assistant/skills/:id', verifyAuth, async (req, res) => {
  const { id } = req.params;
  const { name, updatedAt } = req.body || {};
  if (!id || !name || !updatedAt || !Number.isFinite(Date.parse(updatedAt))) {
    return res.status(400).json({ error: '缺少 Skill ID、名称或有效的删除版本' });
  }
  const clientUpdatedAt = new Date(Date.parse(updatedAt)).toISOString();

  const pool = getPool();
  try {
    const existingByIdResult = await pool.query(
      `SELECT name
       FROM public.agent_skills
       WHERE id = $1
         AND user_id = $2
         AND owner_scope = 'user'
       LIMIT 1`,
      [id, req.userId]
    );
    const existingById = existingByIdResult.rows[0];
    if (existingById && existingById.name !== name) {
      return res.status(409).json({ error: 'Skill id/name mismatch' });
    }

    const result = await pool.query(
      `WITH accepted_version AS (
         INSERT INTO public.agent_skill_versions (user_id, skill_key, updated_at, deleted)
         VALUES ($2, $4, $3::timestamptz, true)
         ON CONFLICT (user_id, skill_key)
         DO UPDATE SET
           updated_at = EXCLUDED.updated_at,
           deleted = EXCLUDED.deleted
         WHERE public.agent_skill_versions.updated_at <= EXCLUDED.updated_at
         RETURNING skill_key
       ),
       deleted_skill AS (
         DELETE FROM public.agent_skills AS skill
         USING accepted_version
         WHERE skill.name = $4
           AND skill.user_id = $2
           AND skill.owner_scope = 'user'
           AND skill.updated_at <= $3::timestamptz
         RETURNING skill.id
       )
       SELECT
         EXISTS (SELECT 1 FROM accepted_version) AS accepted,
         EXISTS (SELECT 1 FROM deleted_skill) AS deleted`,
      [id, req.userId, clientUpdatedAt, name]
    );
    const outcome = result.rows[0] || { accepted: false, deleted: false };
    if (!outcome.accepted) {
      const authoritative = await readAuthoritativeSkillState(pool, req.userId, name);
      return res.json({
        ok: true,
        stale: true,
        deleted: false,
        ...authoritative,
      });
    }
    res.json({
      ok: true,
      stale: false,
      deleted: Boolean(outcome.deleted),
      id,
      authoritativeUpdatedAt: clientUpdatedAt,
      authoritativeDeleted: true,
    });
  } catch (err) {
    console.error('[后端AI助手] 删除 Skill 失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
