/**
 * @file contract-compat.js
 * @module server/routes
 * @description Compatibility routes for shared API contracts that do not yet have dedicated VPS modules.
 */

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const { getPool } = require('../../lib/db');
const { signJWT, verifyJWT } = require('../../lib/jwt');
const credits = require('../../lib/credits');
const dispatcher = require('../../lib/dispatcher');

const router = express.Router();

const {
  TEMP_USER_ID_HEADER,
  ADMIN_SESSION_TOKEN_HEADER,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  LOCAL_STORE_PATH,
  DEFAULT_CREDIT_BALANCE,
  isDbEnabled,
  nowIso,
  requestId,
  meta,
  okEnvelope,
  sendError,
  readCookieValue,
  resolveRequestUserId,
} = require('./compatHelper');

function requireUser(req, res, next) {
  const userId = resolveRequestUserId(req);
  if (!userId) {
    return sendError(res, req, 401, 'UNAUTHORIZED', 'Authentication is required.');
  }
  req.userId = userId;
  return next();
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function defaultStore() {
  return {
    version: 1,
    profiles: {},
    exchangeRates: [
      { currencyCode: 'CNY', creditsPerUnit: 100, minAmount: 1, maxAmount: null, isActive: true, updatedAt: nowIso() },
      { currencyCode: 'USD', creditsPerUnit: 700, minAmount: 1, maxAmount: null, isActive: true, updatedAt: nowIso() },
    ],
    adminPasswordHash: '',
  };
}

async function readStore() {
  try {
    const raw = await fs.readFile(LOCAL_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return isObjectRecord(parsed) ? { ...defaultStore(), ...parsed } : defaultStore();
  } catch {
    return defaultStore();
  }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function ensureProfileStore(store, userId) {
  if (!isObjectRecord(store.profiles)) store.profiles = {};
  if (!isObjectRecord(store.profiles[userId])) {
    store.profiles[userId] = {
      profile: {},
      creditBalance: DEFAULT_CREDIT_BALANCE,
      creditTransactions: [],
      workspaceLayout: { canvases: [] },
      workflows: {},
      generationTasks: {},
      assets: [],
      rechargeSubmissions: {},
    };
  }
  return store.profiles[userId];
}

function normalizeSystemProxyTaskId(rawTaskId) {
  const value = String(rawTaskId || '').trim();
  return value.startsWith('system_proxy:') ? value.slice('system_proxy:'.length) : value;
}

function findGenerationTask(profileStore, rawTaskId) {
  const tasks = isObjectRecord(profileStore.generationTasks) ? profileStore.generationTasks : {};
  const directId = String(rawTaskId || '').trim();
  const normalizedId = normalizeSystemProxyTaskId(directId);
  const task = tasks[directId] || tasks[normalizedId];
  return task ? { taskId: tasks[directId] ? directId : normalizedId, task } : null;
}

function normalizeSystemProxyTaskStatus(status) {
  if (status === 'succeeded' || status === 'success') return 'success';
  if (status === 'failed' || status === 'cancelled' || status === 'refunded') return 'failed';
  return 'pending';
}

function extractGenerationTaskUrls(task) {
  const results = Array.isArray(task?.results) ? task.results : [];
  return results
    .map((item) => item?.url || item?.imageUrl || item?.contentUrl)
    .filter((url) => typeof url === 'string' && url.trim().length > 0);
}

function toSystemProxyTaskStatusPayload(task) {
  const urls = extractGenerationTaskUrls(task);
  const status = normalizeSystemProxyTaskStatus(task?.status);
  const cancelled = task?.status === 'cancelled';
  return {
    taskId: task?.id,
    status,
    url: urls[0] || undefined,
    urls,
    requestId: task?.requestId,
    attemptId: task?.attemptId,
    message: task?.message || task?.errorMessage || (cancelled ? 'Task was cancelled.' : undefined),
    error: status === 'failed' ? (task?.errorMessage || task?.errorCode || (cancelled ? 'Task was cancelled.' : undefined)) : undefined,
    creditAmount: task?.creditAmount,
    billingStatus: task?.billingStatus,
    ledgerTransactionId: task?.ledgerTransactionId,
    refundTransactionId: task?.refundTransactionId,
  };
}

async function handleSystemProxyTaskMode(req, res, mode) {
  const rawTaskId = req.body?.taskId || req.body?.localTaskId;
  const taskId = normalizeSystemProxyTaskId(rawTaskId);
  if (!taskId) {
    return sendError(res, req, 400, 'INVALID_REQUEST', 'taskId is required for system proxy task control.');
  }

  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const found = findGenerationTask(profileStore, rawTaskId);
  if (!found) {
    return sendError(res, req, 404, 'GENERATION_TASK_NOT_FOUND', 'Generation task was not found.');
  }

  if (mode === 'task_status') {
    return res.json(okEnvelope(toSystemProxyTaskStatusPayload(found.task), req));
  }

  if (mode === 'download_task') {
    const urls = extractGenerationTaskUrls(found.task);
    if (!urls.length) {
      return sendError(res, req, 404, 'TASK_CONTENT_NOT_AVAILABLE', 'Generation task content is not available yet.');
    }
    return res.json(okEnvelope({
      taskId: found.task.id,
      url: urls[0],
      urls,
      requestId: found.task.requestId,
      attemptId: found.task.attemptId,
    }, req));
  }

  if (mode === 'cancel_task') {
    if (!['succeeded', 'failed', 'cancelled', 'refunded'].includes(found.task.status)) {
      found.task.status = 'cancelled';
      found.task.errorCode = 'TASK_CANCELLED';
      found.task.errorMessage = 'Task was cancelled.';
      found.task.updatedAt = nowIso();
      await writeStore(store);
    }
    return res.json(okEnvelope({ message: 'Task cancelled.', taskId: found.task.id }, req));
  }

  if (mode === 'delete_task') {
    delete profileStore.generationTasks[found.taskId];
    await writeStore(store);
    return res.json(okEnvelope({ message: 'Task deleted.', taskId: found.task.id }, req));
  }

  return sendError(res, req, 400, 'UNSUPPORTED_MODE', 'Unsupported system proxy task mode.');
}

function buildLocalProfile(userId, overrides = {}) {
  const timestamp = nowIso();
  const isTemp = String(userId || '').startsWith('temp-');
  const email = overrides.email || (isTemp ? `${userId}@temp.local` : 'local-user@example.com');
  const adminLevel = Number(overrides.adminLevel ?? 1);
  return {
    id: userId,
    email,
    nickname: overrides.nickname || email.split('@')[0] || 'Local User',
    avatarUrl: overrides.avatarUrl || '',
    credits: Number(overrides.credits ?? DEFAULT_CREDIT_BALANCE),
    adminLevel,
    role: adminLevel > 0 ? 'admin' : 'user',
    status: 'active',
    createdAt: overrides.createdAt || timestamp,
    updatedAt: overrides.updatedAt || timestamp,
  };
}

async function loadProfile(userId) {
  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, email, credits, created_at, updated_at, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
        [userId],
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const adminLevel = Number(row.admin_level || 0);
        return {
          id: row.id,
          email: row.email,
          credits: Number(row.credits || 0),
          nickname: String(row.email || '').split('@')[0] || 'User',
          avatarUrl: '',
          adminLevel,
          role: adminLevel > 0 ? 'admin' : 'user',
          status: 'active',
          createdAt: new Date(row.created_at || Date.now()).toISOString(),
          updatedAt: new Date(row.updated_at || row.created_at || Date.now()).toISOString(),
        };
      }
    } catch (error) {
      console.warn('[contract-compat] Failed to load DB profile, using local fallback:', error.message);
    }
  }

  const store = await readStore();
  const profileStore = ensureProfileStore(store, userId);
  return buildLocalProfile(userId, profileStore.profile || {});
}

