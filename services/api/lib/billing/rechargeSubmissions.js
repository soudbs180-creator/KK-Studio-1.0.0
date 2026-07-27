/**
 * @file rechargeSubmissions.js
 * @module services/api/lib/billing
 * @description 人工充值的服务端事实仓库，负责汇率快照、凭证提交和原子积分结算。
 */

const crypto = require('crypto');
const credits = require('../credits');

const ALLOWED_CURRENCIES = new Set(['CNY', 'USD']);
const ALLOWED_PROVIDERS = new Set(['alipay', 'wechat']);
const REVIEW_DECISIONS = new Set(['credit', 'reject']);

function createRechargeError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function normalizeCurrency(value) {
  const currencyCode = String(value || '').trim().toUpperCase();
  if (!ALLOWED_CURRENCIES.has(currencyCode)) {
    throw createRechargeError(400, 'INVALID_RECHARGE_CURRENCY', 'currencyCode must be CNY or USD.');
  }
  return currencyCode;
}

function normalizeProvider(input) {
  if (String(input.paymentChannel || '') !== 'manual') {
    throw createRechargeError(400, 'INVALID_RECHARGE_CHANNEL', 'Only the manual proof channel is supported here.');
  }
  const manualProvider = String(input.manualProvider || '').trim().toLowerCase();
  if (!ALLOWED_PROVIDERS.has(manualProvider)) {
    throw createRechargeError(400, 'INVALID_RECHARGE_PROVIDER', 'manualProvider must be alipay or wechat.');
  }
  return manualProvider;
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toUpperCase();
  if (!/^[0-9A-Z]{4}$/.test(reference)) {
    throw createRechargeError(400, 'INVALID_TRANSFER_REFERENCE', 'transferReferenceLast4 must contain exactly four letters or digits.');
  }
  return reference;
}

function normalizeNote(value) {
  const note = String(value || '').trim();
  if (note.length > 500) {
    throw createRechargeError(400, 'RECHARGE_NOTE_TOO_LONG', 'note must not exceed 500 characters.');
  }
  return note;
}

function normalizeRateLimit(value, fieldName) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw createRechargeError(400, 'INVALID_EXCHANGE_RATE_LIMIT', `${fieldName} must be a positive number or null.`);
  }
  return limit;
}

function mapExchangeRate(row) {
  return {
    currencyCode: String(row.currency_code),
    creditsPerUnit: Number(row.credits_per_unit),
    minAmount: row.min_amount === null ? null : Number(row.min_amount),
    maxAmount: row.max_amount === null ? null : Number(row.max_amount),
    isActive: row.is_active !== false,
    updatedAt: toIso(row.updated_at),
  };
}

function mapRechargeRow(row) {
  return {
    submissionId: String(row.submission_id),
    userId: String(row.user_id),
    amount: Number(row.amount),
    baseAmount: Number(row.base_amount),
    serviceFee: Number(row.service_fee),
    payableAmount: Number(row.payable_amount),
    baseCredits: Number(row.base_credits),
    bonusCredits: Number(row.bonus_credits),
    creditAmount: Number(row.credit_amount),
    creditsPerUnit: Number(row.credits_per_unit),
    currencyCode: String(row.currency_code),
    paymentChannel: String(row.payment_channel),
    manualProvider: row.manual_provider || null,
    transferReferenceLast4: row.transfer_reference_last4 || null,
    note: row.note || '',
    status: String(row.status),
    createdAt: toIso(row.created_at),
    expiresAt: toIso(row.expires_at),
    paymentMarkedAt: toIso(row.payment_marked_at),
    submittedAt: toIso(row.submitted_at),
    reviewedAt: toIso(row.reviewed_at),
    reviewActorUserId: row.review_actor_user_id || null,
  };
}

function validateAmount(amount, rate) {
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw createRechargeError(400, 'INVALID_RECHARGE_AMOUNT', 'amount must be a positive number.');
  }
  if (rate.minAmount !== null && normalizedAmount < rate.minAmount) {
    throw createRechargeError(400, 'RECHARGE_AMOUNT_BELOW_MINIMUM', `amount must be at least ${rate.minAmount}.`);
  }
  if (rate.maxAmount !== null && normalizedAmount > rate.maxAmount) {
    throw createRechargeError(400, 'RECHARGE_AMOUNT_ABOVE_MAXIMUM', `amount must not exceed ${rate.maxAmount}.`);
  }
  return Number(normalizedAmount.toFixed(2));
}

async function getActiveExchangeRate(clientOrPool, currencyCode) {
  const result = await clientOrPool.query(
    `SELECT currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at
       FROM public.credit_exchange_rates
      WHERE currency_code = $1 AND is_active = TRUE`,
    [currencyCode],
  );
  if (!result.rows[0]) {
    throw createRechargeError(409, 'RECHARGE_RATE_UNAVAILABLE', `No active exchange rate is configured for ${currencyCode}.`);
  }
  return mapExchangeRate(result.rows[0]);
}

