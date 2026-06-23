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

const TEMP_USER_ID_HEADER = 'x-kk-temp-user-id';
const ADMIN_SESSION_TOKEN_HEADER = 'x-kk-admin-session-token';
const ACCESS_TOKEN_COOKIE_NAME = 'kk.api.access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'kk.api.refresh_token';
const LOCAL_STORE_PATH = path.resolve(__dirname, '../../.kk-local/contract-compat.json');
const DEFAULT_CREDIT_BALANCE = 999999;

function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL) && process.env.KKAI_LOCAL_ONLY !== 'true';
}

function nowIso() {
  return new Date().toISOString();
}

function requestId(req) {
  return String(req.headers['x-request-id'] || req.headers['x-client-request-id'] || '').trim() || `req-${Date.now()}`;
}

function meta(req) {
  return {
    requestId: requestId(req),
    timestamp: nowIso(),
  };
}

function okEnvelope(data, req) {
  return {
    success: true,
    data,
    meta: meta(req),
  };
}

function sendError(res, req, status, code, message, details) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: meta(req),
  });
}

function readCookieValue(req, name) {
  const rawCookie = String(req.headers.cookie || '');
  if (!rawCookie) return '';
  const encodedName = encodeURIComponent(name);
  const pair = rawCookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encodedName}=`) || part.startsWith(`${name}=`));
  if (!pair) return '';
  const rawValue = pair.slice(pair.indexOf('=') + 1);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function resolveRequestUserId(req, options = {}) {
  const directUserId = verifyJWT(req.headers.authorization);
  if (directUserId) return directUserId;

  const cookieToken = readCookieValue(req, ACCESS_TOKEN_COOKIE_NAME) || readCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);
  if (cookieToken) {
    const cookieUserId = verifyJWT(`Bearer ${cookieToken}`);
    if (cookieUserId) return cookieUserId;
  }

  const explicitRefreshToken = String(req.body?.refreshToken || '').trim();
  if (explicitRefreshToken) {
    const refreshUserId = verifyJWT(`Bearer ${explicitRefreshToken}`);
    if (refreshUserId) return refreshUserId;
  }

  const allowTemp = options.allowTemp !== false;
  const allowLocalTempUser = process.env.KKAI_LOCAL_ONLY === 'true' || process.env.NODE_ENV !== 'production';
  const tempUserId = String(req.headers[TEMP_USER_ID_HEADER] || '').trim();
  if (allowTemp && allowLocalTempUser && /^temp-[a-zA-Z0-9_.-]{4,128}$/.test(tempUserId)) {
    return tempUserId;
  }

  return null;
}

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


router.get('/api/v1/billing/credits/balance', requireUser, async (req, res) => {
  if (isDbEnabled()) {
    const balance = await credits.getUserCredits(req.userId);
    return res.json(okEnvelope({ accountId: req.userId, userId: req.userId, balance: Math.max(0, balance), frozenBalance: 0 }, req));
  }
  const store = await readStore();
  return res.json(okEnvelope({ accountId: req.userId, userId: req.userId, balance: ensureProfileStore(store, req.userId).creditBalance, frozenBalance: 0 }, req));
});

router.get('/api/v1/billing/credits/transactions', requireUser, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  if (isDbEnabled()) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, user_id, delta, reason, operation_key, balance_after, created_at FROM public.credit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.userId, limit],
    );
    return res.json(okEnvelope({ items: result.rows.map(mapCreditLog) }, req));
  }
  const store = await readStore();
  return res.json(okEnvelope({ items: (ensureProfileStore(store, req.userId).creditTransactions || []).slice(0, limit) }, req));
});

router.post('/api/v1/billing/credits/debit', requireUser, async (req, res) => {
  const amount = Number(req.body?.creditAmount || 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return sendError(res, req, 400, 'INVALID_CREDIT_AMOUNT', 'creditAmount must be a positive integer.');
  }
  const ledgerId = `ledger_${crypto.randomUUID()}`;
  if (isDbEnabled()) {
    const balanceAfter = await credits.deductCredits(req.userId, amount, req.body?.businessRefType || ledgerId);
    return res.json(okEnvelope({ ledgerId, balanceAfter, transactionType: 'debit' }, req));
  }
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  profileStore.creditBalance = Math.max(0, Number(profileStore.creditBalance || 0) - amount);
  profileStore.creditTransactions.unshift({
    id: ledgerId,
    userId: req.userId,
    transactionType: 'debit',
    amount,
    balanceAfter: profileStore.creditBalance,
    description: req.body?.businessRefType || 'manual_debit',
    status: 'completed',
    businessRefType: req.body?.businessRefType || null,
    businessRefId: req.body?.businessRefId || null,
    createdAt: nowIso(),
  });
  await writeStore(store);
  return res.json(okEnvelope({ ledgerId, balanceAfter: profileStore.creditBalance, transactionType: 'debit' }, req));
});

router.post('/api/v1/billing/credits/refunds', requireUser, async (req, res) => {
  const originalTransactionId = String(req.body?.transactionId || '').trim();
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const original = (profileStore.creditTransactions || []).find((item) => String(item.id) === originalTransactionId);
  const amount = Number(original?.amount || 0);
  const refundedLedgerId = `refund_${crypto.randomUUID()}`;
  profileStore.creditBalance = Number(profileStore.creditBalance || 0) + amount;
  profileStore.creditTransactions.unshift({
    id: refundedLedgerId,
    userId: req.userId,
    transactionType: 'refund',
    amount,
    balanceAfter: profileStore.creditBalance,
    description: req.body?.reason || 'refund',
    status: 'completed',
    businessRefId: originalTransactionId,
    createdAt: nowIso(),
  });
  await writeStore(store);
  return res.json(okEnvelope({ originalTransactionId, refundedLedgerId, balanceAfter: profileStore.creditBalance, transactionType: 'refund' }, req));
});


router.get('/api/billing/plans', async (_req, res) => {
  return res.json({ plans: await listLegacyBillingPlans() });
});

router.post('/api/billing/create-checkout', requireUser, async (req, res) => {
  const planId = String(req.body?.planId || '').trim();
  const plans = await listLegacyBillingPlans();
  const plan = plans.find((item) => item.id === planId);
  if (!plan) {
    return res.status(400).json({ error: 'Invalid billing plan.' });
  }

  const amountCents = Math.round(Number(plan.amount) * 100);
  const localSessionId = `local_checkout_${crypto.randomUUID()}`;
  const successUrl = String(req.body?.successUrl || '').trim();
  const cancelUrl = String(req.body?.cancelUrl || '').trim();
  const origin = `${req.protocol}://${req.get('host')}`;

  if (isDbEnabled() && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: String(req.body?.currency || 'usd').toLowerCase(),
              product_data: { name: plan.name },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl || `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${origin}/billing/cancel`,
        metadata: {
          userId: req.userId,
          planId,
          credits: String(plan.credits),
        },
      });
      const pool = getPool();
      await pool.query(
        'INSERT INTO public.orders (id, user_id, stripe_session_id, plan_id, amount_cents, credits, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) ON CONFLICT (stripe_session_id) DO NOTHING',
        [`order_${crypto.randomUUID()}`, req.userId, session.id, planId, amountCents, plan.credits, 'pending'],
      );
      return res.json({ url: session.url, stripeSessionId: session.id });
    } catch (error) {
      return res.status(502).json({ error: error.message, code: 'CHECKOUT_CREATE_FAILED' });
    }
  }

  const store = await readStore();
  store.paymentOrders[localSessionId] = {
    id: `order_${crypto.randomUUID()}`,
    merchantOrderNo: localSessionId,
    status: 'pending',
    amount: plan.amount,
    currency: String(req.body?.currency || 'USD').toUpperCase(),
    creditAmount: plan.credits,
    paymentUrl: successUrl || `/billing?checkout=manual&planId=${encodeURIComponent(planId)}`,
    providerCode: 'manual',
    userId: req.userId,
    settlementApplied: false,
    tradeStatus: 'WAIT_BUYER_PAY',
    createdAt: nowIso(),
  };
  await writeStore(store);
  return res.json({
    url: store.paymentOrders[localSessionId].paymentUrl,
    stripeSessionId: localSessionId,
  });
});


