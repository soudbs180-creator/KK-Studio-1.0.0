import assert from "node:assert/strict";
import { test } from "node:test";

import type { RechargeSubmissionRecord } from "../../apps/api/src/modules/billing/domain/static-recharge.ts";
import {
  PostgresRechargeSubmissionRepository,
} from "../../apps/api/src/modules/billing/infrastructure/postgres-recharge-submission-repository.ts";

interface RecordedQuery {
  sql: string;
  values: unknown[];
}

class FakeQueryable {
  readonly queries: RecordedQuery[] = [];

  async query(sql: string, values: unknown[] = []) {
    this.queries.push({ sql, values });

    if (/insert into recharge_submissions/i.test(sql)) {
      return {
        rows: [buildRechargeSubmissionRow()],
      };
    }

    if (/select \*/i.test(sql)) {
      return {
        rows: [buildRechargeSubmissionRow()],
      };
    }

    return { rows: [] };
  }
}

function buildRechargeSubmission(): RechargeSubmissionRecord {
  return {
    submissionId: "recharge-submission-1",
    userId: "user-recharge-1",
    amount: 20,
    baseAmount: 20,
    serviceFee: 0.2,
    payableAmount: 20.2,
    baseCredits: 140,
    bonusCredits: 1,
    creditAmount: 141,
    creditsPerUnit: 7,
    currencyCode: "CNY",
    paymentChannel: "manual",
    manualProvider: "alipay",
    transferReferenceLast4: null,
    status: "paying",
    createdAt: "2026-04-28T08:00:00.000Z",
    expiresAt: "2026-04-28T08:05:00.000Z",
    paymentMarkedAt: null,
    submittedAt: null,
    reviewedAt: null,
    reviewActorUserId: null,
  };
}

function buildRechargeSubmissionRow() {
  const record = buildRechargeSubmission();
  return {
    submission_id: record.submissionId,
    user_id: record.userId,
    amount: record.amount,
    base_amount: record.baseAmount,
    service_fee: record.serviceFee,
    payable_amount: record.payableAmount,
    base_credits: record.baseCredits,
    bonus_credits: record.bonusCredits,
    credit_amount: record.creditAmount,
    credits_per_unit: record.creditsPerUnit,
    currency_code: record.currencyCode,
    payment_channel: record.paymentChannel,
    manual_provider: record.manualProvider,
    transfer_reference_last4: record.transferReferenceLast4,
    note: null,
    status: record.status,
    expires_at: record.expiresAt,
    payment_marked_at: record.paymentMarkedAt,
    submitted_at: record.submittedAt,
    reviewed_at: record.reviewedAt,
    review_actor_user_id: record.reviewActorUserId,
    created_at: record.createdAt,
  };
}

test("Postgres recharge submission repository ensures schema before runtime queries", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresRechargeSubmissionRepository(fakeQueryable as never);

  await repository.save(buildRechargeSubmission());
  await repository.findById("recharge-submission-1");

  const createTableQueries = fakeQueryable.queries.filter((entry) => (
    /create table if not exists recharge_submissions/i.test(entry.sql)
  ));
  const createIndexQueries = fakeQueryable.queries.filter((entry) => (
    /create index if not exists recharge_submissions_/i.test(entry.sql)
  ));
  const firstInsertIndex = fakeQueryable.queries.findIndex((entry) => (
    /insert into recharge_submissions/i.test(entry.sql)
  ));
  const firstCreateTableIndex = fakeQueryable.queries.findIndex((entry) => (
    /create table if not exists recharge_submissions/i.test(entry.sql)
  ));

  assert.equal(createTableQueries.length, 1);
  assert.equal(createIndexQueries.length, 2);
  assert.equal(firstCreateTableIndex, 0);
  assert.ok(firstInsertIndex > firstCreateTableIndex);
});
