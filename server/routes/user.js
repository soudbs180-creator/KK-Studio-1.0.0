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
const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';

function createEmptyLocalStorage() {
  return {
    version: 2,
    profiles: {},
  };
}

function createEmptyProfileState(version = 2) {
  return {
    version,
    slots: [],
    providers: [],
    entries: [],
  };
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProfileState(value) {
  const source = isObjectRecord(value) ? value : {};
  return {
    version: Number.parseInt(source.version, 10) || 2,
    slots: Array.isArray(source.slots) ? source.slots : [],
    providers: Array.isArray(source.providers) ? source.providers : [],
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function hasLegacyProfilePayload(data) {
  return Array.isArray(data.slots) || Array.isArray(data.providers) || Array.isArray(data.entries);
}

function resolveProfileUserId(req) {
  const verifiedUserId = verifyJWT(req.headers.authorization);
  if (verifiedUserId) {
    return {
      userId: verifiedUserId,
      refreshToken: signJWT({ userId: verifiedUserId }),
    };
  }

  const tempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true' || process.env.NODE_ENV !== 'production';
  if (allowLocalTempUser && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(tempUserId)) {
    return {
      userId: tempUserId,
      refreshToken: null,
    };
  }

  return null;
}

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

function requireProfileAuth(req, res, next) {
  const authState = resolveProfileUserId(req);
  if (!authState) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required for profile user API storage.',
      },
      meta: buildMeta(req),
    });
  }

  req.profileUserId = authState.userId;
  if (authState.refreshToken) {
    res.setHeader('X-Refresh-Token', authState.refreshToken);
  }
  return next();
}

function ensureLocalStorage() {
  const dir = path.dirname(LOCAL_STORAGE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(createEmptyLocalStorage(), null, 2), 'utf8');
  }
}

function readLocalStorage() {
  ensureLocalStorage();
  try {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return isObjectRecord(parsed) ? parsed : createEmptyLocalStorage();
  } catch (e) {
    return createEmptyLocalStorage();
  }
}

function writeLocalStorage(data) {
  ensureLocalStorage();
  fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function readProfileState(data, userId) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }

  const profiles = data.profiles;
  if (isObjectRecord(profiles[userId])) {
    return normalizeProfileState(profiles[userId]);
  }

  const shouldMigrateLegacyPayload = Object.keys(profiles).length === 0 && hasLegacyProfilePayload(data);
  const nextProfile = shouldMigrateLegacyPayload
    ? normalizeProfileState(data)
    : createEmptyProfileState(Number.parseInt(data.version, 10) || 2);

  profiles[userId] = nextProfile;
  delete data.slots;
  delete data.providers;
  delete data.entries;
  return nextProfile;
}

function writeProfileState(data, userId, profileState) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }

  data.version = 2;
  data.profiles[userId] = normalizeProfileState(profileState);
  delete data.slots;
  delete data.providers;
  delete data.entries;
}

router.use([
  '/v1/profile/key-manager',
  '/v1/profile/key-manager-state',
  '/v1/profile/user-apis',
], requireProfileAuth);

// 1. 获取 key-manager 状态
router.get(['/v1/profile/key-manager', '/v1/profile/key-manager-state'], async (req, res) => {
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  writeLocalStorage(data);
  return res.json({
    success: true,
    data: {
      version: profileState.version || 2,
      slots: profileState.slots || [],
      providers: profileState.providers || []
    },
    meta: buildMeta(req),
  });
});

// 2. 覆盖 key-manager 状态
router.put(['/v1/profile/key-manager', '/v1/profile/key-manager-state'], async (req, res) => {
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  const nextData = {
    ...profileState,
    version: req.body.version || profileState.version || 2,
    slots: req.body.slots || profileState.slots || [],
    providers: req.body.providers || profileState.providers || []
  };
  writeProfileState(data, req.profileUserId, nextData);
  writeLocalStorage(data);
  return res.json({
    success: true,
    data: {
      version: nextData.version,
      slots: nextData.slots,
      providers: nextData.providers
    },
    meta: buildMeta(req),
  });
});

// 3. 获取 user-apis 列表
router.get('/v1/profile/user-apis', async (req, res) => {
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  writeLocalStorage(data);
  return res.json({
    success: true,
    data: {
      entries: profileState.entries || []
    },
    meta: buildMeta(req),
  });
});

// 4. 覆盖整个 user-apis 列表以及大 Payload (replaceUserApisPayload)
router.put(['/v1/profile/user-apis', '/v1/profile/user-apis/payload'], async (req, res) => {
  const nextData = {
    version: req.body.version || 2,
    slots: req.body.slots || [],
    providers: req.body.providers || [],
    entries: req.body.entries || []
  };
  const data = readLocalStorage();
  writeProfileState(data, req.profileUserId, nextData);
  writeLocalStorage(data);
  return res.json({
    success: true,
    data: nextData,
    meta: buildMeta(req),
  });
});

// 5. 新增/覆盖 user-apis entries (replaceUserApiEntries)
router.post('/v1/profile/user-apis', async (req, res) => {
  const data = readLocalStorage();
  const profileState = readProfileState(data, req.profileUserId);
  const nextData = {
    ...profileState,
    entries: req.body.entries || []
  };
  writeProfileState(data, req.profileUserId, nextData);
  writeLocalStorage(data);
  return res.json({
    success: true,
    data: {
      entries: nextData.entries
    },
    meta: buildMeta(req),
  });
});

module.exports = router;
