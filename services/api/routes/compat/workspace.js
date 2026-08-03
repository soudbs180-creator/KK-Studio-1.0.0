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
const {
  ClaimGenerationBatchJobRequestSchema,
  ControlGenerationBatchJobRequestSchema,
  CreateGenerationBatchJobRequestSchema,
  GenerationJobStatusSchema,
  UpdateGenerationBatchJobRequestSchema,
} = require('@kk/shared');

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

const VALID_ASSET_KINDS = new Set(['image', 'video', 'audio', 'document']);

function parseAssetDataUrl(rawDataUrl, fallbackMimeType) {
  const dataUrl = String(rawDataUrl || '').trim();
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) {
    return null;
  }

  const mimeType = String(match[1] || fallbackMimeType || '').trim().toLowerCase();
  if (!mimeType || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mimeType)) {
    return null;
  }

  const isBase64 = match[2] === ';base64';
  const payload = match[3] || '';
  try {
    const buffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
    if (buffer.length <= 0) {
      return null;
    }
    return {
      base64: buffer.toString('base64'),
      buffer,
      mimeType,
    };
  } catch {
    return null;
  }
}

function normalizeAssetId(rawId, userId, contentBase64) {
  const normalized = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 96);
  if (normalized.length >= 3) {
    return normalized;
  }

  return `asset_${crypto
    .createHash('sha1')
    .update(`${userId}:${contentBase64}:${Date.now()}`)
    .digest('hex')
    .slice(0, 24)}`;
}

function toPublicAssetRecord(asset) {
  if (!isObjectRecord(asset)) {
    return asset;
  }
  const { contentBase64, ...publicAsset } = asset;
  return publicAsset;
}

function addAssetIdReference(refs, rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return;
  }

  refs.add(value);
}

function collectAssetReferences(value, refs, key = '') {
  if (typeof value === 'string') {
    const assetUrlPattern = /\/api\/v1\/assets\/([^/?#]+)\/content/g;
    let match;
    while ((match = assetUrlPattern.exec(value)) !== null) {
      try {
        addAssetIdReference(refs, decodeURIComponent(match[1]));
      } catch {
        addAssetIdReference(refs, match[1]);
      }
    }

    if (['storageId', 'assetId', 'originalAssetId', 'thumbnailAssetId', 'cloudAssetId'].includes(key)) {
      addAssetIdReference(refs, value);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectAssetReferences(item, refs, key));
    return;
  }

  if (isObjectRecord(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => {
      collectAssetReferences(childValue, refs, childKey);
    });
  }
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
      generationJobs: {},
      assets: [],
      rechargeSubmissions: {},
    };
  }
  return store.profiles[userId];
}

function ensureGenerationJobs(profileStore) {
  if (!isObjectRecord(profileStore.generationJobs)) profileStore.generationJobs = {};
  return profileStore.generationJobs;
}

function buildGenerationJobProgress(total) {
  return {
    total,
    queued: total,
    running: 0,
    completed: 0,
    failed: 0,
    percent: 0,
    phase: 'queued',
  };
}

function toGenerationJobDto(row) {
  const payload = isObjectRecord(row.payload_json) ? row.payload_json : {};
  const items = Array.isArray(payload.items)
    ? payload.items
    : (Array.isArray(payload.prompts) ? payload.prompts.map((prompt) => ({
      id: prompt.id,
      prompt: prompt.prompt,
      referenceImageNodeId: prompt.referenceImageNodeId,
      targetNodeId: prompt.targetNodeId,
      status: 'queued',
      retryCount: 0,
      outputs: [],
    })) : []);
  const createdAt = new Date(row.created_at || Date.now()).toISOString();
  const updatedAt = new Date(row.updated_at || row.created_at || Date.now()).toISOString();
  return {
    schemaVersion: Number(row.schema_version || 2),
    id: String(row.job_id || row.id),
    idempotencyKey: String(row.idempotency_key || ''),
    workspaceId: String(row.workspace_id || payload.workspaceId || 'default'),
    modelCode: String(row.model_code || payload.modelCode || ''),
    taskType: row.task_type || payload.taskType || 'image',
    status: row.status || 'queued',
    parameters: payload.parameters || { taskType: row.task_type || 'image' },
    progress: isObjectRecord(row.progress_json)
      ? row.progress_json
      : buildGenerationJobProgress(Number(payload.prompts?.length || 0)),
    outputs: Array.isArray(row.outputs_json) ? row.outputs_json : [],
    items,
    outputGroup: row.output_group_json || payload.outputGroup,
    createdAt,
    updatedAt,
    leaseOwner: row.lease_owner || undefined,
    leaseExpiresAt: row.lease_expires_at ? new Date(row.lease_expires_at).toISOString() : undefined,
  };
}

