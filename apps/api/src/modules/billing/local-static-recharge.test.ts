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
    assert.equal(typeof (billing as Record<string, unknown>).handleSubmitRecharge, "function");
    assert.equal(typeof (billing as Record<string, unknown>).validateSubmitRechargeRequest, "function");
    assert.equal(typeof (billing as Record<string, unknown>).StaticRechargeService, "function");
    assert.equal(typeof (billing as Record<string, unknown>).FileBackedCreditAccountRepository, "function");
    assert.equal(typeof (billing as Record<string, unknown>).FileBackedCreditExchangeRateRepository, "function");
    assert.equal(typeof (billing as Record<string, unknown>).FileBackedRechargeSubmissionRepository, "function");
    assert.equal(typeof (billing as Record<string, unknown>).InMemoryRechargeSubmissionRepository, "function");
  });
});

describe("billing local static recharge flow", () => {
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

  test("approves a persisted recharge submission and credits the account through admin recharge", async () => {
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

    const submitted = await service.submitRecharge("user-local-3", {
      amount: 8,
      currencyCode: "CNY",
      paymentChannel: "manual",
      transferReferenceLast4: "6789",
      note: "bank transfer",
    }, "req-local-submit-2");

    assert.equal(submitted.success, true);
    if (!submitted.success) {
      return;
    }

    const approval = await service.applyApprovedRechargeSubmission(
      submitted.data.submission.submissionId,
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
      submitted.data.submission.submissionId,
    );

    assert.ok(persistedSubmission);
    assert.equal(persistedSubmission?.status, "credited");
    assert.ok(persistedSubmission?.reviewedAt);
  });
});