function buildSubmissionValues(userId, input, rate, options) {
  const amount = validateAmount(input.amount, rate);
  const creditAmount = Math.round(amount * rate.creditsPerUnit);
  if (!Number.isSafeInteger(creditAmount) || creditAmount <= 0) {
    throw createRechargeError(400, 'INVALID_RECHARGE_CREDITS', 'The configured exchange rate produced an invalid credit amount.');
  }
  const initialProof = options.initialProof ? normalizeReference(options.initialProof) : null;
  return [
    `rch_${crypto.randomUUID()}`, userId, amount, creditAmount, rate.creditsPerUnit,
    rate.currencyCode, normalizeProvider(input), normalizeNote(input.note), initialProof,
    initialProof ? 'paying' : 'created',
  ];
}

/**
 * 创建人工充值单，并冻结创建时的汇率和应到账积分。
 */
async function createRechargeSubmission(pool, userId, input, options = {}) {
  const currencyCode = normalizeCurrency(input.currencyCode);
  const rate = await getActiveExchangeRate(pool, currencyCode);
  const values = buildSubmissionValues(userId, input, rate, options);
  const result = await pool.query(
    `INSERT INTO public.recharge_submissions (
       submission_id, user_id, amount, base_amount, service_fee, payable_amount,
       base_credits, bonus_credits, credit_amount, credits_per_unit, currency_code,
       payment_channel, manual_provider, note, transfer_reference_last4, status,
       expires_at, payment_marked_at, submitted_at, created_at
     ) VALUES (
       $1, $2, $3, $3, 0, $3, $4, 0, $4, $5, $6,
       'manual', $7, $8, $9, $10, NOW() + INTERVAL '24 hours',
       CASE WHEN $9::text IS NULL THEN NULL ELSE NOW() END,
       CASE WHEN $9::text IS NULL THEN NULL ELSE NOW() END, NOW()
     ) RETURNING *`,
    values,
  );
  return mapRechargeRow(result.rows[0]);
}

/**
 * 提交转账凭证。所有权、状态和有效期在一条原子 UPDATE 中校验。
 */
async function submitRechargeProof(pool, userId, submissionId, input) {
  const reference = normalizeReference(input.transferReferenceLast4);
  const note = normalizeNote(input.note);
  const result = await pool.query(
    `UPDATE public.recharge_submissions
        SET transfer_reference_last4 = $3,
            note = CASE WHEN $4 = '' THEN note ELSE $4 END,
            status = 'paying',
            payment_marked_at = COALESCE(payment_marked_at, NOW()), submitted_at = NOW()
      WHERE submission_id = $1 AND user_id = $2
        AND status IN ('created', 'pending', 'paying')
        AND (expires_at IS NULL OR expires_at > NOW())
      RETURNING *`,
    [submissionId, userId, reference, note],
  );
  if (result.rows[0]) return mapRechargeRow(result.rows[0]);
  await assertMutableSubmission(pool, userId, submissionId);
  throw createRechargeError(409, 'RECHARGE_SUBMISSION_NOT_PAYABLE', 'Recharge submission can no longer accept payment proof.');
}