function mapGenerationJobControlStatus(status, action) {
  if (action === 'cancel') return 'cancelled';
  if (action === 'pause' && (status === 'queued' || status === 'running')) return 'paused';
  if (action === 'resume' && status === 'paused') return 'queued';
  if (action === 'retry' && (status === 'failed' || status === 'completed_with_errors')) return 'queued';
  return status;
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

router.get('/api/v1/workspaces/layout/meta', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const layout = profileStore.workspaceLayout || { canvases: [] };

  const canvasesMeta = (layout.canvases || []).map(canvas => {
    const cardMetas = [];

    (canvas.promptNodes || []).forEach(node => {
      cardMetas.push({
        id: node.id,
        x: node.position?.x || 0,
        y: node.position?.y || 0,
        width: node.width || 360,
        height: node.height || 200,
        type: 'prompt',
        updatedAt: node.timestamp || Date.now()
      });
    });

    (canvas.imageNodes || []).forEach(node => {
      cardMetas.push({
        id: node.id,
        x: node.position?.x || 0,
        y: node.position?.y || 0,
        width: node.width || 400,
        height: node.height || 600,
        type: 'image',
        thumbnailUrl: node.apiResultUrl || node.url,
        updatedAt: node.timestamp || Date.now()
      });
    });

    (canvas.workflow?.nodes || []).forEach(node => {
      cardMetas.push({
        id: node.id,
        x: node.position?.x || 0,
        y: node.position?.y || 0,
        width: node.width || 200,
        height: node.height || 176,
        type: 'workflow',
        updatedAt: node.timestamp || Date.now()
      });
    });

    return {
      canvasId: canvas.id,
      name: canvas.name,
      folderName: canvas.folderName,
      lastModified: canvas.lastModified,
      cardMetas
    };
  });

  return res.json(okEnvelope({ canvases: canvasesMeta }, req));
});

router.get('/api/v1/workspaces/cards/:cardId', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const layout = profileStore.workspaceLayout || { canvases: [] };
  const cardId = req.params.cardId;

  for (const canvas of layout.canvases || []) {
    const promptNode = (canvas.promptNodes || []).find(n => n.id === cardId);
    if (promptNode) {
      return res.json(okEnvelope({ type: 'prompt', detail: promptNode }, req));
    }
    const imageNode = (canvas.imageNodes || []).find(n => n.id === cardId);
    if (imageNode) {
      return res.json(okEnvelope({ type: 'image', detail: imageNode }, req));
    }
    const workflowNode = (canvas.workflow?.nodes || []).find(n => n.id === cardId);
    if (workflowNode) {
      return res.json(okEnvelope({ type: 'workflow', detail: workflowNode }, req));
    }
  }

  const { sendError } = require('./compatHelper');
  return sendError(res, req, 404, 'CARD_NOT_FOUND', 'Card was not found.');
});