async function requireAdmin(req, res, next) {
  const userId = resolveRequestUserId(req, { allowTemp: false });
  if (!userId) {
    return sendError(res, req, 401, 'UNAUTHORIZED', 'Authentication is required.');
  }

  const profile = await loadProfile(userId);
  if (Number(profile.adminLevel || 0) <= 0) {
    return sendError(res, req, 403, 'ADMIN_REQUIRED', 'Admin permission is required.');
  }

  req.userId = userId;
  req.adminProfile = profile;
  return next();
}

function hashPassword(password) {
  const salt = process.env.PASSWORD_SALT || 'local-contract-compat-salt';
  return crypto.createHmac('sha256', salt).update(String(password || '')).digest('hex');
}

function buildSession(profile) {
  const accessToken = signJWT({ userId: profile.id });
  return {
    accessToken,
    refreshToken: signJWT({ userId: profile.id }),
    expiresIn: 7 * 24 * 60 * 60,
    sessionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    profile,
  };
}

function toLegacyUserMe(profile, creditsValue = DEFAULT_CREDIT_BALANCE) {
  return {
    id: profile.id,
    email: profile.email,
    credits: Number(creditsValue || 0),
    created_at: profile.createdAt || nowIso(),
    adminLevel: Number(profile.adminLevel || 0),
  };
}

