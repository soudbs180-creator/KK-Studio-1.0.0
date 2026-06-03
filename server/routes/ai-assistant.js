// server/routes/ai-assistant.js
// 职责：处理 AI 助手的运行日志、工具审计与知识库的后端读写同步，并实施强安全隔离鉴权。
// 遵守规范：所有注释使用中文，说明设计意图和安全机制。

const express = require('express');
const router = express.Router();
const { getPool } = require('../lib/db');
const { verifyJWT } = require('../lib/jwt');

/**
 * 验证请求头中的 JWT 令牌，杜绝非法调用和越权审计。
 */
function verifyAuth(req, res, next) {
  // 测试环境下允许绕过或使用 mock 鉴权
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const authHeader = req.headers.authorization;
  const userId = verifyJWT(authHeader);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', details: '未授权，请提供合法的 Authorization Bearer 凭据' });
  }

  req.userId = userId;
  next();
}

/**
 * POST /api/ai-assistant/runs
 * 职责：同步持久化 Agent 运行计划记录，状态变化时自动更新。
 */
router.post('/ai-assistant/runs', verifyAuth, async (req, res) => {
  const { id, userMessage, intent, plan, status } = req.body;
  if (!id || !userMessage || !intent || !plan || !status) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const pool = getPool();
  try {
    const query = `
      INSERT INTO public.agent_runs (id, user_message, intent, plan, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) 
      DO UPDATE SET status = EXCLUDED.status, plan = EXCLUDED.plan, updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [id, userMessage, intent, JSON.stringify(plan), status]);
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error('[后端AI助手] 同步 Runs 失败:', err);
    res.status(500).json({ error: '同步失败', details: err.message });
  }
});

/**
 * POST /api/ai-assistant/tool-calls
 * 职责：同步持久化工具审计调用日志。
 */
router.post('/api/ai-assistant/tool-calls', verifyAuth, async (req, res) => {
  const { id, runId, toolName, inputSummary, outputSummary, status, error, startedAt, completedAt, idempotencyKey } = req.body;
  if (!id || !runId || !toolName || !inputSummary || !status || !startedAt) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const pool = getPool();
  try {
    const query = `
      INSERT INTO public.agent_tool_calls (id, run_id, tool_name, input_summary, output_summary, status, error, started_at, completed_at, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query(query, [
      id, runId, toolName, inputSummary, outputSummary, status, error, startedAt, completedAt, idempotencyKey
    ]);
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error('[后端AI助手] 同步 Tool-calls 失败:', err);
    res.status(500).json({ error: '同步失败', details: err.message });
  }
});

/**
 * POST /api/ai-assistant/skills
 * 职责：同步/更新系统中的 Skill 手册。
 */
router.post('/ai-assistant/skills', verifyAuth, async (req, res) => {
  const { id, name, trigger, tools, steps, safety = [], validation = [], knowledgeUpdates = [] } = req.body;
  if (!id || !name || !trigger || !tools || !steps) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const pool = getPool();
  try {
    const query = `
      INSERT INTO public.agent_skills (id, name, trigger_text, tools, steps, safety, validation, knowledge_updates, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (name) 
      DO UPDATE SET 
        trigger_text = EXCLUDED.trigger_text,
        tools = EXCLUDED.tools,
        steps = EXCLUDED.steps,
        safety = EXCLUDED.safety,
        validation = EXCLUDED.validation,
        knowledge_updates = EXCLUDED.knowledge_updates,
        updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [
      id, name, trigger, tools, steps, safety, validation, knowledgeUpdates
    ]);
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error('[后端AI助手] Upsert Skill 失败:', err);
    res.status(500).json({ error: '更新失败', details: err.message });
  }
});

/**
 * POST /api/ai-assistant/changes
 * 职责：向数据库权威源同步添加项目变更审计记录（折叠到 knowledge_documents）。
 */
router.post('/api/ai-assistant/changes', verifyAuth, async (req, res) => {
  const { id, title, summary, source, paths = [] } = req.body;
  if (!id || !title || !summary || !source) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const pool = getPool();
  try {
    const pathVal = paths[0] || '';
    const contentHash = 'change_hash_' + Date.now();
    const query = `
      INSERT INTO public.knowledge_documents (id, source, path, title, summary, content_hash, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        path = EXCLUDED.path,
        updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [id, source, pathVal, title, summary, contentHash]);
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error('[后端AI助手] 同步 Changes 失败:', err);
    res.status(500).json({ error: '同步失败', details: err.message });
  }
});

/**
 * GET /api/ai-assistant/knowledge
 * 职责：简单检索后端知识库中的内容，结合前端返回。
 */
router.get('/api/ai-assistant/knowledge', verifyAuth, async (req, res) => {
  const { query = '' } = req.query;
  const pool = getPool();
  try {
    let result;
    if (query) {
      result = await pool.query(
        'SELECT * FROM public.knowledge_documents WHERE title ILIKE $1 OR summary ILIKE $1 ORDER BY updated_at DESC LIMIT 20',
        [`%${query}%`]
      );
    } else {
      result = await pool.query('SELECT * FROM public.knowledge_documents ORDER BY updated_at DESC LIMIT 20');
    }
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error('[后端AI助手] 查询知识库失败:', err);
    res.status(500).json({ error: '查询失败', details: err.message });
  }
});

module.exports = router;