router.post('/api/v1/workspaces/layout/batch-sync', requireUser, async (req, res) => {
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  if (!profileStore.workspaceLayout) {
    profileStore.workspaceLayout = { canvases: [] };
  }
  const layout = profileStore.workspaceLayout;
  const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];

  operations.forEach(op => {
    const canvasId = op.canvasId || (layout.canvases?.[0]?.id) || 'default';
    let canvas = (layout.canvases || []).find(c => c.id === canvasId);
    if (!canvas) {
      canvas = {
        id: canvasId,
        name: 'Workspace',
        promptNodes: [],
        imageNodes: [],
        groups: [],
        drawings: [],
        workflow: { nodes: [], edges: [] },
        lastModified: Date.now()
      };
      if (!layout.canvases) layout.canvases = [];
      layout.canvases.push(canvas);
    }

    const { action, cardId, data } = op;

    if (action === 'CREATE') {
      const type = data.type;
      if (type === 'prompt') {
        if (!canvas.promptNodes.some(n => n.id === cardId)) {
          canvas.promptNodes.push({ id: cardId, ...data.detail });
        }
      } else if (type === 'image') {
        if (!canvas.imageNodes.some(n => n.id === cardId)) {
          canvas.imageNodes.push({ id: cardId, ...data.detail });
        }
      } else if (type === 'workflow') {
        if (!canvas.workflow) canvas.workflow = { nodes: [], edges: [] };
        if (!canvas.workflow.nodes) canvas.workflow.nodes = [];
        if (!canvas.workflow.nodes.some(n => n.id === cardId)) {
          canvas.workflow.nodes.push({ id: cardId, ...data.detail });
        }
      }
    } else if (action === 'UPDATE' || action === 'MOVE') {
      let found = false;
      const promptIdx = canvas.promptNodes.findIndex(n => n.id === cardId);
      if (promptIdx !== -1) {
        canvas.promptNodes[promptIdx] = { ...canvas.promptNodes[promptIdx], ...data };
        found = true;
      }
      if (!found) {
        const imgIdx = canvas.imageNodes.findIndex(n => n.id === cardId);
        if (imgIdx !== -1) {
          canvas.imageNodes[imgIdx] = { ...canvas.imageNodes[imgIdx], ...data };
          found = true;
        }
      }
      if (!found && canvas.workflow?.nodes) {
        const wfIdx = canvas.workflow.nodes.findIndex(n => n.id === cardId);
        if (wfIdx !== -1) {
          canvas.workflow.nodes[wfIdx] = { ...canvas.workflow.nodes[wfIdx], ...data };
          found = true;
        }
      }
    } else if (action === 'DELETE') {
      canvas.promptNodes = canvas.promptNodes.filter(n => n.id !== cardId);
      canvas.imageNodes = canvas.imageNodes.filter(n => n.id !== cardId);
      if (canvas.workflow?.nodes) {
        canvas.workflow.nodes = canvas.workflow.nodes.filter(n => n.id !== cardId);
      }
    }
    
    canvas.lastModified = Date.now();
  });

  await writeStore(store);
  return res.json(okEnvelope({ success: true, lastModified: Date.now() }, req));
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
  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  const assets = Array.isArray(profileStore.assets) ? profileStore.assets : [];
  const referencedAssetIds = new Set();

  collectAssetReferences(profileStore.workspaceLayout || { canvases: [] }, referencedAssetIds);

  const beforeCount = assets.length;
  profileStore.assets = assets.filter((asset) => {
    if (!isObjectRecord(asset) || asset.kind !== 'image') {
      return true;
    }
    return referencedAssetIds.has(String(asset.id));
  });

  const deletedCount = beforeCount - profileStore.assets.length;
  if (deletedCount > 0) {
    await writeStore(store);
  }

  return res.json(okEnvelope({ deletedCount, preservedLayout: true }, req));
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
  return res.json(okEnvelope({ items: items.slice(0, limit).map(toPublicAssetRecord) }, req));
});