function toLegacyAuthResponse(session, message) {
  return {
    message,
    token: session.accessToken,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: toLegacyUserMe(session.profile, session.profile?.credits ?? DEFAULT_CREDIT_BALANCE),
  };
}

function defaultBillingPlans() {
  return [
    { id: 'price_basic_100', name: 'Basic Credits', amount: '9.90', credits: 100 },
    { id: 'price_premium_500', name: 'Premium Credits', amount: '39.90', credits: 500 },
    { id: 'price_enterprise_1500', name: 'Enterprise Credits', amount: '99.90', credits: 1500 },
  ];
}

async function listLegacyBillingPlans() {
  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, name, amount_cents, credits FROM public.plans ORDER BY amount_cents ASC, id ASC',
      );
      if (result.rows.length > 0) {
        return result.rows.map((row) => ({
          id: String(row.id),
          name: String(row.name || row.id),
          amount: (Number(row.amount_cents || 0) / 100).toFixed(2),
          credits: Number(row.credits || 0),
        }));
      }
    } catch (error) {
      console.warn('[contract-compat] Failed to load DB billing plans, using local fallback:', error.message);
    }
  }
  return defaultBillingPlans();
}

async function findUserByIdentity(identity) {
  const normalized = String(identity || '').trim();
  if (!normalized) return null;
  if (isDbEnabled()) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, credits, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1 OR email = $1 LIMIT 1',
      [normalized],
    );
    if (result.rows[0]) return result.rows[0];
  }
  return {
    id: normalized.includes('@') ? crypto.createHash('sha1').update(normalized).digest('hex') : normalized,
    email: normalized.includes('@') ? normalized : undefined,
    credits: DEFAULT_CREDIT_BALANCE,
    admin_level: normalized.includes('admin') ? 1 : 0,
  };
}

function readBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toAdminUserListItem(row) {
  const id = String(row.id || '').trim();
  const email = String(row.email || (id ? `${id}@local` : 'local-user@example.com'));
  const createdAt = row.created_at || row.createdAt || nowIso();
  return {
    id,
    email,
    credits: Number(row.credits || 0),
    adminLevel: Number(row.admin_level ?? row.adminLevel ?? 0),
    createdAt: new Date(createdAt).toISOString(),
  };
}

function readLocalAdminUsers(store, currentAdminProfile, search) {
  const normalizedSearch = String(search || '').trim().toLowerCase();
  const byId = new Map();

  if (currentAdminProfile?.id) {
    byId.set(currentAdminProfile.id, toAdminUserListItem(currentAdminProfile));
  }

  for (const [userId, profileStore] of Object.entries(store.profiles || {})) {
    const profile = buildLocalProfile(userId, {
      ...(profileStore.profile || {}),
      credits: profileStore.creditBalance ?? profileStore.profile?.credits,
    });
    byId.set(userId, toAdminUserListItem(profile));
  }

  const items = Array.from(byId.values());
  if (!normalizedSearch) return items;

  return items.filter((item) => {
    return item.id.toLowerCase().includes(normalizedSearch)
      || item.email.toLowerCase().includes(normalizedSearch);
  });
}

