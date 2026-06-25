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
    paymentOrders: {},
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


router.get('/api/v1/workspaces/:workspaceId/canvas', requireUser, async (req, res) => {
  const store = await readStore();
  const layout = ensureProfileStore(store, req.userId).workspaceLayout || { canvases: [] };
  const canvas = (layout.canvases || []).find((item) => String(item.id) === String(req.params.workspaceId)) || layout.canvases?.[0];
  return res.json(okEnvelope({
    workspaceId: req.params.workspaceId,
    canvasId: canvas?.id || req.params.workspaceId,
    name: canvas?.name || 'Workspace',
    nodeCount: Number(canvas?.promptNodes?.length || 0) + Number(canvas?.imageNodes?.length || 0),
    connectionCount: Number(canvas?.workflow?.edges?.length || canvas?.connections?.length || 0),
    updatedAt: new Date(canvas?.lastModified || Date.now()).toISOString(),
  }, req));
});

router.get('/api/v1/workspaces/layout', requireUser, async (req, res) => {
  const store = await readStore();
  return res.json(okEnvelope(ensureProfileStore(store, req.userId).workspaceLayout || { canvases: [] }, req));
});

router.put('/api/v1/workspaces/layout', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  profileStore.workspaceLayout = {
    canvases: Array.isArray(req.body?.canvases) ? req.body.canvases : [],
  };
  await writeStore(store);
  return res.json(okEnvelope(profileStore.workspaceLayout, req));
});

router.delete('/api/v1/workspaces/layout/cloud-images', requireUser, async (req, res) => {
  return res.json(okEnvelope({ deletedCount: 0, preservedLayout: true }, req));
});

router.put('/api/v1/workspaces/:workspaceId/workflows/:workflowId', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  if (!isObjectRecord(profileStore.workflows)) profileStore.workflows = {};
  const timestamp = nowIso();
  const workflow = {
    id: req.params.workflowId,
    workspaceId: req.params.workspaceId,
    canvasId: req.params.workspaceId,
    name: req.body?.name || 'Workflow',
    status: req.body?.status || 'draft',
    version: Number(req.body?.version || 1),
    nodes: Array.isArray(req.body?.nodes) ? req.body.nodes : [],
    edges: Array.isArray(req.body?.edges) ? req.body.edges : [],
    createdAt: profileStore.workflows[req.params.workflowId]?.createdAt || timestamp,
    updatedAt: timestamp,
  };
  profileStore.workflows[req.params.workflowId] = workflow;
  await writeStore(store);
  return res.json(okEnvelope(workflow, req));
});

router.get('/api/v1/workspaces/:workspaceId/workflows/:workflowId', requireUser, async (req, res) => {
  const store = await readStore();
  const workflow = ensureProfileStore(store, req.userId).workflows?.[req.params.workflowId];
  if (!workflow) return sendError(res, req, 404, 'WORKFLOW_NOT_FOUND', 'Workflow was not found.');
  return res.json(okEnvelope(workflow, req));
});

router.get('/api/v1/assets', requireUser, async (req, res) => {
  const store = await readStore();
  const kind = String(req.query.kind || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  let items = ensureProfileStore(store, req.userId).assets || [];
  if (kind) items = items.filter((item) => item.kind === kind);
  return res.json(okEnvelope({ items: items.slice(0, limit) }, req));
});

router.post('/api/v1/generation-tasks', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  if (!isObjectRecord(profileStore.generationTasks)) profileStore.generationTasks = {};
  const timestamp = nowIso();
  const idempotencyKey = String(req.body?.idempotencyKey || requestId(req));
  const taskId = `gen_${crypto.createHash('sha1').update(`${req.userId}:${idempotencyKey}`).digest('hex').slice(0, 24)}`;
  const task = profileStore.generationTasks[taskId] || {
    id: taskId,
    workspaceId: req.body?.workspaceId || 'default',
    workflowId: req.body?.workflowId || 'default',
    requesterId: req.userId,
    requestId: requestId(req),
    attemptId: req.body?.attemptId,
    modelCode: req.body?.modelCode || '',
    taskType: req.body?.taskType || 'image',
    status: 'pending',
    prompt: req.body?.prompt || '',
    references: Array.isArray(req.body?.references) ? req.body.references : [],
    idempotencyKey,
    createdAt: timestamp,
    results: [],
    billingStatus: 'pending',
  };
  profileStore.generationTasks[taskId] = task;
  await writeStore(store);
  return res.status(201).json(okEnvelope(task, req));
});

router.get('/api/v1/generation-tasks/:taskId', requireUser, async (req, res) => {
  const store = await readStore();
  const task = ensureProfileStore(store, req.userId).generationTasks?.[req.params.taskId];
  if (!task) return sendError(res, req, 404, 'GENERATION_TASK_NOT_FOUND', 'Generation task was not found.');
  return res.json(okEnvelope(task, req));
});


router.get('/api/generations', requireUser, async (req, res) => {
  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, user_id, prompt, image_url, created_at FROM public.generations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
        [req.userId],
      );
      return res.json({
        generations: result.rows.map((row) => ({
          id: String(row.id),
          user_id: row.user_id,
          prompt: row.prompt,
          image_url: row.image_url || '',
          created_at: new Date(row.created_at || Date.now()).toISOString(),
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  const store = await readStore();
  const tasks = Object.values(ensureProfileStore(store, req.userId).generationTasks || {});
  return res.json({
    generations: tasks.map((task) => ({
      id: String(task.id),
      user_id: req.userId,
      prompt: task.prompt || '',
      image_url: task.results?.[0]?.url || task.results?.[0]?.imageUrl || '',
      created_at: task.createdAt || nowIso(),
    })),
  });
});


router.get('/api/v1/model-catalog/models', async (req, res) => {
  if (isDbEnabled()) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, model_id, display_name, endpoint_type, credit_cost, is_active FROM public.admin_credit_models ORDER BY display_name ASC, model_id ASC',
    );
    return res.json(okEnvelope({
      items: result.rows.map((row) => ({
        id: String(row.id),
        modelCode: row.model_id,
        displayName: row.display_name,
        kind: String(row.endpoint_type || '').includes('image') ? 'image' : 'chat',
        availability: row.is_active ? 'available' : 'disabled',
        billingMode: 'credits',
        defaultCreditCost: Number(row.credit_cost || 0),
      })),
    }, req));
  }
  return res.json(okEnvelope({ items: [] }, req));
});


module.exports = router;