router.post('/api/v1/assets', requireUser, async (req, res) => {
  const kind = String(req.body?.kind || '').trim();
  if (!VALID_ASSET_KINDS.has(kind)) {
    return sendError(res, req, 400, 'ASSET_KIND_INVALID', 'Asset kind must be image, video, audio, or document.');
  }

  const parsed = parseAssetDataUrl(req.body?.dataUrl, req.body?.mimeType);
  if (!parsed) {
    return sendError(res, req, 400, 'ASSET_DATA_INVALID', 'A valid data URL asset payload is required.');
  }

  const store = await readStore();
  const profileStore = ensureProfileStore(store, req.userId);
  if (!Array.isArray(profileStore.assets)) {
    profileStore.assets = [];
  }

  const assetId = normalizeAssetId(req.body?.id, req.userId, parsed.base64);
  const now = nowIso();
  const storagePath = `/api/v1/assets/${encodeURIComponent(assetId)}/content`;
  const asset = {
    id: assetId,
    kind,
    storagePath,
    mimeType: parsed.mimeType,
    sizeBytes: Number.isFinite(Number(req.body?.sizeBytes)) && Number(req.body?.sizeBytes) > 0
      ? Number(req.body.sizeBytes)
      : parsed.buffer.length,
    metadata: isObjectRecord(req.body?.metadata) ? req.body.metadata : {},
    createdAt: now,
    updatedAt: now,
    contentBase64: parsed.base64,
  };

  const existingIndex = profileStore.assets.findIndex((item) => item.id === assetId);
  if (existingIndex >= 0) {
    const existing = profileStore.assets[existingIndex];
    profileStore.assets[existingIndex] = {
      ...asset,
      createdAt: existing.createdAt || asset.createdAt,
    };
  } else {
    profileStore.assets.unshift(asset);
  }

  await writeStore(store);
  const publicAsset = toPublicAssetRecord(existingIndex >= 0 ? profileStore.assets[existingIndex] : asset);
  return res.status(201).json(okEnvelope({ asset: publicAsset, url: publicAsset.storagePath }, req));
});

router.get('/api/v1/assets/:assetId/content', requireUser, async (req, res) => {
  const store = await readStore();
  const assetId = String(req.params.assetId || '').trim();
  const asset = (ensureProfileStore(store, req.userId).assets || []).find((item) => item.id === assetId);
  if (!asset || !asset.contentBase64) {
    return sendError(res, req, 404, 'ASSET_NOT_FOUND', 'Asset was not found.');
  }

  const buffer = Buffer.from(asset.contentBase64, 'base64');
  res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('Content-Length', String(buffer.length));
  return res.end(buffer);
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

router.post('/api/v1/generation-jobs', requireUser, async (req, res) => {
  const parsed = CreateGenerationBatchJobRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, req, 400, 'INVALID_GENERATION_JOB', 'Generation job payload is invalid.', parsed.error.issues);
  }

  const input = parsed.data;
  const progress = buildGenerationJobProgress(input.prompts.length);
  const items = input.prompts.map((prompt) => ({
    id: prompt.id,
    prompt: prompt.prompt,
    referenceImageNodeId: prompt.referenceImageNodeId,
    targetNodeId: prompt.targetNodeId,
    status: 'queued',
    retryCount: 0,
    outputs: [],
  }));
  const persistedPayload = { ...input, items };
  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `INSERT INTO public.generation_jobs (
          user_id, workspace_id, task_type, provider, status, progress, schema_version,
          idempotency_key, model_code, payload_json, progress_json, outputs_json, output_group_json, updated_at
        ) VALUES ($1, $2, $3, 'route-engine', 'queued', 0, 2, $4, $5, $6, $7, '[]'::jsonb, $8, NOW())
        ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
        DO UPDATE SET updated_at = public.generation_jobs.updated_at
        RETURNING *`,
        [
          req.userId,
          input.workspaceId,
          input.taskType,
          input.idempotencyKey,
          input.modelCode,
          JSON.stringify(persistedPayload),
          JSON.stringify(progress),
          input.outputGroup ? JSON.stringify(input.outputGroup) : null,
        ],
      );
      return res.status(201).json(okEnvelope(toGenerationJobDto(result.rows[0]), req));
    } catch (error) {
      return sendError(res, req, 500, 'GENERATION_JOB_CREATE_FAILED', error.message);
    }
  }

  const store = await readStore();
  const jobs = ensureGenerationJobs(ensureProfileStore(store, req.userId));
  const existing = Object.values(jobs).find((job) => job.idempotencyKey === input.idempotencyKey);
  if (existing) return res.status(201).json(okEnvelope(existing, req));

  const timestamp = nowIso();
  const id = `job_${crypto.createHash('sha1').update(`${req.userId}:${input.idempotencyKey}`).digest('hex').slice(0, 24)}`;
  const job = {
    schemaVersion: 2,
    id,
    idempotencyKey: input.idempotencyKey,
    workspaceId: input.workspaceId,
    modelCode: input.modelCode,
    taskType: input.taskType,
    status: 'queued',
    parameters: input.parameters,
    progress,
    outputs: [],
    items,
    outputGroup: input.outputGroup,
    prompts: input.prompts,
    concurrency: input.concurrency,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  jobs[id] = job;
  await writeStore(store);
  return res.status(201).json(okEnvelope(job, req));
});