function mapCreditLog(row) {
  return {
    id: String(row.id),
    userId: row.user_id,
    transactionType: Number(row.delta) >= 0 ? 'credit' : 'debit',
    amount: Math.abs(Number(row.delta || 0)),
    balanceAfter: Number(row.balance_after || 0),
    description: row.reason || null,
    status: 'completed',
    businessRefType: row.reason || null,
    businessRefId: row.operation_key || null,
    createdAt: new Date(row.created_at || Date.now()).toISOString(),
    completedAt: new Date(row.created_at || Date.now()).toISOString(),
  };
}

function buildRechargeSubmission(userId, input, overrides = {}) {
  const amount = Number(input.amount || 0);
  const currencyCode = String(input.currencyCode || 'CNY').toUpperCase() === 'USD' ? 'USD' : 'CNY';
  const creditsPerUnit = currencyCode === 'USD' ? 700 : 100;
  const creditAmount = Math.max(0, Math.round(amount * creditsPerUnit));
  const timestamp = nowIso();
  return {
    submissionId: overrides.submissionId || `rch_${crypto.randomUUID()}`,
    userId,
    amount,
    baseAmount: amount,
    serviceFee: 0,
    payableAmount: amount,
    baseCredits: creditAmount,
    bonusCredits: 0,
    creditAmount,
    creditsPerUnit,
    currencyCode,
    paymentChannel: input.paymentChannel || 'manual',
    manualProvider: input.manualProvider || null,
    transferReferenceLast4: input.transferReferenceLast4 || null,
    note: input.note || '',
    status: overrides.status || 'created',
    createdAt: overrides.createdAt || timestamp,
    expiresAt: overrides.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    paymentMarkedAt: overrides.paymentMarkedAt || null,
    submittedAt: overrides.submittedAt || null,
    reviewedAt: overrides.reviewedAt || null,
    reviewActorUserId: overrides.reviewActorUserId || null,
  };
}

function toAdminRechargeSubmission(submission) {
  return {
    ...submission,
    userId: submission.userId || '',
    creditAmount: Number(submission.creditAmount || 0),
    creditsPerUnit: Number(submission.creditsPerUnit || 0),
  };
}

async function listAllLocalRechargeSubmissions() {
  const store = await readStore();
  const items = [];
  for (const [userId, profileStore] of Object.entries(store.profiles || {})) {
    for (const submission of Object.values(profileStore.rechargeSubmissions || {})) {
      items.push(toAdminRechargeSubmission({ ...submission, userId: submission.userId || userId }));
    }
  }
  items.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return items;
}

function authStartPayload(req, provider, mode) {
  const query = new URLSearchParams(req.query || {});
  const redirectTo = query.get('redirectTo') || '/';
  const state = `auth_${provider}_${crypto.randomUUID()}`;
  const origin = `${req.protocol}://${req.get('host')}`;
  const callbackUrl = `${origin}/api/v1/auth/${provider}/callback`;
  const authorizationUrl = `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}authProvider=${provider}&authMode=${mode}&state=${encodeURIComponent(state)}`;
  return {
    provider,
    mode,
    authorizationUrl,
    callbackUrl,
    state,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

async function handleAuthAliasLogin(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return sendError(res, req, 400, 'AUTH_INVALID_PAYLOAD', 'Email and password are required.');
  }

  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, email, password_hash, credits, created_at, updated_at, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE email = $1',
        [email],
      );
      const user = result.rows[0];
      if (!user || user.password_hash !== hashPassword(password)) {
        return sendError(res, req, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
      }
      const session = buildSession(buildLocalProfile(user.id, {
        email: user.email,
        adminLevel: Number(user.admin_level || 0),
        credits: Number(user.credits || 0),
        createdAt: new Date(user.created_at || Date.now()).toISOString(),
        updatedAt: new Date(user.updated_at || user.created_at || Date.now()).toISOString(),
      }));
      return res.json(toLegacyAuthResponse(session, 'Login successful.'));
    } catch (error) {
      return sendError(res, req, 500, 'AUTH_LOGIN_FAILED', error.message);
    }
  }

  return res.json(toLegacyAuthResponse(buildSession(buildLocalProfile('mock-user-id', { email, adminLevel: 1 })), 'Login successful.'));
}

