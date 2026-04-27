import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, test } from "node:test";

import {
  AUTHENTICATED_USER_ID_HEADER,
} from "../../../../../packages/shared/src/index.ts";
import * as billing from "./index.ts";

const tempDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kk-billing-local-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, {
    force: true,
    recursive: true,
  })));
});

describe("billing local static recharge exports", () => {
  test("exports the local static recharge primitives", () => {
    assert.equal(typeof (billing as Record<string, unknown>).handleCreateRechargeSubmission, "function");
    assert.equal(typeof (billing as Record<string, unknown>).validateCreateRechargeSubmissionRequest, "function");
    assert.equal(typeof (billing as Record<string, unknown>).handleSubmitRecharge, "function");
    assert.equal(typeof (billing as Record<string, unknown>).validateSubmitRechargeRequest, "function");
    assert.equal(typeof (billing as Record<string, unknown>).handleSubmitRechargeProof, "function");
    assert.equal(typeof (billing as Record<string, unknown>).validateSubmitRechargeProofRequest, "function");
    assert.equal(typeof (billing as Record<string, unknown>).handleGetAdminRechargeSubmission, "function");
    assert.equal(typeof (billing as Record<string, unknown>).handleReviewRechargeSubmission, "function");
    assert.equal(typeof (billing as Record<string, unknown>).validateReviewRechargeSubmissionRequest, "function");
    assert.equal(typeof (billing as Record<string, unknown>).StaticRechargeService, "function");
    assert.equal(typeof (billing as Record<string, unknown>).FileBackedCreditAccountRepository, "function");
    assert.equal(typeof (billing as Record<string, unknown>).FileBackedCreditExchangeRateRepository, "function");
    assert.equal(typeof (billing as Record<string, unknown>).FileBackedRechargeSubmissionRepository, "function");
    assert.equal(typeof (billing as Record<string, unknown>).InMemoryRechargeSubmissionRepository, "function");
  });
});

