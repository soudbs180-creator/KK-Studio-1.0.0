#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import pg from 'pg';

const ALLOWED_CURRENCIES = new Set(['CNY', 'USD']);
const ALLOWED_PROVIDERS = new Set(['alipay', 'wechat']);
const ALLOWED_STATUSES = new Set(['created', 'pending', 'paying', 'approved', 'rejected', 'credited', 'expired']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIso(value, fallback) {
  const timestamp = new Date(value || fallback);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : fallback;
}

function normalizeLegacyStatus(value, hasProof) {
  const status = String(value || 'created').trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) return hasProof ? 'paying' : 'created';
  if ((status === 'credited' || status === 'approved') && hasProof) return 'paying';
  if ((status === 'paying' || status === 'approved') && !hasProof) return 'pending';
  return status;
}

function buildLegacyTransactionId(submissionId) {
  return `LEGACY-${crypto.createHash('sha256').update(submissionId).digest('hex').slice(0, 40).toUpperCase()}`;
}

function projectLegacyExchangeRates(store) {
  const exchangeRates = [];
  for (const item of Array.isArray(store?.exchangeRates) ? store.exchangeRates : []) {
    const currencyCode = String(item?.currencyCode || '').trim().toUpperCase();
    const creditsPerUnit = Number(item?.creditsPerUnit);
    const minAmount = item?.minAmount == null ? null : Number(item.minAmount);
    const maxAmount = item?.maxAmount == null ? null : Number(item.maxAmount);
    if (!ALLOWED_CURRENCIES.has(currencyCode) || !Number.isFinite(creditsPerUnit) || creditsPerUnit <= 0) continue;
    if (minAmount !== null && (!Number.isFinite(minAmount) || minAmount <= 0)) continue;
    if (maxAmount !== null && (!Number.isFinite(maxAmount) || maxAmount <= 0)) continue;
    if (minAmount !== null && maxAmount !== null && maxAmount < minAmount) continue;
    exchangeRates.push({
      currencyCode,
      creditsPerUnit,
      minAmount,
      maxAmount,
      isActive: item?.isActive !== false,
    });
  }
  return exchangeRates;
}

function projectLegacySubmission(profileUserId, fallbackSubmissionId, rawValue) {
  const raw = isRecord(rawValue) ? rawValue : {};
  const submissionId = String(raw.submissionId || fallbackSubmissionId).trim();
  const userId = String(raw.userId || profileUserId).trim();
  const amount = Number(raw.amount);
  const creditAmount = Number(raw.creditAmount);
  const creditsPerUnit = Number(raw.creditsPerUnit);
  const currencyCode = String(raw.currencyCode || '').trim().toUpperCase();
  const manualProvider = String(raw.manualProvider || '').trim().toLowerCase();
  const reference = String(raw.transferReferenceLast4 || '').trim().toUpperCase();
  const hasProof = /^[0-9A-Z]{4}$/.test(reference);
  if (!submissionId || !userId || !Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isSafeInteger(creditAmount) || creditAmount <= 0) return null;
  if (!Number.isFinite(creditsPerUnit) || creditsPerUnit <= 0) return null;
  if (!ALLOWED_CURRENCIES.has(currencyCode) || !ALLOWED_PROVIDERS.has(manualProvider)) return null;

  const createdAt = normalizeIso(raw.createdAt, new Date(0).toISOString());
  const importedReviewNotice = ['credited', 'approved'].includes(String(raw.status || '').toLowerCase())
    ? ' [Legacy import: previous approval requires balance reconciliation before crediting.]'
    : '';
  return {
    submissionId, userId, amount: Number(amount.toFixed(2)), creditAmount, creditsPerUnit,
    currencyCode, manualProvider,
    transferReferenceLast4: hasProof ? reference : null,
    providerTransactionId: hasProof ? buildLegacyTransactionId(submissionId) : null,
    note: `${String(raw.note || '').trim()}${importedReviewNotice}`.trim().slice(0, 500),
    status: normalizeLegacyStatus(raw.status, hasProof),
    expiresAt: raw.expiresAt ? normalizeIso(raw.expiresAt, createdAt) : null,
    paymentMarkedAt: raw.paymentMarkedAt ? normalizeIso(raw.paymentMarkedAt, createdAt) : null,
    submittedAt: raw.submittedAt ? normalizeIso(raw.submittedAt, createdAt) : null,
    reviewedAt: null, reviewActorUserId: null, createdAt,
  };
}

function projectLegacyRechargeSubmissions(store) {
  const submissions = [];
  const profiles = isRecord(store?.profiles) ? store.profiles : {};
  for (const [profileUserId, profileValue] of Object.entries(profiles)) {
    const profile = isRecord(profileValue) ? profileValue : {};
    const rechargeSubmissions = isRecord(profile.rechargeSubmissions) ? profile.rechargeSubmissions : {};
    for (const [fallbackSubmissionId, rawValue] of Object.entries(rechargeSubmissions)) {
      const submission = projectLegacySubmission(profileUserId, fallbackSubmissionId, rawValue);
      if (submission) submissions.push(submission);
    }
  }
  return submissions;
}

