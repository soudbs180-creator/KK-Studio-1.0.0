import type {
  ManualRechargeProviderDto,
  RechargePaymentChannelDto,
  RechargeSubmissionStatusDto,
  SupportedRechargeCurrencyDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import type { RechargeSubmissionRecord } from "../domain/static-recharge.ts";
import type { RechargeSubmissionRepository } from "./in-memory-recharge-submission-repository.ts";

interface RechargeSubmissionRow {
  submission_id: string;
  user_id: string;
  amount: string | number;
  base_amount: string | number;
  service_fee: string | number;
  payable_amount: string | number;
  base_credits: string | number;
  bonus_credits: string | number;
  credit_amount: string | number;
  credits_per_unit: string | number;
  currency_code: string;
  payment_channel: string;
  manual_provider?: string | null;
  transfer_reference_last4?: string | null;
  note?: string | null;
  status: string;
  expires_at?: string | null;
  payment_marked_at?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_actor_user_id?: string | null;
  created_at: string;
}

const RECHARGE_SUBMISSION_SCHEMA_SQL = [
  `create table if not exists recharge_submissions (
     submission_id text primary key,
     user_id text not null,
     amount numeric(18,2) not null,
     base_amount numeric(18,2) not null,
     service_fee numeric(18,2) not null default 0,
     payable_amount numeric(18,2) not null,
     base_credits integer not null,
     bonus_credits integer not null default 0,
     credit_amount integer not null,
     credits_per_unit numeric(18,6) not null,
     currency_code text not null,
     payment_channel text not null,
     manual_provider text,
     transfer_reference_last4 text,
     note text,
     status text not null,
     expires_at timestamptz,
     payment_marked_at timestamptz,
     submitted_at timestamptz,
     reviewed_at timestamptz,
     review_actor_user_id text,
     created_at timestamptz not null
   )`,
  `create index if not exists recharge_submissions_user_created_idx
     on recharge_submissions(user_id, created_at desc)`,
  `create index if not exists recharge_submissions_status_created_idx
     on recharge_submissions(status, created_at desc)`,
] as const;

function parseNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function parseInteger(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function nullableString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function toRecord(row: RechargeSubmissionRow): RechargeSubmissionRecord {
  return {
    submissionId: row.submission_id,
    userId: row.user_id,
    amount: parseNumber(row.amount),
    baseAmount: parseNumber(row.base_amount),
    serviceFee: parseNumber(row.service_fee),
    payableAmount: parseNumber(row.payable_amount),
    baseCredits: parseInteger(row.base_credits),
    bonusCredits: parseInteger(row.bonus_credits),
    creditAmount: parseInteger(row.credit_amount),
    creditsPerUnit: parseNumber(row.credits_per_unit),
    currencyCode: row.currency_code as SupportedRechargeCurrencyDto,
    paymentChannel: row.payment_channel as RechargePaymentChannelDto,
    manualProvider: nullableString(row.manual_provider) as ManualRechargeProviderDto | null,
    transferReferenceLast4: nullableString(row.transfer_reference_last4),
    note: row.note || undefined,
    status: row.status as RechargeSubmissionStatusDto,
    createdAt: row.created_at,
    expiresAt: row.expires_at || null,
    paymentMarkedAt: row.payment_marked_at || null,
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    reviewActorUserId: row.review_actor_user_id || null,
  };
}

export class PostgresRechargeSubmissionRepository implements RechargeSubmissionRepository {
  private readonly queryable: PostgresQueryable;
  private schemaReady?: Promise<void>;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async save(submission: RechargeSubmissionRecord): Promise<RechargeSubmissionRecord> {
    await this.ensureSchema();

    const result = await this.queryable.query(
      `insert into recharge_submissions (
         submission_id, user_id, amount, base_amount, service_fee, payable_amount,
         base_credits, bonus_credits, credit_amount, credits_per_unit,
         currency_code, payment_channel, manual_provider, transfer_reference_last4,
         note, status, expires_at, payment_marked_at, submitted_at, reviewed_at,
         review_actor_user_id, created_at
       ) values (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13, $14,
         $15, $16, $17, $18, $19, $20,
         $21, $22
       )
       on conflict (submission_id) do update
         set user_id = excluded.user_id,
             amount = excluded.amount,
             base_amount = excluded.base_amount,
             service_fee = excluded.service_fee,
             payable_amount = excluded.payable_amount,
             base_credits = excluded.base_credits,
             bonus_credits = excluded.bonus_credits,
             credit_amount = excluded.credit_amount,
             credits_per_unit = excluded.credits_per_unit,
             currency_code = excluded.currency_code,
             payment_channel = excluded.payment_channel,
             manual_provider = excluded.manual_provider,
             transfer_reference_last4 = excluded.transfer_reference_last4,
             note = excluded.note,
             status = excluded.status,
             expires_at = excluded.expires_at,
             payment_marked_at = excluded.payment_marked_at,
             submitted_at = excluded.submitted_at,
             reviewed_at = excluded.reviewed_at,
             review_actor_user_id = excluded.review_actor_user_id
       returning *`,
      [
        submission.submissionId,
        submission.userId,
        submission.amount,
        submission.baseAmount ?? submission.amount,
        submission.serviceFee ?? 0,
        submission.payableAmount ?? submission.amount,
        submission.baseCredits ?? submission.creditAmount,
        submission.bonusCredits ?? 0,
        submission.creditAmount,
        submission.creditsPerUnit,
        submission.currencyCode,
        submission.paymentChannel,
        submission.manualProvider ?? null,
        submission.transferReferenceLast4 ?? null,
        submission.note ?? null,
        submission.status,
        submission.expiresAt ?? null,
        submission.paymentMarkedAt ?? null,
        submission.submittedAt ?? null,
        submission.reviewedAt ?? null,
        submission.reviewActorUserId ?? null,
        submission.createdAt,
      ],
    );

    return toRecord(result.rows[0] as RechargeSubmissionRow);
  }

  async findById(submissionId: string): Promise<RechargeSubmissionRecord | undefined> {
    await this.ensureSchema();

    const result = await this.queryable.query(
      `select *
         from recharge_submissions
        where submission_id = $1
        limit 1`,
      [submissionId],
    );

    const row = result.rows[0] as RechargeSubmissionRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  async listByUserId(userId: string): Promise<RechargeSubmissionRecord[]> {
    await this.ensureSchema();

    const result = await this.queryable.query(
      `select *
         from recharge_submissions
        where user_id = $1
        order by created_at desc`,
      [userId],
    );

    return (result.rows as RechargeSubmissionRow[]).map((row) => toRecord(row));
  }

  async listRecent(sinceIso?: string): Promise<RechargeSubmissionRecord[]> {
    await this.ensureSchema();

    const result = await this.queryable.query(
      `select *
         from recharge_submissions
        where ($1::timestamptz is null or created_at >= $1::timestamptz)
        order by created_at desc`,
      [sinceIso || null],
    );

    return (result.rows as RechargeSubmissionRow[]).map((row) => toRecord(row));
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.createSchema().catch((error: unknown) => {
        this.schemaReady = undefined;
        throw error;
      });
    }

    await this.schemaReady;
  }

  private async createSchema(): Promise<void> {
    for (const sql of RECHARGE_SUBMISSION_SCHEMA_SQL) {
      await this.queryable.query(sql);
    }
  }
}

export function createRechargeSubmissionRepositoryFromEnv(): RechargeSubmissionRepository | null {
  if (!hasPostgresConfig()) {
    return null;
  }

  return new PostgresRechargeSubmissionRepository(getSharedPostgresPool());
}
