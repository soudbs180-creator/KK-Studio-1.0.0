// server/routes/user.js
// 职责：提供当前登录用户信息，前端依赖它刷新管理员等级和积分余额。

const express = require('express');
const { getPool } = require('../lib/db');
const { verifyJWT, signJWT } = require('../lib/jwt');

const router = express.Router();

router.get('/user/me', async (req, res) => {
  const userId = verifyJWT(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    // 调试模式下，如果无数据库，直接返回固定的本地用户 mock 数据
    return res.json({
      id: userId || 'local-user',
      email: 'local-user@example.com',
      credits: 999999,
      created_at: new Date().toISOString(),
      adminLevel: 2, // 给予管理员权限，方便调测
    });
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT id, email, credits, created_at, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'User not found.' });
  }

  res.setHeader('X-Refresh-Token', signJWT({ userId }));
  const user = result.rows[0];
  return res.json({
    id: user.id,
    email: user.email,
    credits: Number(user.credits),
    created_at: user.created_at,
    adminLevel: Number(user.admin_level || 0),
  });
});

// ==========================================
// KKAI 本地文件持久化模拟路由 (解决 404 / 500)
// ==========================================
const fs = require('fs');
const path = require('path');

const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../.kk-local/local-user-apis.json');

function ensureLocalStorage() {
  const dir = path.dirname(LOCAL_STORAGE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify({
      version: 2,
      slots: [],
      providers: [],
      entries: []
    }, null, 2), 'utf8');
  }
}

function readLocalStorage() {
  ensureLocalStorage();
  try {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { version: 2, slots: [], providers: [], entries: [] };
  }
}

function writeLocalStorage(data) {
  ensureLocalStorage();
  fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// 1. 获取 key-manager 状态
router.get('/v1/profile/key-manager', async (req, res) => {
  const data = readLocalStorage();
  return res.json({
    success: true,
    data: {
      version: data.version || 2,
      slots: data.slots || [],
      providers: data.providers || []
    },
    meta: {
      requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
  });
});

// 2. 覆盖 key-manager 状态
router.put('/v1/profile/key-manager', async (req, res) => {
  const data = readLocalStorage();
  const nextData = {
    ...data,
    version: req.body.version || data.version || 2,
    slots: req.body.slots || data.slots || [],
    providers: req.body.providers || data.providers || []
  };
  writeLocalStorage(nextData);
  return res.json({
    success: true,
    data: {
      version: nextData.version,
      slots: nextData.slots,
      providers: nextData.providers
    },
    meta: {
      requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
  });
});

// 3. 获取 user-apis 列表
router.get('/v1/profile/user-apis', async (req, res) => {
  const data = readLocalStorage();
  return res.json({
    success: true,
    data: {
      entries: data.entries || []
    },
    meta: {
      requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
  });
});

// 4. 覆盖整个 user-apis 列表以及大 Payload (replaceUserApisPayload)
router.put('/v1/profile/user-apis', async (req, res) => {
  const nextData = {
    version: req.body.version || 2,
    slots: req.body.slots || [],
    providers: req.body.providers || [],
    entries: req.body.entries || []
  };
  writeLocalStorage(nextData);
  return res.json({
    success: true,
    data: nextData,
    meta: {
      requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
  });
});

// 5. 新增/覆盖 user-apis entries (replaceUserApiEntries)
router.post('/v1/profile/user-apis', async (req, res) => {
  const data = readLocalStorage();
  const nextData = {
    ...data,
    entries: req.body.entries || []
  };
  writeLocalStorage(nextData);
  return res.json({
    success: true,
    data: {
      entries: nextData.entries
    },
    meta: {
      requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
  });
});

module.exports = router;