describe("billing local static recharge flow", () => {
  test("creates manual recharge orders with fee split, paid marker priority, idempotent review, and expiry guard", async () => {
    let now = new Date("2026-04-27T08:00:00.000Z");
    const submissionRepository = new (billing as any).InMemoryRechargeSubmissionRepository();
    const creditRepository = new billing.InMemoryCreditAccountRepository(10);
    const creditAccountService = new billing.CreditAccountService(creditRepository);
    const service = new (billing as any).StaticRechargeService({
      submissionRepository,
      exchangeRateRepository: new billing.InMemoryCreditExchangeRateRepository({
        CNY: {
          creditsPerUnit: 7,
          minAmount: 5,
          maxAmount: 100,
          isActive: true,
        },
      }),
      creditAccountService,
      manualRechargeFeeGenerator: () => 0.2,
      nowProvider: () => now,
    });

    const first = await service.createRechargeSubmission("user-manual-1", {
      amount: 20,
      currencyCode: "CNY",
      paymentChannel: "manual",
      manualProvider: "alipay",
    }, "req-manual-create-1");
    const second = await service.createRechargeSubmission("user-manual-2", {
      amount: 20,
      currencyCode: "CNY",
      paymentChannel: "manual",
      manualProvider: "wechat",
    }, "req-manual-create-2");

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    if (!first.success || !second.success) {
      return;
    }

    assert.equal(first.data.submission.userId, undefined);
    assert.equal(first.data.submission.status, "paying");
    assert.equal(first.data.submission.manualProvider, "alipay");
    assert.equal(first.data.submission.baseAmount, 20);
    assert.equal(first.data.submission.serviceFee, 0.2);
    assert.equal(first.data.submission.payableAmount, 20.2);
    assert.equal(first.data.submission.baseCredits, 140);
    assert.equal(first.data.submission.bonusCredits, 1);
    assert.equal(first.data.submission.creditAmount, 141);
    assert.equal(first.data.submission.paymentMarkedAt, null);
    assert.equal(first.data.submission.expiresAt, "2026-04-27T08:05:00.000Z");

    const marked = await service.markRechargeSubmissionPaid(
      "user-manual-2",
      second.data.submission.submissionId,
      "req-manual-paid-1",
    );
    assert.equal(marked.success, true);
    if (!marked.success) {
      return;
    }
    assert.equal(marked.data.submission.status, "paying");
    assert.equal(marked.data.submission.paymentMarkedAt, "2026-04-27T08:00:00.000Z");

    const adminList = await service.listAdminRechargeSubmissions("req-manual-list-1");
    assert.equal(adminList.success, true);
    if (!adminList.success) {
      return;
    }
    assert.equal(adminList.data.items[0].submissionId, second.data.submission.submissionId);
    assert.equal(adminList.data.items[0].paymentMarkedAt, "2026-04-27T08:00:00.000Z");
    assert.equal(adminList.data.items[1].submissionId, first.data.submission.submissionId);

    const reviewed = await service.reviewRechargeSubmission(
      second.data.submission.submissionId,
      "credit",
      "admin-manual-1",
      "req-manual-credit-1",
    );
    const duplicateReview = await service.reviewRechargeSubmission(
      second.data.submission.submissionId,
      "credit",
      "admin-manual-1",
      "req-manual-credit-2",
    );
    assert.equal(reviewed.success, true);
    assert.equal(duplicateReview.success, true);
    if (!reviewed.success || !duplicateReview.success) {
      return;
    }
    assert.equal(reviewed.data.creditAmount, 141);
    assert.equal(reviewed.data.recharge?.balanceAfter, 151);
    assert.equal(duplicateReview.data.recharge?.balanceAfter, 151);
    assert.equal(duplicateReview.data.submission.status, "credited");

    const transactions = await creditAccountService.listTransactions(
      "user-manual-2",
      { transactionType: "recharge", limit: 10 },
      "req-manual-transactions-1",
    );
    assert.equal(transactions.success, true);
    if (transactions.success) {
      assert.equal(transactions.data.items.length, 1);
      assert.equal(transactions.data.items[0].businessRefType, "manual_recharge");
      assert.equal(transactions.data.items[0].businessRefId, second.data.submission.submissionId);
    }

    now = new Date("2026-04-27T08:06:00.000Z");
    const expiredReview = await service.reviewRechargeSubmission(
      first.data.submission.submissionId,
      "credit",
      "admin-manual-1",
      "req-manual-expired-1",
    );
    assert.equal(expiredReview.success, false);
    if (!expiredReview.success) {
      assert.equal(expiredReview.error.code, "RECHARGE_SUBMISSION_EXPIRED");
    }
  });

  test("accepts a static recharge submission through the billing handler", async () => {
    const submissionRepository = new (billing as any).InMemoryRechargeSubmissionRepository();
    const rateRepository = new billing.InMemoryCreditExchangeRateRepository({
      CNY: {
        creditsPerUnit: 7,
        minAmount: 5,
        maxAmount: 100,
        isActive: true,
      },
    });
    const service = new (billing as any).StaticRechargeService({
      submissionRepository,
      exchangeRateRepository: rateRepository,
      creditAccountService: new billing.CreditAccountService(
        new billing.InMemoryCreditAccountRepository(10),
      ),
    });

    const result = await (billing as any).handleSubmitRecharge(service, {
      amount: 8,
      currencyCode: "CNY",
      paymentChannel: "manual",
      transferReferenceLast4: "4321",
      note: "local transfer",
    }, {
      [AUTHENTICATED_USER_ID_HEADER]: "user-local-1",
      "x-request-id": "req-local-submit-1",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(result.body.data.submission.status, "pending");
    assert.equal(result.body.data.submission.currencyCode, "CNY");
    assert.equal(result.body.data.submission.paymentChannel, "manual");
    assert.equal(result.body.data.submission.transferReferenceLast4, "4321");
    assert.ok(result.body.data.submission.submittedAt);
  });

  test("persists file-backed credit balances and exchange rates across repository instances", async () => {
    const directory = await createTempDirectory();
    const creditFile = path.join(directory, "credit-accounts.json");
    const exchangeRateFile = path.join(directory, "exchange-rates.json");

    const creditRepository = new (billing as any).FileBackedCreditAccountRepository({
      filePath: creditFile,
      initialBalance: 10,
    });
    const creditService = new billing.CreditAccountService(creditRepository);

    const rechargeResponse = await creditService.adminRechargeCredits({
      identity: "user-local-2",
      creditAmount: 25,
      description: "seed local credit",
    }, "admin-local-1", "req-local-credit-1");

    assert.equal(rechargeResponse.success, true);
    if (!rechargeResponse.success) {
      return;
    }

    const reloadedCreditRepository = new (billing as any).FileBackedCreditAccountRepository({
      filePath: creditFile,
      initialBalance: 10,
    });
    const reloadedCreditService = new billing.CreditAccountService(reloadedCreditRepository);
    const balanceResponse = await reloadedCreditService.getBalance("user-local-2", "req-local-credit-2");

    assert.equal(balanceResponse.success, true);
    if (!balanceResponse.success) {
      return;
    }

    assert.equal(balanceResponse.data.balance, 35);

    const exchangeRateRepository = new (billing as any).FileBackedCreditExchangeRateRepository({
      filePath: exchangeRateFile,
    });
    const exchangeRateService = new billing.CreditExchangeRateService(exchangeRateRepository);

    await exchangeRateService.upsertRate({
      currencyCode: "CNY",
      creditsPerUnit: 9,
      minAmount: 6,
      maxAmount: 300,
      isActive: true,
    }, "admin-local-1", "req-local-rate-1");

    const reloadedExchangeRateRepository = new (billing as any).FileBackedCreditExchangeRateRepository({
      filePath: exchangeRateFile,
    });
    const rateListResponse = await new billing.CreditExchangeRateService(
      reloadedExchangeRateRepository,
    ).listRates("req-local-rate-2");

    assert.equal(rateListResponse.success, true);
    if (!rateListResponse.success) {
      return;
    }

    const cnyRate = rateListResponse.data.items.find((item) => item.currencyCode === "CNY");
    assert.ok(cnyRate);
    assert.equal(cnyRate?.creditsPerUnit, 9);
    assert.equal(cnyRate?.minAmount, 6);
  });

  test("creates a persisted recharge bill, submits proof, and credits the account by submission id", async () => {
    const directory = await createTempDirectory();
    const creditFile = path.join(directory, "credit-accounts.json");
    const exchangeRateFile = path.join(directory, "exchange-rates.json");
    const submissionFile = path.join(directory, "recharge-submissions.json");

    const submissionRepository = new (billing as any).FileBackedRechargeSubmissionRepository({
      filePath: submissionFile,
    });
    const exchangeRateRepository = new (billing as any).FileBackedCreditExchangeRateRepository({
      filePath: exchangeRateFile,
      seed: {
        CNY: {
          creditsPerUnit: 7,
          minAmount: 5,
          maxAmount: 100,
          isActive: true,
        },
      },
    });
    const creditAccountService = new billing.CreditAccountService(
      new (billing as any).FileBackedCreditAccountRepository({
        filePath: creditFile,
        initialBalance: 10,
      }),
    );
    const service = new (billing as any).StaticRechargeService({
      submissionRepository,
      exchangeRateRepository,
      creditAccountService,
    });

    const created = await service.createRechargeSubmission("user-local-3", {
      amount: 8,
      currencyCode: "CNY",
      paymentChannel: "manual",
    }, "req-local-create-2");

    assert.equal(created.success, true);
    if (!created.success) {
      return;
    }

    assert.equal(created.data.submission.status, "created");
    assert.equal(created.data.submission.transferReferenceLast4, null);
    assert.equal(created.data.submission.submittedAt, null);

    const submitted = await service.submitRechargeProof(
      "user-local-3",
      created.data.submission.submissionId,
      {
      transferReferenceLast4: "6789",
      note: "bank transfer",
      },
      "req-local-submit-2",
    );

    assert.equal(submitted.success, true);
    if (!submitted.success) {
      return;
    }

    assert.equal(submitted.data.submission.status, "pending");
    assert.equal(submitted.data.submission.transferReferenceLast4, "6789");
    assert.equal(submitted.data.submission.submittedAt != null, true);

    const adminLookup = await service.getAdminRechargeSubmission(
      created.data.submission.submissionId,
      "req-local-admin-lookup-1",
    );

    assert.equal(adminLookup.success, true);
    if (!adminLookup.success) {
      return;
    }

    assert.equal(adminLookup.data.submission.userId, "user-local-3");
    assert.equal(adminLookup.data.submission.creditAmount, 56);
    assert.equal(adminLookup.data.submission.submissionId, created.data.submission.submissionId);

    const approval = await service.reviewRechargeSubmission(
      created.data.submission.submissionId,
      "credit",
      "admin-local-2",
      "req-local-approve-1",
    );

    assert.equal(approval.success, true);
    if (!approval.success) {
      return;
    }

    assert.equal(approval.data.creditAmount, 56);
    assert.equal(approval.data.recharge.identity, "user-local-3");
    assert.equal(approval.data.recharge.balanceAfter, 66);
    assert.equal(approval.data.submission.status, "credited");

    const reloadedCreditService = new billing.CreditAccountService(
      new (billing as any).FileBackedCreditAccountRepository({
        filePath: creditFile,
        initialBalance: 10,
      }),
    );
    const balanceResponse = await reloadedCreditService.getBalance("user-local-3", "req-local-balance-3");

    assert.equal(balanceResponse.success, true);
    if (!balanceResponse.success) {
      return;
    }

    assert.equal(balanceResponse.data.balance, 66);

    const reloadedSubmissionRepository = new (billing as any).FileBackedRechargeSubmissionRepository({
      filePath: submissionFile,
    });
    const persistedSubmission = await reloadedSubmissionRepository.findById(
      created.data.submission.submissionId,
    );

    assert.ok(persistedSubmission);
    assert.equal(persistedSubmission?.status, "credited");
    assert.ok(persistedSubmission?.reviewedAt);
  });

  test("rejects a pending recharge submission without changing the credited balance", async () => {
    const submissionRepository = new (billing as any).InMemoryRechargeSubmissionRepository();
    const exchangeRateRepository = new billing.InMemoryCreditExchangeRateRepository({
      CNY: {
        creditsPerUnit: 7,
        minAmount: 5,
        maxAmount: 100,
        isActive: true,
      },
    });
    const creditAccountService = new billing.CreditAccountService(
      new billing.InMemoryCreditAccountRepository(10),
    );
    const service = new (billing as any).StaticRechargeService({
      submissionRepository,
      exchangeRateRepository,
      creditAccountService,
    });

    const created = await service.createRechargeSubmission("user-local-4", {
      amount: 12,
      currencyCode: "CNY",
      paymentChannel: "manual",
    }, "req-local-create-3");

    assert.equal(created.success, true);
    if (!created.success) {
      return;
    }

    const submitted = await service.submitRechargeProof(
      "user-local-4",
      created.data.submission.submissionId,
      {
        transferReferenceLast4: "2468",
        note: "reject me",
      },
      "req-local-submit-3",
    );

    assert.equal(submitted.success, true);
    if (!submitted.success) {
      return;
    }

    const rejected = await service.reviewRechargeSubmission(
      created.data.submission.submissionId,
      "reject",
      "admin-local-3",
      "req-local-reject-1",
    );

    assert.equal(rejected.success, true);
    if (!rejected.success) {
      return;
    }

    assert.equal(rejected.data.submission.status, "rejected");
    assert.equal(rejected.data.recharge, null);
    assert.equal(rejected.data.creditAmount, 84);

    const balanceResponse = await creditAccountService.getBalance(
      "user-local-4",
      "req-local-balance-4",
    );

    assert.equal(balanceResponse.success, true);
    if (!balanceResponse.success) {
      return;
    }

    assert.equal(balanceResponse.data.balance, 10);
  });
});