/**
 * 只投影可安全进入新账本的旧充值记录；异常记录被跳过，避免脏 JSON 阻断整个发布。
 */
export function projectLegacyPaymentState(store) {
  return {
    exchangeRates: projectLegacyExchangeRates(store),
    submissions: projectLegacyRechargeSubmissions(store),
  };
}

async function claimImport(client, sourceDigest) {
  const claimed = await client.query(
    `INSERT INTO public.legacy_payment_imports (source_digest)
     VALUES ($1) ON CONFLICT (source_digest) DO NOTHING RETURNING source_digest`,
    [sourceDigest],
  );
  return claimed.rowCount > 0;
}

async function upsertExchangeRates(client, exchangeRates) {
  for (const rate of exchangeRates) {
    await client.query(
      `INSERT INTO public.credit_exchange_rates (
         currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (currency_code) DO UPDATE SET
         credits_per_unit = EXCLUDED.credits_per_unit,
         min_amount = EXCLUDED.min_amount,
         max_amount = EXCLUDED.max_amount,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      [rate.currencyCode, rate.creditsPerUnit, rate.minAmount, rate.maxAmount, rate.isActive],
    );
  }
}

async function insertRechargeSubmissions(client, submissions) {
  let rechargeSubmissionCount = 0;
  for (const item of submissions) {
    const inserted = await client.query(
      `INSERT INTO public.recharge_submissions (
         submission_id, user_id, amount, base_amount, service_fee, payable_amount,
         base_credits, bonus_credits, credit_amount, credits_per_unit, currency_code,
         payment_channel, manual_provider, transfer_reference_last4, provider_transaction_id,
         note, status, expires_at, payment_marked_at, submitted_at, reviewed_at,
         review_actor_user_id, created_at
       ) SELECT
         $1, $2, $3, $3, 0, $3, $4, 0, $4, $5, $6,
         'manual', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
       WHERE EXISTS (SELECT 1 FROM public.users WHERE id = $2)
       ON CONFLICT (submission_id) DO NOTHING RETURNING submission_id`,
      [
        item.submissionId, item.userId, item.amount, item.creditAmount, item.creditsPerUnit,
        item.currencyCode, item.manualProvider, item.transferReferenceLast4,
        item.providerTransactionId, item.note, item.status, item.expiresAt,
        item.paymentMarkedAt, item.submittedAt, item.reviewedAt,
        item.reviewActorUserId, item.createdAt,
      ],
    );
    rechargeSubmissionCount += inserted.rowCount;
  }
  return rechargeSubmissionCount;
}

async function finishImport(client, sourceDigest, exchangeRateCount, rechargeSubmissionCount) {
  await client.query(
    `UPDATE public.legacy_payment_imports
        SET exchange_rate_count = $2, recharge_submission_count = $3
      WHERE source_digest = $1`,
    [sourceDigest, exchangeRateCount, rechargeSubmissionCount],
  );
}

async function importProjectedState(client, sourceDigest, projected) {
  if (!await claimImport(client, sourceDigest)) {
    return { imported: false, exchangeRateCount: 0, rechargeSubmissionCount: 0 };
  }
  await upsertExchangeRates(client, projected.exchangeRates);
  const rechargeSubmissionCount = await insertRechargeSubmissions(client, projected.submissions);
  await finishImport(client, sourceDigest, projected.exchangeRates.length, rechargeSubmissionCount);
  return {
    imported: true,
    exchangeRateCount: projected.exchangeRates.length,
    rechargeSubmissionCount,
  };
}

export async function importLegacyPaymentState({ connectionString, storePath, Pool = pg.Pool }) {
  const absoluteStorePath = path.resolve(String(storePath || ''));
  let source;
  try {
    source = await fs.readFile(absoluteStorePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { imported: false, skipped: true, exchangeRateCount: 0, rechargeSubmissionCount: 0 };
    throw error;
  }
  const parsed = JSON.parse(source);
  const projected = projectLegacyPaymentState(parsed);
  const sourceDigest = crypto.createHash('sha256').update(source).digest('hex');
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await importProjectedState(client, sourceDigest, projected);
    await client.query('COMMIT');
    return { ...result, skipped: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  const storePath = String(process.env.LEGACY_PAYMENT_STORE_PATH || process.argv[2] || '').trim();
  if (!connectionString) throw new Error('DATABASE_URL is required for legacy payment import.');
  if (!storePath) throw new Error('LEGACY_PAYMENT_STORE_PATH is required for legacy payment import.');
  const result = await importLegacyPaymentState({ connectionString, storePath });
  process.stdout.write(
    `[legacy-payment-import] ${result.skipped ? 'No legacy store found' : result.imported ? 'Import completed' : 'Source already imported'}; `
      + `exchangeRates=${result.exchangeRateCount}, rechargeSubmissions=${result.rechargeSubmissionCount}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[legacy-payment-import] Import failed:', error.message);
    process.exitCode = 1;
  });
}
