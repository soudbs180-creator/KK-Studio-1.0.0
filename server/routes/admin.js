// server/routes/admin.js
// 职责：承接现有前端 /api/admin/* 调用，并在服务端执行实时数据库权限校验。

const express = require('express');
const { z } = require('zod');
const { getPool } = require('../lib/db');
const { verifyJWT, signJWT } = require('../lib/jwt');
const credits = require('../lib/credits');

const router = express.Router();

function adminAuth(requiredLevel) {
  return async (req, res, next) => {
    const userId = verifyJWT(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found.' });
      }

      const adminLevel = Number(result.rows[0].admin_level || 0);
      const allowed = requiredLevel === 1 ? adminLevel === 1 : adminLevel === 1 || adminLevel === 2;
      if (!allowed) {
        return res.status(403).json({ error: 'Admin permission required.' });
      }

      req.adminUserId = userId;
      req.adminLevel = adminLevel;
      res.setHeader('X-Refresh-Token', signJWT({ userId }));
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional().default(''),
});

router.get('/admin/users', adminAuth(2), async (req, res) => {
  const parsed = userListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query.' });
  }

  const { page, limit, search } = parsed.data;
  const offset = (page - 1) * limit;
  const pool = getPool();
  const searchText = `%${search.trim()}%`;
  const params = search.trim() ? [searchText, limit, offset] : [limit, offset];
  const whereSql = search.trim() ? 'WHERE email ILIKE $1 OR id ILIKE $1' : '';
  const limitIndex = search.trim() ? 2 : 1;
  const offsetIndex = search.trim() ? 3 : 2;

  const usersResult = await pool.query(
    `SELECT id, email, credits, COALESCE(admin_level, 0) AS admin_level, created_at
     FROM public.users
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );
  const totalResult = await pool.query(
    `SELECT COUNT(*) AS total FROM public.users ${whereSql}`,
    search.trim() ? [searchText] : []
  );

  return res.json({
    users: usersResult.rows.map((user) => ({
      id: user.id,
      email: user.email,
      credits: Number(user.credits),
      adminLevel: Number(user.admin_level || 0),
      createdAt: user.created_at,
    })),
    total: Number(totalResult.rows[0]?.total || 0),
    page,
    limit,
  });
});

const rechargeSchema = z.object({
  amount: z.coerce.number().int().min(1).max(100000),
  note: z.string().max(255).optional().default(''),
});

router.post('/admin/users/:id/recharge', adminAuth(2), async (req, res) => {
  const parsed = rechargeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid recharge payload.' });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const newBalance = await credits.addCredits(
      client,
      req.params.id,
      parsed.data.amount,
      'admin_recharge',
      parsed.data.note || 'admin_recharge',
      req.adminUserId
    );
    await client.query('COMMIT');
    return res.json({ success: true, newBalance });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const adjustSchema = z.object({
  delta: z.coerce.number().int().min(-100000).max(100000).refine((value) => value !== 0),
  note: z.string().min(1).max(255),
});

router.patch('/admin/users/:id/credits', adminAuth(2), async (req, res) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid credit adjustment payload.' });
  }

  const newBalance = await credits.adjustCreditsByAdmin(
    req.adminUserId,
    req.params.id,
    parsed.data.delta,
    parsed.data.note
  );
  return res.json({ success: true, newBalance });
});

router.get('/admin/api-config', adminAuth(2), async (_req, res) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT operation_key, operation_name, cost, is_active FROM public.api_cost_config ORDER BY operation_key ASC'
  );

  return res.json({
    config: result.rows.map((item) => ({
      operation_key: item.operation_key,
      operation_name: item.operation_name,
      cost: Number(item.cost),
      is_active: Boolean(item.is_active),
    })),
  });
});

const apiConfigSchema = z.object({
  operation_key: z.string().min(1).max(100),
  cost: z.coerce.number().int().min(0).max(10000),
});

router.patch('/admin/api-config', adminAuth(2), async (req, res) => {
  const parsed = apiConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid API config payload.' });
  }

  const pool = getPool();
  const result = await pool.query(
    `UPDATE public.api_cost_config
     SET cost = $1, updated_at = NOW()
     WHERE operation_key = $2 AND is_active = true
     RETURNING operation_key, operation_name, cost, is_active`,
    [parsed.data.cost, parsed.data.operation_key]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'API config not found.' });
  }

  return res.json({ success: true, config: result.rows[0] });
});

const adminLevelSchema = z.object({
  admin_level: z.union([z.literal(0), z.literal(2)]),
});

router.patch('/admin/users/:id/admin-level', adminAuth(1), async (req, res) => {
  const parsed = adminLevelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Only admin level 0 or 2 can be set through API.' });
  }

  if (req.params.id === req.adminUserId) {
    return res.status(400).json({ error: 'Cannot modify your own admin level.' });
  }

  const pool = getPool();
  const existing = await pool.query(
    'SELECT COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
    [req.params.id]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if (Number(existing.rows[0].admin_level || 0) === 1) {
    return res.status(403).json({ error: 'Super admin cannot be changed through API.' });
  }

  const result = await pool.query(
    'UPDATE public.users SET admin_level = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, admin_level',
    [parsed.data.admin_level, req.params.id]
  );

  return res.json({
    success: true,
    user: {
      id: result.rows[0].id,
      email: result.rows[0].email,
      adminLevel: Number(result.rows[0].admin_level),
    },
  });
});

module.exports = router;