async function handleAuthAliasRegister(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || password.length < 8) {
    return sendError(res, req, 400, 'AUTH_INVALID_PAYLOAD', 'Email and a password of at least 8 characters are required.');
  }

  if (isDbEnabled()) {
    try {
      const userId = crypto.randomUUID();
      const pool = getPool();
      await pool.query(
        'INSERT INTO public.users (id, email, password_hash, credits, created_at, updated_at) VALUES ($1, $2, $3, 0, NOW(), NOW())',
        [userId, email, hashPassword(password)],
      );
      return res.json(toLegacyAuthResponse(buildSession(buildLocalProfile(userId, { email, adminLevel: 0, credits: 0 })), 'Registration successful.'));
    } catch (error) {
      return sendError(res, req, 409, 'AUTH_REGISTER_FAILED', error.message);
    }
  }

  return res.json(toLegacyAuthResponse(buildSession(buildLocalProfile('mock-user-id', { email, adminLevel: 1 })), 'Registration successful.'));
}


router.get('/api/v1/admin/access', requireAdmin, async (req, res) => {
  const adminSessionToken = String(req.headers[ADMIN_SESSION_TOKEN_HEADER] || '').trim();
  const sessionUserId = adminSessionToken ? verifyJWT(`Bearer ${adminSessionToken}`) : null;
  const adminSessionActive = Boolean(sessionUserId && sessionUserId === req.userId);
  return res.json(okEnvelope({
    userId: req.userId,
    role: 'admin',
    isAdmin: true,
    requiresPasswordChange: false,
    adminSessionActive,
    adminSessionExpiresAt: adminSessionActive ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
  }, req));
});

router.post('/api/v1/admin/session/verify-password', requireAdmin, async (req, res) => {
  const password = String(req.body?.password || '');
  if (!password) return sendError(res, req, 400, 'ADMIN_PASSWORD_REQUIRED', 'Admin password is required.');

  const configuredPassword = process.env.ADMIN_CONSOLE_PASSWORD || process.env.KK_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  const allowLocalPassword = process.env.KKAI_LOCAL_ONLY === 'true';
  if (configuredPassword && password !== configuredPassword) {
    return sendError(res, req, 403, 'ADMIN_PASSWORD_INVALID', 'Admin password is invalid.');
  }
  if (!configuredPassword && !allowLocalPassword) {
    return sendError(res, req, 503, 'ADMIN_PASSWORD_NOT_CONFIGURED', 'Admin password is not configured.');
  }

  const adminSessionToken = signJWT({ userId: req.userId, adminSession: true });
  return res.json(okEnvelope({
    verified: true,
    requiresPasswordChange: false,
    adminSessionToken,
    adminSessionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }, req));
});

router.post('/api/v1/admin/password', requireAdmin, async (req, res) => {
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 8) {
    return sendError(res, req, 400, 'ADMIN_WEAK_PASSWORD', 'Admin password must be at least 8 characters.');
  }
  const store = await readStore();
  store.adminPasswordHash = hashPassword(newPassword);
  await writeStore(store);
  return res.json(okEnvelope({ changed: true }, req));
});