async function assertMutableSubmission(pool, userId, submissionId) {
  const result = await pool.query(
    'SELECT status, expires_at FROM public.recharge_submissions WHERE submission_id = $1 AND user_id = $2',
    [submissionId, userId],
  );
  if (!result.rows[0]) {
    throw createRechargeError(404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
  }
  if (result.rows[0].expires_at && new Date(result.rows[0].expires_at).getTime() <= Date.now()) {
    throw createRechargeError(409, 'RECHARGE_SUBMISSION_EXPIRED', 'Recharge submission has expired.');
  }
}

/**
 * 兼容旧 mark-paid 调用；只有已经保存凭证的订单才允许进入待审核状态。
 */
async function markRechargeSubmissionPaid(pool, userId, submissionId) {
  const result = await pool.query(
    `UPDATE public.recharge_submissions
        SET status = 'paying', payment_marked_at = COALESCE(payment_marked_at, NOW())
      WHERE submission_id = $1 AND user_id = $2
        AND transfer_reference_last4 IS NOT NULL
        AND status IN ('pending', 'paying')
        AND (expires_at IS NULL OR expires_at > NOW())
      RETURNING *`,
    [submissionId, userId],
  );
  if (result.rows[0]) return mapRechargeRow(result.rows[0]);
  await assertMutableSubmission(pool, userId, submissionId);
  throw createRechargeError(409, 'RECHARGE_PROOF_REQUIRED', 'Submit transfer proof before marking the recharge as paid.');
}

/**
 * 返回生产数据库中的汇率配置。
 */
async function listExchangeRates(pool) {
  const result = await pool.query(
    `SELECT currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at
       FROM public.credit_exchange_rates ORDER BY currency_code`,
  );
  return result.rows.map(mapExchangeRate);
}

/**
 * 更新生产数据库中的汇率配置。
 */
async function upsertExchangeRate(pool, input) {
  const currencyCode = normalizeCurrency(input.currencyCode);
  const creditsPerUnit = Number(input.creditsPerUnit);
  if (!Number.isFinite(creditsPerUnit) || creditsPerUnit <= 0) {
    throw createRechargeError(400, 'INVALID_EXCHANGE_RATE', 'creditsPerUnit must be positive.');
  }
  const minAmount = normalizeRateLimit(input.minAmount, 'minAmount');
  const maxAmount = normalizeRateLimit(input.maxAmount, 'maxAmount');
  if (minAmount !== null && maxAmount !== null && maxAmount < minAmount) {
    throw createRechargeError(400, 'INVALID_EXCHANGE_RATE_LIMIT', 'maxAmount must be greater than or equal to minAmount.');
  }
  const result = await pool.query(
    `INSERT INTO public.credit_exchange_rates (
       currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at
     ) VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (currency_code) DO UPDATE SET
       credits_per_unit = EXCLUDED.credits_per_unit, min_amount = EXCLUDED.min_amount,
       max_amount = EXCLUDED.max_amount, is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *`,
    [currencyCode, creditsPerUnit, minAmount, maxAmount, input.isActive !== false],
  );
  return mapExchangeRate(result.rows[0]);
}

/**
 * 列出管理员可审核的全部人工充值单。
 */
async function listRechargeSubmissions(pool) {
  const result = await pool.query(
    'SELECT * FROM public.recharge_submissions ORDER BY created_at DESC, submission_id ASC',
  );
  return result.rows.map(mapRechargeRow);
}

/**
 * 读取单个人工充值单。
 */
async function getRechargeSubmission(pool, submissionId) {
  const result = await pool.query(
    'SELECT * FROM public.recharge_submissions WHERE submission_id = $1',
    [submissionId],
  );
  if (!result.rows[0]) {
    throw createRechargeError(404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
  }
  return mapRechargeRow(result.rows[0]);
}

async function creditLockedSubmission(client, row, adminUserId, note) {
  if (row.status === 'credited') {
    const balance = await client.query('SELECT credits FROM public.users WHERE id = $1', [row.user_id]);
    return { submission: mapRechargeRow(row), balanceAfter: Number(balance.rows[0]?.credits || 0), credited: false };
  }
  if (row.status !== 'paying' || !row.transfer_reference_last4) {
    throw createRechargeError(409, 'RECHARGE_PROOF_REQUIRED', 'Only a paid submission with transfer proof can be credited.');
  }
  const balanceAfter = await credits.addCredits(
    client, row.user_id, Number(row.credit_amount), 'manual_recharge', row.submission_id, adminUserId,
  );
  const updated = await updateReviewState(client, row.submission_id, 'credited', adminUserId, note);
  return { submission: mapRechargeRow(updated), balanceAfter, credited: true };
}

async function rejectLockedSubmission(client, row, adminUserId, note) {
  if (row.status === 'credited') {
    throw createRechargeError(409, 'RECHARGE_ALREADY_CREDITED', 'A credited recharge cannot be rejected.');
  }
  if (row.status === 'rejected') {
    return { submission: mapRechargeRow(row), balanceAfter: null, credited: false };
  }
  const updated = await updateReviewState(client, row.submission_id, 'rejected', adminUserId, note);
  return { submission: mapRechargeRow(updated), balanceAfter: null, credited: false };
}

async function updateReviewState(client, submissionId, status, adminUserId, note) {
  const result = await client.query(
    `UPDATE public.recharge_submissions
        SET status = $2, review_actor_user_id = $3, reviewed_at = NOW(),
            note = CASE WHEN $4 = '' THEN note ELSE $4 END
      WHERE submission_id = $1 RETURNING *`,
    [submissionId, status, adminUserId, normalizeNote(note)],
  );
  return result.rows[0];
}

/**
 * 审核人工充值。行锁、积分余额、审计流水和订单状态在同一事务中提交。
 */
async function reviewRechargeSubmission(pool, adminUserId, submissionId, input) {
  const decision = String(input.decision || '').trim();
  if (!REVIEW_DECISIONS.has(decision)) {
    throw createRechargeError(400, 'INVALID_RECHARGE_REVIEW', 'decision must be credit or reject.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      'SELECT * FROM public.recharge_submissions WHERE submission_id = $1 FOR UPDATE',
      [submissionId],
    );
    if (!locked.rows[0]) {
      throw createRechargeError(404, 'RECHARGE_SUBMISSION_NOT_FOUND', 'Recharge submission was not found.');
    }
    const result = decision === 'credit'
      ? await creditLockedSubmission(client, locked.rows[0], adminUserId, input.note)
      : await rejectLockedSubmission(client, locked.rows[0], adminUserId, input.note);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createRechargeSubmission,
  getRechargeSubmission,
  listExchangeRates,
  listRechargeSubmissions,
  markRechargeSubmissionPaid,
  reviewRechargeSubmission,
  submitRechargeProof,
  upsertExchangeRate,
};