router.get('/api/v1/billing/payment-channels', requireUser, async (req, res) => {
  return res.json(okEnvelope({
    items: [
      { channel: 'manual', label: 'Manual', isActive: true, instructionText: 'Submit transfer proof for manual review.' },
      { channel: 'alipay', label: 'Alipay', isActive: true },
      { channel: 'wechat', label: 'WeChat Pay', isActive: true },
    ],
  }, req));
});

router.get('/api/v1/billing/exchange-rates', requireUser, async (req, res) => {
  const store = await readStore();
  return res.json(okEnvelope({ items: store.exchangeRates || [] }, req));
});


router.post('/api/v1/billing/recharge-submissions', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const submission = buildRechargeSubmission(req.userId, req.body || {});
  profileStore.rechargeSubmissions[submission.submissionId] = submission;
  await writeStore(store);
  return res.status(201).json(okEnvelope({ submission }, req));
});

router.post('/api/v1/billing/submit-recharge', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const submission = buildRechargeSubmission(req.userId, req.body || {}, { status: 'pending', submittedAt: nowIso(), paymentMarkedAt: nowIso() });
  profileStore.rechargeSubmissions[submission.submissionId] = submission;
  await writeStore(store);
  return res.status(201).json(okEnvelope({ submission }, req));
});

router.post('/api/v1/billing/recharge-submissions/:submissionId/proof', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const submission = profileStore.rechargeSubmissions?.[req.params.submissionId];
  if (!submission) return sendError(res, req, 404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
  submission.transferReferenceLast4 = req.body?.transferReferenceLast4 || submission.transferReferenceLast4 || null;
  submission.note = req.body?.note || submission.note || '';
  submission.status = 'pending';
  submission.submittedAt = nowIso();
  await writeStore(store);
  return res.json(okEnvelope({ submission }, req));
});

router.post('/api/v1/billing/recharge-submissions/:submissionId/mark-paid', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const submission = profileStore.rechargeSubmissions?.[req.params.submissionId];
  if (!submission) return sendError(res, req, 404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
  submission.status = 'paying';
  submission.paymentMarkedAt = nowIso();
  await writeStore(store);
  return res.json(okEnvelope({ submission }, req));
});


module.exports = router;