router.get('/api/v1/admin/users', requireAdmin, async (req, res) => {
  const page = readBoundedInteger(req.query?.page, 1, 1, 100000);
  const limit = readBoundedInteger(req.query?.limit, 20, 1, 100);
  const search = String(req.query?.search || '').trim();
  const offset = (page - 1) * limit;

  if (isDbEnabled()) {
    const pool = getPool();
    const params = [];
    let whereClause = '';
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE email ILIKE $1 OR id::text ILIKE $1`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) AS count FROM public.users ${whereClause}`, params);
    const rowsResult = await pool.query(
      `SELECT id, email, credits, created_at, COALESCE(admin_level, 0) AS admin_level
       FROM public.users
       ${whereClause}
       ORDER BY created_at DESC, id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return res.json(okEnvelope({
      users: rowsResult.rows.map(toAdminUserListItem),
      total: Number(countResult.rows[0]?.count || 0),
      page,
      limit,
    }, req));
  }

  const store = await readStore();
  let users = readLocalAdminUsers(store, req.adminProfile, search);

  if (search && users.length === 0) {
    const syntheticUser = await findUserByIdentity(search);
    if (syntheticUser) {
      users = [toAdminUserListItem(syntheticUser)];
    }
  }

  users.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return res.json(okEnvelope({
    users: users.slice(offset, offset + limit),
    total: users.length,
    page,
    limit,
  }, req));
});

router.post('/api/v1/admin/users/roles', requireAdmin, async (req, res) => {
  const identity = String(req.body?.identity || '').trim();
  const role = req.body?.role === 'admin' ? 'admin' : 'user';
  if (!identity) return sendError(res, req, 400, 'IDENTITY_REQUIRED', 'User identity is required.');
  const target = await findUserByIdentity(identity);
  if (!target) return sendError(res, req, 404, 'USER_NOT_FOUND', 'User was not found.');
  if (isDbEnabled()) {
    const pool = getPool();
    await pool.query('UPDATE public.users SET admin_level = $1, updated_at = NOW() WHERE id = $2', [role === 'admin' ? 2 : 0, target.id]);
  } else {
    const store = await readStore();
    const profileStore = ensureProfileStore(store, target.id);
    profileStore.profile = {
      ...(profileStore.profile || {}),
      email: target.email || profileStore.profile?.email,
      adminLevel: role === 'admin' ? 2 : 0,
      credits: Number(profileStore.creditBalance ?? target.credits ?? DEFAULT_CREDIT_BALANCE),
      updatedAt: nowIso(),
    };
    await writeStore(store);
  }
  return res.json(okEnvelope({
    identity,
    subjectId: target.id,
    subjectEmail: target.email,
    role,
  }, req));
});


router.post('/api/v1/admin/billing/recharges', requireAdmin, async (req, res) => {
  const identity = String(req.body?.identity || '').trim();
  const amount = Number(req.body?.creditAmount || 0);
  if (!identity || !Number.isSafeInteger(amount) || amount <= 0) {
    return sendError(res, req, 400, 'INVALID_RECHARGE_PAYLOAD', 'identity and positive creditAmount are required.');
  }
  const target = await findUserByIdentity(identity);
  let balanceAfter = Number(target.credits || DEFAULT_CREDIT_BALANCE) + amount;
  if (isDbEnabled()) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      balanceAfter = await credits.addCredits(client, target.id, amount, 'admin_recharge', req.body?.description || 'admin_recharge', req.userId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    const store = await readStore();
    const profileStore = ensureProfileStore(store, target.id);
    balanceAfter = Number(profileStore.creditBalance ?? target.credits ?? DEFAULT_CREDIT_BALANCE) + amount;
    profileStore.creditBalance = balanceAfter;
    profileStore.profile = {
      ...(profileStore.profile || {}),
      email: target.email || profileStore.profile?.email,
      credits: balanceAfter,
      updatedAt: nowIso(),
    };
    profileStore.creditTransactions = [
      ...(profileStore.creditTransactions || []),
      {
        id: `ledger_${crypto.randomUUID()}`,
        userId: target.id,
        transactionType: 'recharge',
        amount,
        balanceAfter,
        description: req.body?.description || 'admin_recharge',
        status: 'completed',
        createdAt: nowIso(),
        completedAt: nowIso(),
      },
    ];
    await writeStore(store);
  }
  return res.json(okEnvelope({ identity, subjectId: target.id, balanceAfter, creditedAmount: amount, subjectEmail: target.email }, req));
});

router.post('/api/v1/admin/billing/credit-adjustments', requireAdmin, async (req, res) => {
  const identity = String(req.body?.identity || '').trim();
  const delta = Number(req.body?.creditDelta ?? req.body?.delta ?? 0);
  const description = String(req.body?.description || req.body?.note || 'admin_adjust').trim() || 'admin_adjust';
  if (!identity || !Number.isSafeInteger(delta) || delta === 0) {
    return sendError(res, req, 400, 'INVALID_CREDIT_ADJUSTMENT_PAYLOAD', 'identity and non-zero creditDelta are required.');
  }

  const target = await findUserByIdentity(identity);
  if (!target) return sendError(res, req, 404, 'USER_NOT_FOUND', 'User was not found.');

  let balanceAfter = Math.max(0, Number(target.credits || DEFAULT_CREDIT_BALANCE) + delta);
  if (isDbEnabled()) {
    balanceAfter = await credits.adjustCreditsByAdmin(req.userId, target.id, delta, description);
  } else {
    const store = await readStore();
    const profileStore = ensureProfileStore(store, target.id);
    balanceAfter = Math.max(0, Number(profileStore.creditBalance ?? target.credits ?? DEFAULT_CREDIT_BALANCE) + delta);
    profileStore.creditBalance = balanceAfter;
    profileStore.profile = {
      ...(profileStore.profile || {}),
      email: target.email || profileStore.profile?.email,
      credits: balanceAfter,
      updatedAt: nowIso(),
    };
    profileStore.creditTransactions = [
      ...(profileStore.creditTransactions || []),
      {
        id: `ledger_${crypto.randomUUID()}`,
        userId: target.id,
        transactionType: delta > 0 ? 'recharge' : 'debit',
        amount: Math.abs(delta),
        balanceAfter,
        description,
        status: 'completed',
        createdAt: nowIso(),
        completedAt: nowIso(),
      },
    ];
    await writeStore(store);
  }

  return res.json(okEnvelope({
    identity,
    subjectId: target.id,
    subjectEmail: target.email,
    balanceAfter,
    delta,
  }, req));
});

router.get('/api/v1/admin/billing/accounts/:identity', requireAdmin, async (req, res) => {
  const target = await findUserByIdentity(req.params.identity);
  if (!target) return sendError(res, req, 404, 'USER_NOT_FOUND', 'User was not found.');
  let transactions = [];
  if (isDbEnabled()) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, user_id, delta, reason, operation_key, balance_after, created_at FROM public.credit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [target.id],
    );
    transactions = result.rows.map(mapCreditLog);
  }
  return res.json(okEnvelope({
    identity: req.params.identity,
    subjectId: target.id,
    subjectEmail: target.email,
    balance: Number(target.credits || 0),
    frozenBalance: 0,
    transactions,
  }, req));
});


router.put('/api/v1/admin/billing/exchange-rates', requireAdmin, async (req, res) => {
  const store = await readStore();
  const next = {
    currencyCode: String(req.body?.currencyCode || 'CNY').toUpperCase() === 'USD' ? 'USD' : 'CNY',
    creditsPerUnit: Number(req.body?.creditsPerUnit || 0),
    minAmount: req.body?.minAmount ?? null,
    maxAmount: req.body?.maxAmount ?? null,
    isActive: req.body?.isActive !== false,
    updatedAt: nowIso(),
  };
  store.exchangeRates = (store.exchangeRates || []).filter((item) => item.currencyCode !== next.currencyCode);
  store.exchangeRates.push(next);
  await writeStore(store);
  return res.json(okEnvelope(next, req));
});


router.get('/api/v1/admin/billing/recharge-submissions', requireAdmin, async (req, res) => {
  return res.json(okEnvelope({ items: await listAllLocalRechargeSubmissions() }, req));
});

router.get('/api/v1/admin/billing/recharge-submissions/:submissionId', requireAdmin, async (req, res) => {
  const items = await listAllLocalRechargeSubmissions();
  const submission = items.find((item) => item.submissionId === req.params.submissionId);
  if (!submission) return sendError(res, req, 404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
  return res.json(okEnvelope({ submission }, req));
});

router.post('/api/v1/admin/billing/recharge-submissions/:submissionId/review', requireAdmin, async (req, res) => {
  const store = await readStore();
  let found = null;
  for (const profileStore of Object.values(store.profiles || {})) {
    if (profileStore.rechargeSubmissions?.[req.params.submissionId]) {
      found = profileStore.rechargeSubmissions[req.params.submissionId];
      break;
    }
  }
  if (!found) return sendError(res, req, 404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
  found.status = req.body?.decision === 'reject' ? 'rejected' : 'credited';
  found.reviewedAt = nowIso();
  found.reviewActorUserId = req.userId;
  await writeStore(store);
  return res.json(okEnvelope({ submission: toAdminRechargeSubmission(found), recharge: null, creditAmount: Number(found.creditAmount || 0) }, req));
});


router.post('/api/v1/admin/models', requireAdmin, async (req, res) => {
  const timestamp = nowIso();
  const item = {
    id: `model_${crypto.randomUUID()}`,
    modelCode: req.body?.modelCode || '',
    displayName: req.body?.displayName || req.body?.modelCode || 'Model',
    kind: req.body?.kind || 'chat',
    availability: req.body?.availability || 'available',
    billingMode: req.body?.billingMode || 'credits',
    defaultCreditCost: Number(req.body?.defaultCreditCost || 1),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return res.status(201).json(okEnvelope(item, req));
});

router.use(['/api/v1/model-proxy/system', '/api/secure-proxy'], (req, res, next) => {
  const startTime = Date.now();
  const oldJson = res.json;
  res.json = function(data) {
    const metricsCollector = require('../../lib/dispatcher/metricsCollector');
    const success = res.statusCode >= 200 && res.statusCode < 300 && !(data && data.success === false);
    metricsCollector.recordRouteCall({
      routePath: req.baseUrl ? (req.baseUrl + req.path) : req.path,
      success,
      latency: Date.now() - startTime
    });
    return oldJson.apply(res, arguments);
  };
  next();
});

router.post('/api/v1/model-proxy/system', requireUser, async (req, res) => {
  const mode = String(req.body?.mode || 'chat').trim();
  if (['task_status', 'cancel_task', 'delete_task', 'download_task'].includes(mode)) {
    return handleSystemProxyTaskMode(req, res, mode);
  }

  try {
    const taskType = mode === 'image' ? 'image' : 'chat';
    const payload = {
      ...req.body,
      model: req.body?.model || req.body?.modelId,
      task_type: req.body?.task_type || taskType,
    };
    const result = await dispatcher.dispatch(req.userId, payload);
    return res.json(okEnvelope(result, req));
  } catch (error) {
    return sendError(res, req, error.statusCode || 502, error.code || 'SYSTEM_MODEL_PROXY_FAILED', error.message, error.route);
  }
});

router.post('/api/secure-proxy', requireUser, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      model: req.body?.model || req.body?.modelId,
      task_type: req.body?.task_type || 'chat',
    };
    const result = await dispatcher.dispatch(req.userId, payload);
    return res.json({
      role: 'assistant',
      content: result.content || '',
      choices: [{ message: { role: 'assistant', content: result.content || '' } }],
      usage: result.tokens ? { total_tokens: result.tokens } : undefined,
      route: result.route,
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({ error: error.message, code: error.code || 'SECURE_PROXY_FAILED', route: error.route });
  }
});

router.post('/api/ecommerce-analysis', (_req, res) => {
  return res.status(501).json({
    error: 'Server-side ecommerce analysis is not configured; use the browser fallback parser.',
  });
});


module.exports = router;
