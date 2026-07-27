/**
 * @file contract-compat.js
 * @module services/api/routes
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
const rechargeSubmissions = require('../../lib/billing/rechargeSubmissions');

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
      { currencyCode: 'CNY', creditsPerUnit: 5, minAmount: 5, maxAmount: 500, isActive: true, updatedAt: nowIso() },
      { currencyCode: 'USD', creditsPerUnit: 30, minAmount: 1, maxAmount: 100, isActive: true, updatedAt: nowIso() },
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
    { id: 'price_basic_100', name: 'Basic Credits', amount: '9.90', credits: 100, currency: 'USD' },
    { id: 'price_premium_500', name: 'Premium Credits', amount: '39.90', credits: 500, currency: 'USD' },
    { id: 'price_enterprise_1500', name: 'Enterprise Credits', amount: '99.90', credits: 1500, currency: 'USD' },
  ];
}

async function listLegacyBillingPlans() {
  if (!isDbEnabled()) return defaultBillingPlans();
  const pool = getPool();
  const result = await pool.query(
    'SELECT id, name, amount_cents, credits, currency FROM public.plans ORDER BY amount_cents ASC, id ASC',
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name || row.id),
    amount: (Number(row.amount_cents || 0) / 100).toFixed(2),
    credits: Number(row.credits || 0),
    currency: String(row.currency || 'USD').toUpperCase(),
  }));
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

function buildRechargeSubmission(userId, input, overrides = {}, exchangeRates = defaultStore().exchangeRates) {
  const amount = Number(input.amount || 0);
  const currencyCode = String(input.currencyCode || '').trim().toUpperCase();
  const manualProvider = String(input.manualProvider || '').trim().toLowerCase();
  const exchangeRate = exchangeRates.find((item) => item.currencyCode === currencyCode && item.isActive !== false);
  if (input.paymentChannel !== 'manual' || !['alipay', 'wechat'].includes(manualProvider)) {
    throw Object.assign(new Error('Only configured manual alipay or wechat recharges are supported.'), {
      code: 'INVALID_RECHARGE_CHANNEL',
      statusCode: 400,
    });
  }
  if (!exchangeRate || !Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('A positive amount and active currency exchange rate are required.'), {
      code: 'INVALID_RECHARGE_PAYLOAD',
      statusCode: 400,
    });
  }
  if ((exchangeRate.minAmount !== null && amount < Number(exchangeRate.minAmount))
    || (exchangeRate.maxAmount !== null && amount > Number(exchangeRate.maxAmount))) {
    throw Object.assign(new Error('Recharge amount is outside the configured limits.'), {
      code: 'INVALID_RECHARGE_AMOUNT',
      statusCode: 400,
    });
  }
  const creditsPerUnit = Number(exchangeRate.creditsPerUnit);
  const creditAmount = Math.round(amount * creditsPerUnit);
  if (!Number.isSafeInteger(creditAmount) || creditAmount <= 0) {
    throw Object.assign(new Error('The configured exchange rate produced an invalid credit amount.'), {
      code: 'INVALID_RECHARGE_CREDITS',
      statusCode: 400,
    });
  }
  const timestamp = nowIso();
  const providerTransactionId = input.providerTransactionId || null;
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
    manualProvider,
    providerTransactionId,
    transferReferenceLast4: providerTransactionId
      ? providerTransactionId.replace(/-/g, '').slice(-4)
      : null,
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

function normalizeProviderTransactionId(value) {
  const providerTransactionId = String(value || '').trim().toUpperCase();
  if (!/^[0-9A-Z](?:[0-9A-Z-]{6,62})[0-9A-Z]$/.test(providerTransactionId)) {
    throw Object.assign(new Error('providerTransactionId must contain 8-64 letters, digits, or hyphens.'), {
      code: 'INVALID_PROVIDER_TRANSACTION_ID',
      statusCode: 400,
    });
  }
  return providerTransactionId;
}

function isProviderTransactionUsed(store, manualProvider, providerTransactionId) {
  return Object.values(store.profiles || {}).some((profileStore) => Object.values(
    profileStore?.rechargeSubmissions || {},
  ).some((submission) => (
    submission.manualProvider === manualProvider
    && submission.providerTransactionId === providerTransactionId
  )));
}

function assertUnusedProviderTransaction(store, manualProvider, providerTransactionId) {
  if (isProviderTransactionUsed(store, manualProvider, providerTransactionId)) {
    throw Object.assign(new Error('This provider transaction has already been submitted.'), {
      code: 'RECHARGE_TRANSACTION_ALREADY_USED',
      statusCode: 409,
    });
  }
}

function sendRechargeRouteError(res, req, error) {
  return sendError(
    res,
    req,
    error.statusCode || 500,
    error.code || 'RECHARGE_OPERATION_FAILED',
    error.message || 'Recharge operation failed.',
  );
}

function getPublicAppOrigin(req) {
  const configured = process.env.PUBLIC_APP_URL || process.env.KK_PUBLIC_APP_URL || process.env.WEB_PUBLIC_URL || '';
  const fallback = `${req.protocol}://${req.get('host')}`;
  const url = new URL(configured || fallback);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PUBLIC_APP_URL must use http or https.');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('PUBLIC_APP_URL must use https in production.');
  }
  return url.origin;
}

function readPaymentQrPath(envName) {
  const value = String(process.env[envName] || '').trim();
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    const localHttp = process.env.NODE_ENV !== 'production'
      && url.protocol === 'http:'
      && ['127.0.0.1', 'localhost'].includes(url.hostname);
    return url.protocol === 'https:' || localHttp ? url.toString() : null;
  } catch {
    return null;
  }
}

function buildPaymentChannel(channel, envName, label) {
  const qrImagePath = readPaymentQrPath(envName);
  return {
    channel,
    label,
    isActive: Boolean(qrImagePath),
    qrImagePath,
    qrImageDataUrl: null,
    instructionText: qrImagePath
      ? 'Complete the transfer, then submit the last four characters of the reference.'
      : 'This payment channel is not configured.',
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
  try {
    return res.json({ plans: await listLegacyBillingPlans() });
  } catch {
    return res.status(503).json({ error: 'Billing plans are temporarily unavailable.' });
  }
});

router.post('/api/billing/create-checkout', requireUser, async (req, res) => {
  const planId = String(req.body?.planId || '').trim();
  let plans;
  try {
    plans = await listLegacyBillingPlans();
  } catch {
    return res.status(503).json({ error: 'Billing plans are temporarily unavailable.' });
  }
  const plan = plans.find((item) => item.id === planId);
  if (!plan) {
    return res.status(400).json({ error: 'Invalid billing plan.' });
  }

  const amountCents = Math.round(Number(plan.amount) * 100);
  const localSessionId = `local_checkout_${crypto.randomUUID()}`;
  const origin = getPublicAppOrigin(req);

  if (isDbEnabled() && !process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'Stripe checkout is not configured.',
      code: 'STRIPE_NOT_CONFIGURED',
    });
  }

  if (isDbEnabled()) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    let session = null;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: plan.currency.toLowerCase(),
              product_data: { name: plan.name },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing/cancel`,
        metadata: {
          userId: req.userId,
          planId,
          credits: String(plan.credits),
        },
      });
      const pool = getPool();
      await pool.query(
        'INSERT INTO public.orders (id, user_id, stripe_session_id, plan_id, amount_cents, credits, currency, currency_verified, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, NOW(), NOW())',
        [`order_${crypto.randomUUID()}`, req.userId, session.id, planId, amountCents, plan.credits, plan.currency, 'pending'],
      );
      return res.json({ url: session.url, stripeSessionId: session.id });
    } catch (error) {
      if (session?.id) {
        try {
          await stripe.checkout.sessions.expire(session.id);
        } catch (expireError) {
          console.error('[contract-compat] Failed to expire an unpersisted Stripe session:', expireError.message);
        }
      }
      console.error('[contract-compat] Failed to create a durable Stripe checkout:', error.message);
      return res.status(502).json({
        error: 'Unable to create a durable checkout session.',
        code: 'CHECKOUT_CREATE_FAILED',
      });
    }
  }

  const store = await readStore();
  store.paymentOrders[localSessionId] = {
    id: `order_${crypto.randomUUID()}`,
    merchantOrderNo: localSessionId,
    status: 'pending',
    amount: plan.amount,
    currency: plan.currency,
    creditAmount: plan.credits,
    paymentUrl: `/billing?checkout=manual&planId=${encodeURIComponent(planId)}`,
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
      buildPaymentChannel('alipay', 'KK_RECHARGE_ALIPAY_QR_URL', '支付宝静态码'),
      buildPaymentChannel('wechat', 'KK_RECHARGE_WECHAT_QR_URL', '微信静态码'),
    ],
  }, req));
});

router.get('/api/v1/billing/exchange-rates', requireUser, async (req, res) => {
  if (isDbEnabled()) {
    try {
      const items = await rechargeSubmissions.listExchangeRates(getPool());
      return res.json(okEnvelope({ items }, req));
    } catch (error) {
      return sendRechargeRouteError(res, req, error);
    }
  }
  const store = await readStore();
  return res.json(okEnvelope({ items: store.exchangeRates || [] }, req));
});


router.post('/api/v1/billing/recharge-submissions', requireUser, async (req, res) => {
  if (isDbEnabled()) {
    try {
      const submission = await rechargeSubmissions.createRechargeSubmission(
        getPool(),
        req.userId,
        req.body || {},
      );
      return res.status(201).json(okEnvelope({ submission }, req));
    } catch (error) {
      return sendRechargeRouteError(res, req, error);
    }
  }
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  let submission;
  try {
    submission = buildRechargeSubmission(req.userId, req.body || {}, {}, store.exchangeRates || []);
  } catch (error) {
    return sendRechargeRouteError(res, req, error);
  }
  profileStore.rechargeSubmissions[submission.submissionId] = submission;
  await writeStore(store);
  return res.status(201).json(okEnvelope({ submission }, req));
});

router.post('/api/v1/billing/submit-recharge', requireUser, async (req, res) => {
  if (isDbEnabled()) {
    try {
      const submission = await rechargeSubmissions.createRechargeSubmission(
        getPool(),
        req.userId,
        req.body || {},
        { initialProof: req.body?.providerTransactionId },
      );
      return res.status(201).json(okEnvelope({ submission }, req));
    } catch (error) {
      return sendRechargeRouteError(res, req, error);
    }
  }
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  let submission;
  try {
    const providerTransactionId = normalizeProviderTransactionId(req.body?.providerTransactionId);
    const manualProvider = String(req.body?.manualProvider || '').trim().toLowerCase();
    assertUnusedProviderTransaction(store, manualProvider, providerTransactionId);
    submission = buildRechargeSubmission(req.userId, { ...req.body, providerTransactionId }, {
      status: 'paying',
      submittedAt: nowIso(),
      paymentMarkedAt: nowIso(),
    }, store.exchangeRates || []);
  } catch (error) {
    return sendRechargeRouteError(res, req, error);
  }
  profileStore.rechargeSubmissions[submission.submissionId] = submission;
  await writeStore(store);
  return res.status(201).json(okEnvelope({ submission }, req));
});

router.post('/api/v1/billing/recharge-submissions/:submissionId/proof', requireUser, async (req, res) => {
  if (isDbEnabled()) {
    try {
      const submission = await rechargeSubmissions.submitRechargeProof(
        getPool(),
        req.userId,
        req.params.submissionId,
        req.body || {},
      );
      return res.json(okEnvelope({ submission }, req));
    } catch (error) {
      return sendRechargeRouteError(res, req, error);
    }
  }
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const submission = profileStore.rechargeSubmissions?.[req.params.submissionId];
  if (!submission) return sendError(res, req, 404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
  let providerTransactionId;
  try {
    providerTransactionId = normalizeProviderTransactionId(req.body?.providerTransactionId);
    assertUnusedProviderTransaction(store, submission.manualProvider, providerTransactionId);
  } catch (error) {
    return sendRechargeRouteError(res, req, error);
  }
  if (!['created', 'pending'].includes(submission.status)
    || submission.providerTransactionId
    || new Date(submission.expiresAt).getTime() <= Date.now()) {
    return sendError(res, req, 409, 'RECHARGE_SUBMISSION_NOT_PAYABLE', 'Recharge submission can no longer accept payment proof.');
  }
  submission.providerTransactionId = providerTransactionId;
  submission.transferReferenceLast4 = providerTransactionId.replace(/-/g, '').slice(-4);
  submission.note = req.body?.note || submission.note || '';
  submission.status = 'paying';
  submission.paymentMarkedAt = submission.paymentMarkedAt || nowIso();
  submission.submittedAt = nowIso();
  await writeStore(store);
  return res.json(okEnvelope({ submission }, req));
});

router.post('/api/v1/billing/recharge-submissions/:submissionId/mark-paid', requireUser, async (req, res) => {
  if (isDbEnabled()) {
    try {
      const submission = await rechargeSubmissions.markRechargeSubmissionPaid(
        getPool(),
        req.userId,
        req.params.submissionId,
      );
      return res.json(okEnvelope({ submission }, req));
    } catch (error) {
      return sendRechargeRouteError(res, req, error);
    }
  }
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const submission = profileStore.rechargeSubmissions?.[req.params.submissionId];
  if (!submission) return sendError(res, req, 404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
  if (!submission.providerTransactionId) {
    return sendError(res, req, 409, 'RECHARGE_PROOF_REQUIRED', 'Submit transfer proof before marking the recharge as paid.');
  }
  submission.status = 'paying';
  submission.paymentMarkedAt = nowIso();
  await writeStore(store);
  return res.json(okEnvelope({ submission }, req));
});


module.exports = router;