router.get('/api/v1/generation-jobs', requireUser, async (req, res) => {
  const rawStatuses = Array.isArray(req.query.status) ? req.query.status : req.query.status ? [req.query.status] : [];
  const statuses = rawStatuses.filter((status) => GenerationJobStatusSchema.safeParse(status).success);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const cursor = req.query.cursor && Number.isFinite(Date.parse(String(req.query.cursor)))
    ? new Date(String(req.query.cursor)).toISOString()
    : null;

  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT * FROM public.generation_jobs
         WHERE user_id = $1
           AND ($2::text[] IS NULL OR status = ANY($2::text[]))
           AND ($3::timestamptz IS NULL OR created_at < $3::timestamptz)
         ORDER BY created_at DESC
         LIMIT $4`,
        [req.userId, statuses.length > 0 ? statuses : null, cursor, limit],
      );
      const jobs = result.rows.map(toGenerationJobDto);
      return res.json(okEnvelope({ jobs, cursor: jobs.length === limit ? jobs[jobs.length - 1].createdAt : undefined }, req));
    } catch (error) {
      return sendError(res, req, 500, 'GENERATION_JOB_LIST_FAILED', error.message);
    }
  }

  const store = await readStore();
  let jobs = Object.values(ensureGenerationJobs(ensureProfileStore(store, req.userId)));
  if (statuses.length > 0) jobs = jobs.filter((job) => statuses.includes(job.status));
  if (cursor) jobs = jobs.filter((job) => job.createdAt < cursor);
  jobs = jobs.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, limit);
  return res.json(okEnvelope({ jobs, cursor: jobs.length === limit ? jobs[jobs.length - 1].createdAt : undefined }, req));
});

router.get('/api/v1/generation-jobs/:jobId', requireUser, async (req, res) => {
  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query('SELECT * FROM public.generation_jobs WHERE job_id::text = $1 AND user_id = $2', [req.params.jobId, req.userId]);
      if (!result.rows[0]) return sendError(res, req, 404, 'GENERATION_JOB_NOT_FOUND', 'Generation job was not found.');
      return res.json(okEnvelope(toGenerationJobDto(result.rows[0]), req));
    } catch (error) {
      return sendError(res, req, 500, 'GENERATION_JOB_READ_FAILED', error.message);
    }
  }
  const store = await readStore();
  const job = ensureGenerationJobs(ensureProfileStore(store, req.userId))[req.params.jobId];
  if (!job) return sendError(res, req, 404, 'GENERATION_JOB_NOT_FOUND', 'Generation job was not found.');
  return res.json(okEnvelope(job, req));
});

router.patch('/api/v1/generation-jobs/:jobId', requireUser, async (req, res) => {
  const parsed = UpdateGenerationBatchJobRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, req, 400, 'INVALID_GENERATION_JOB_UPDATE', 'Generation job update is invalid.', parsed.error.issues);
  const input = parsed.data;

  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `UPDATE public.generation_jobs SET
          status = COALESCE($3, status),
          progress = COALESCE($4, progress),
          progress_json = COALESCE($5::jsonb, progress_json),
          outputs_json = COALESCE($6::jsonb, outputs_json),
          lease_owner = COALESCE($7, lease_owner),
          lease_expires_at = COALESCE($8::timestamptz, lease_expires_at),
          payload_json = CASE WHEN $9::jsonb IS NULL THEN payload_json ELSE jsonb_set(payload_json, '{items}', $9::jsonb, true) END,
          updated_at = NOW()
         WHERE job_id::text = $1 AND user_id = $2
           AND lease_owner = $7 AND lease_expires_at >= NOW()
         RETURNING *`,
        [
          req.params.jobId,
          req.userId,
          input.status || null,
          input.progress?.percent ?? null,
          input.progress ? JSON.stringify(input.progress) : null,
          input.outputs ? JSON.stringify(input.outputs) : null,
          input.leaseOwner || null,
          input.leaseExpiresAt || null,
          input.items ? JSON.stringify(input.items) : null,
        ],
      );
      if (!result.rows[0]) return sendError(res, req, 409, 'GENERATION_JOB_LEASE_CONFLICT', 'A valid generation job lease is required to update progress.');
      return res.json(okEnvelope(toGenerationJobDto(result.rows[0]), req));
    } catch (error) {
      return sendError(res, req, 500, 'GENERATION_JOB_UPDATE_FAILED', error.message);
    }
  }

  const store = await readStore();
  const jobs = ensureGenerationJobs(ensureProfileStore(store, req.userId));
  const job = jobs[req.params.jobId];
  if (!job) return sendError(res, req, 404, 'GENERATION_JOB_NOT_FOUND', 'Generation job was not found.');
  if (job.leaseOwner !== input.leaseOwner || !job.leaseExpiresAt || Date.parse(job.leaseExpiresAt) < Date.now()) {
    return sendError(res, req, 409, 'GENERATION_JOB_LEASE_CONFLICT', 'A valid generation job lease is required to update progress.');
  }
  jobs[req.params.jobId] = { ...job, ...input, updatedAt: nowIso() };
  await writeStore(store);
  return res.json(okEnvelope(jobs[req.params.jobId], req));
});

router.post('/api/v1/generation-jobs/:jobId/control', requireUser, async (req, res) => {
  const parsed = ControlGenerationBatchJobRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, req, 400, 'INVALID_GENERATION_JOB_CONTROL', 'Generation job control is invalid.', parsed.error.issues);

  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const existing = await pool.query('SELECT * FROM public.generation_jobs WHERE job_id::text = $1 AND user_id = $2', [req.params.jobId, req.userId]);
      if (!existing.rows[0]) return sendError(res, req, 404, 'GENERATION_JOB_NOT_FOUND', 'Generation job was not found.');
      const nextStatus = mapGenerationJobControlStatus(existing.rows[0].status, parsed.data.action);
      const result = await pool.query(
        'UPDATE public.generation_jobs SET status = $3, updated_at = NOW() WHERE job_id::text = $1 AND user_id = $2 RETURNING *',
        [req.params.jobId, req.userId, nextStatus],
      );
      return res.json(okEnvelope(toGenerationJobDto(result.rows[0]), req));
    } catch (error) {
      return sendError(res, req, 500, 'GENERATION_JOB_CONTROL_FAILED', error.message);
    }
  }

  const store = await readStore();
  const jobs = ensureGenerationJobs(ensureProfileStore(store, req.userId));
  const job = jobs[req.params.jobId];
  if (!job) return sendError(res, req, 404, 'GENERATION_JOB_NOT_FOUND', 'Generation job was not found.');
  job.status = mapGenerationJobControlStatus(job.status, parsed.data.action);
  job.updatedAt = nowIso();
  await writeStore(store);
  return res.json(okEnvelope(job, req));
});

router.post('/api/v1/generation-jobs/:jobId/claim', requireUser, async (req, res) => {
  const parsed = ClaimGenerationBatchJobRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, req, 400, 'INVALID_GENERATION_JOB_CLAIM', 'Generation job claim is invalid.', parsed.error.issues);
  const { leaseOwner, leaseSeconds } = parsed.data;

  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `UPDATE public.generation_jobs
         SET lease_owner = $3, lease_expires_at = NOW() + ($4 * INTERVAL '1 second'), updated_at = NOW()
         WHERE job_id::text = $1 AND user_id = $2
           AND (lease_expires_at IS NULL OR lease_expires_at < NOW() OR lease_owner = $3)
         RETURNING *`,
        [req.params.jobId, req.userId, leaseOwner, leaseSeconds],
      );
      if (!result.rows[0]) return sendError(res, req, 409, 'GENERATION_JOB_LEASE_CONFLICT', 'Generation job is already claimed by another client.');
      return res.json(okEnvelope(toGenerationJobDto(result.rows[0]), req));
    } catch (error) {
      return sendError(res, req, 500, 'GENERATION_JOB_CLAIM_FAILED', error.message);
    }
  }

  const store = await readStore();
  const jobs = ensureGenerationJobs(ensureProfileStore(store, req.userId));
  const job = jobs[req.params.jobId];
  if (!job) return sendError(res, req, 404, 'GENERATION_JOB_NOT_FOUND', 'Generation job was not found.');
  const leaseActive = job.leaseExpiresAt && Date.parse(job.leaseExpiresAt) > Date.now();
  if (leaseActive && job.leaseOwner !== leaseOwner) {
    return sendError(res, req, 409, 'GENERATION_JOB_LEASE_CONFLICT', 'Generation job is already claimed by another client.');
  }
  job.leaseOwner = leaseOwner;
  job.leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  job.updatedAt = nowIso();
  await writeStore(store);
  return res.json(okEnvelope(job, req));
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
  const defaultItems = [
    {
      id: 'default-imagen-4',
      modelCode: 'imagen-4.0-generate-001',
      displayName: 'Imagen 4.0 Standard',
      kind: 'image',
      availability: 'available',
      billingMode: 'credits',
      defaultCreditCost: 10,
    },
    {
      id: 'default-imagen-4-ultra',
      modelCode: 'imagen-4.0-ultra-generate-001',
      displayName: 'Imagen 4.0 Ultra',
      kind: 'image',
      availability: 'available',
      billingMode: 'credits',
      defaultCreditCost: 15,
    },
    {
      id: 'default-imagen-4-fast',
      modelCode: 'imagen-4.0-fast-generate-001',
      displayName: 'Imagen 4.0 Fast',
      kind: 'image',
      availability: 'available',
      billingMode: 'credits',
      defaultCreditCost: 10,
    },
    {
      id: 'default-imagen-3',
      modelCode: 'imagen-3.0-generate-001',
      displayName: 'Imagen 3.0 Pro',
      kind: 'image',
      availability: 'available',
      billingMode: 'credits',
      defaultCreditCost: 10,
    },
    {
      id: 'default-dalle-3',
      modelCode: 'dall-e-3',
      displayName: 'DALL-E 3',
      kind: 'image',
      availability: 'available',
      billingMode: 'credits',
      defaultCreditCost: 15,
    },
    {
      id: 'default-gpt-4o-mini',
      modelCode: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      kind: 'chat',
      availability: 'available',
      billingMode: 'credits',
      defaultCreditCost: 2,
    },
    {
      id: 'default-gpt-4o',
      modelCode: 'gpt-4o',
      displayName: 'GPT-4o',
      kind: 'chat',
      availability: 'available',
      billingMode: 'credits',
      defaultCreditCost: 5,
    },
    {
      id: 'default-gemini-2.5-flash',
      modelCode: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      kind: 'chat',
      availability: 'available',
      billingMode: 'credits',
      defaultCreditCost: 2,
    }
  ];
  return res.json(okEnvelope({ items: defaultItems }, req));
});


module.exports = router;
