import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import {
  AUTHENTICATED_ADMIN_SESSION_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
  AUTHENTICATED_USER_ROLE_HEADER,
} from "../../packages/shared/src/index.ts";
import { startApiServer } from "../../apps/api/src/server.ts";
import { CreditExchangeRateService } from "../../apps/api/src/modules/billing/application/credit-exchange-rate-service.ts";
import { RechargePaymentChannelConfigService } from "../../apps/api/src/modules/billing/application/recharge-payment-channel-config-service.ts";
import { CreditAccountService } from "../../apps/api/src/modules/billing/application/credit-account-service.ts";
import { StaticRechargeService } from "../../apps/api/src/modules/billing/application/static-recharge-service.ts";
import { InMemoryCreditAccountRepository } from "../../apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts";
import { InMemoryCreditExchangeRateRepository } from "../../apps/api/src/modules/billing/infrastructure/in-memory-credit-exchange-rate-repository.ts";
import { InMemoryRechargePaymentChannelConfigRepository } from "../../apps/api/src/modules/billing/infrastructure/in-memory-recharge-payment-channel-config-repository.ts";
import { InMemoryRechargeSubmissionRepository } from "../../apps/api/src/modules/billing/infrastructure/in-memory-recharge-submission-repository.ts";
import {
  handleAdminRechargeCredits,
  handleDebitCredits,
  handleGetCreditBalance,
  handleListCreditTransactions,
  handleRefundCredits,
} from "../../apps/api/src/modules/billing/presentation/http-billing-routes.ts";
import {
  handleListCreditExchangeRates,
  handleListRechargePaymentChannels,
  handleUpsertCreditExchangeRate,
  validateUpsertCreditExchangeRateRequest,
} from "../../apps/api/src/modules/billing/presentation/http-credit-exchange-rate-routes.ts";
import {
  handleCreateRechargeSubmission,
  handleGetAdminRechargeSubmission,
  handleListAdminRechargeSubmissions,
  handleMarkRechargeSubmissionPaid,
  handleReviewRechargeSubmission,
  handleSubmitRecharge,
  handleSubmitRechargeProof,
} from "../../apps/api/src/modules/billing/presentation/http-static-recharge-routes.ts";

const trackedServers = new Set<Awaited<ReturnType<typeof startApiServer>>>();

async function withMutedConsoleWarnAsync<T>(callback: () => Promise<T>): Promise<T> {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    return await callback();
  } finally {
    console.warn = originalWarn;
  }
}

function getBaseUrl(server: Awaited<ReturnType<typeof startApiServer>>): string {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

function createStaticRechargeFixture(initialBalance = 10) {
  const creditAccountService = new CreditAccountService(
    new InMemoryCreditAccountRepository(initialBalance),
  );

  return {
    creditAccountService,
    service: new StaticRechargeService({
      submissionRepository: new InMemoryRechargeSubmissionRepository(),
      exchangeRateRepository: new InMemoryCreditExchangeRateRepository({
        CNY: {
          creditsPerUnit: 7,
          minAmount: 5,
          maxAmount: 100,
          isActive: true,
        },
      }),
      creditAccountService,
    }),
  };
}

after(async () => {
  for (const server of trackedServers) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  trackedServers.clear();
});

describe("billing http routes", () => {
  test("requires an authenticated billing identity", async () => {
    const service = new CreditAccountService(new InMemoryCreditAccountRepository());
    const result = await handleGetCreditBalance(service, {
      "x-request-id": "req-billing-auth",
    });

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.success, false);
    if (!result.body.success) {
      assert.equal(result.body.error.code, "AUTH_REQUIRED");
    }
  });

  test("returns a stable balance and idempotent debit response", async () => {
    const service = new CreditAccountService(new InMemoryCreditAccountRepository(12));
    const headers = {
      "x-request-id": "req-billing-balance",
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-1",
    };

    const initial = await handleGetCreditBalance(service, headers);
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.body.success, true);
    if (!initial.body.success) {
      return;
    }
    assert.equal(initial.body.data.balance, 12);

    const debitRequest = {
      businessRefType: "generation_task",
      businessRefId: "task-1",
      creditAmount: 5,
      idempotencyKey: "idem-billing-1",
    };

    const firstDebit = await handleDebitCredits(service, debitRequest, {
      ...headers,
      "x-request-id": "req-billing-debit-1",
    });
    const secondDebit = await handleDebitCredits(service, debitRequest, {
      ...headers,
      "x-request-id": "req-billing-debit-2",
    });

    assert.equal(firstDebit.statusCode, 200);
    assert.equal(secondDebit.statusCode, 200);
    assert.equal(firstDebit.body.success, true);
    assert.equal(secondDebit.body.success, true);
    if (firstDebit.body.success && secondDebit.body.success) {
      assert.equal(firstDebit.body.data.ledgerId, secondDebit.body.data.ledgerId);
      assert.equal(firstDebit.body.data.balanceAfter, 7);
      assert.equal(secondDebit.body.data.balanceAfter, 7);
    }
  });

  test("returns conflict when balance is insufficient", async () => {
    const service = new CreditAccountService(new InMemoryCreditAccountRepository(2));
    const result = await handleDebitCredits(service, {
      businessRefType: "generation_task",
      businessRefId: "task-2",
      creditAmount: 5,
      idempotencyKey: "idem-billing-2",
    }, {
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-2",
      "x-request-id": "req-billing-insufficient",
    });

    assert.equal(result.statusCode, 409);
    assert.equal(result.body.success, false);
    if (!result.body.success) {
      assert.equal(result.body.error.code, "CREDIT_BALANCE_INSUFFICIENT");
    }
  });

  test("prevents tampered debit amount below model pricing floor", async () => {
    const mockCreditProviderRepository = {
      listActiveRuntimeRoutes: async (modelId?: string) => {
        if (modelId === "gemini-2.5-flash-image") {
          return [
            {
              providerId: "test-provider",
              providerName: "Test Provider",
              baseUrl: "http://test",
              apiKeys: ["key"],
              modelId: "gemini-2.5-flash-image",
              displayName: "Nano Banana",
              endpointType: "image",
              creditCost: 12,
              priority: 1,
              weight: 1,
              callCount: 0,
              advancedEnabled: false,
              mixWithSameModel: false,
            },
          ];
        }
        return [];
      },
      listAdminProviders: async () => [],
      listActiveCreditModels: async () => [],
      saveAdminProvider: async () => ({ providerId: "", providerName: "", apiKeyCount: 0, modelCount: 0 }),
      getProviderPricingCache: async () => null,
      saveProviderPricingCache: async () => { throw new Error("not implemented"); },
      getSharedProviderPricingCache: async () => null,
      saveSharedProviderPricingCache: async () => { throw new Error("not implemented"); },
      deleteAdminProvider: async () => false,
    };

    const service = new CreditAccountService(
      new InMemoryCreditAccountRepository(20),
      mockCreditProviderRepository,
    );

    const headers = {
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-test",
      "x-request-id": "req-billing-tamper-check",
    };

    const tamperedResult = await handleDebitCredits(service, {
      businessRefType: "generation_task",
      businessRefId: "task-tamper",
      creditAmount: 5,
      modelCode: "gemini-2.5-flash-image",
      idempotencyKey: "idem-billing-tamper-1",
    }, headers);

    assert.equal(tamperedResult.statusCode, 409);
    assert.equal(tamperedResult.body.success, false);
    if (!tamperedResult.body.success) {
      assert.equal(tamperedResult.body.error.code, "INVALID_REQUEST");
      assert.match(tamperedResult.body.error.message, /below the minimum price floor/);
    }

    const validResult = await handleDebitCredits(service, {
      businessRefType: "generation_task",
      businessRefId: "task-tamper",
      creditAmount: 12,
      modelCode: "gemini-2.5-flash-image",
      idempotencyKey: "idem-billing-tamper-2",
    }, headers);

    assert.equal(validResult.statusCode, 200);
    assert.equal(validResult.body.success, true);
  });

  test("lists transactions and refunds a completed debit entry", async () => {
    const service = new CreditAccountService(new InMemoryCreditAccountRepository(20));
    const headers = {
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-3",
      "x-request-id": "req-billing-refund-seed",
    };

    const debit = await handleDebitCredits(service, {
      businessRefType: "generation_task",
      businessRefId: "task-3",
      creditAmount: 5,
      idempotencyKey: "idem-billing-3",
    }, headers);

    assert.equal(debit.statusCode, 200);
    assert.equal(debit.body.success, true);
    if (!debit.body.success) {
      return;
    }

    const list = await handleListCreditTransactions(service, {
      transactionType: "consumption",
      limit: 10,
    }, {
      ...headers,
      "x-request-id": "req-billing-list-1",
    });

    assert.equal(list.statusCode, 200);
    assert.equal(list.body.success, true);
    if (!list.body.success) {
      return;
    }

    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.items[0].transactionType, "consumption");
    assert.equal(list.body.data.items[0].balanceAfter, 15);

    const refund = await handleRefundCredits(service, {
      transactionId: debit.body.data.ledgerId,
      reason: "test refund",
    }, {
      ...headers,
      "x-request-id": "req-billing-refund-1",
    });

    assert.equal(refund.statusCode, 200);
    assert.equal(refund.body.success, true);
    if (!refund.body.success) {
      return;
    }

    assert.equal(refund.body.data.originalTransactionId, debit.body.data.ledgerId);
    assert.equal(refund.body.data.balanceAfter, 20);

    const secondRefund = await handleRefundCredits(service, {
      transactionId: debit.body.data.ledgerId,
      reason: "duplicate refund",
    }, {
      ...headers,
      "x-request-id": "req-billing-refund-2",
    });

    assert.equal(secondRefund.statusCode, 409);
    assert.equal(secondRefund.body.success, false);
    if (!secondRefund.body.success) {
      assert.equal(secondRefund.body.error.code, "CREDIT_TRANSACTION_NOT_REFUNDABLE");
    }
  });

  test("admin recharge requires an authenticated admin and returns the new balance", async () => {
    const service = new CreditAccountService(new InMemoryCreditAccountRepository());

    const unauthorized = await handleAdminRechargeCredits(service, {
      identity: "user-billing-admin-1",
      creditAmount: 25,
      description: "admin top up",
    }, {
      "x-request-id": "req-billing-admin-unauthorized",
    });

    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.body.success, false);

    const forbidden = await handleAdminRechargeCredits(service, {
      identity: "user-billing-admin-1",
      creditAmount: 25,
      description: "admin top up",
    }, {
      "x-request-id": "req-billing-admin-forbidden",
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-admin-actor",
      [AUTHENTICATED_USER_ROLE_HEADER]: "user",
    });

    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.success, false);

    const elevationRequired = await handleAdminRechargeCredits(service, {
      identity: "user-billing-admin-1",
      creditAmount: 25,
      description: "admin top up",
    }, {
      "x-request-id": "req-billing-admin-elevation",
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
    });

    assert.equal(elevationRequired.statusCode, 403);
    assert.equal(elevationRequired.body.success, false);
    if (!elevationRequired.body.success) {
      assert.equal(elevationRequired.body.error.code, "ADMIN_ELEVATION_REQUIRED");
    }

    const success = await handleAdminRechargeCredits(service, {
      identity: "user-billing-admin-1",
      creditAmount: 25,
      description: "admin top up",
    }, {
      "x-request-id": "req-billing-admin-success",
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      [AUTHENTICATED_ADMIN_SESSION_HEADER]: "true",
    });

    assert.equal(success.statusCode, 200);
    assert.equal(success.body.success, true);
    if (!success.body.success) {
      return;
    }

    assert.equal(success.body.data.identity, "user-billing-admin-1");
    assert.equal(success.body.data.creditedAmount, 25);
    assert.equal(success.body.data.balanceAfter, 25);
  });

  test("static recharge handlers create, submit proof, expose admin lookup, and credit by submission id", async () => {
    const fixture = createStaticRechargeFixture();
    const userHeaders = {
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-static-1",
      "x-request-id": "req-billing-static-create",
    };

    const created = await handleCreateRechargeSubmission(fixture.service, {
      amount: 8,
      currencyCode: "CNY",
      paymentChannel: "manual",
    }, userHeaders);

    assert.equal(created.statusCode, 200);
    assert.equal(created.body.success, true);
    if (!created.body.success) {
      return;
    }

    assert.equal(created.body.data.submission.status, "created");
    assert.equal(created.body.data.submission.transferReferenceLast4, null);
    assert.equal(created.body.data.submission.submittedAt, null);

    const proof = await handleSubmitRechargeProof(
      fixture.service,
      created.body.data.submission.submissionId,
      {
        transferReferenceLast4: "6789",
        note: "cashier line",
      },
      {
        ...userHeaders,
        "x-request-id": "req-billing-static-proof",
      },
    );

    assert.equal(proof.statusCode, 200);
    assert.equal(proof.body.success, true);
    if (!proof.body.success) {
      return;
    }

    assert.equal(proof.body.data.submission.status, "pending");
    assert.equal(proof.body.data.submission.transferReferenceLast4, "6789");

    const adminHeaders = {
      [AUTHENTICATED_USER_ID_HEADER]: "admin-billing-static-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      [AUTHENTICATED_ADMIN_SESSION_HEADER]: "true",
      "x-request-id": "req-billing-static-admin",
    };

    const adminLookup = await handleGetAdminRechargeSubmission(
      fixture.service,
      created.body.data.submission.submissionId,
      adminHeaders,
    );

    assert.equal(adminLookup.statusCode, 200);
    assert.equal(adminLookup.body.success, true);
    if (!adminLookup.body.success) {
      return;
    }

    assert.equal(adminLookup.body.data.submission.userId, "user-billing-static-1");
    assert.equal(adminLookup.body.data.submission.creditAmount, 56);

    const reviewed = await handleReviewRechargeSubmission(
      fixture.service,
      created.body.data.submission.submissionId,
      {
        decision: "credit",
      },
      {
        ...adminHeaders,
        "x-request-id": "req-billing-static-review",
      },
    );

    assert.equal(reviewed.statusCode, 200);
    assert.equal(reviewed.body.success, true);
    if (!reviewed.body.success) {
      return;
    }

    assert.equal(reviewed.body.data.submission.status, "credited");
    assert.equal(reviewed.body.data.recharge?.identity, "user-billing-static-1");
    assert.equal(reviewed.body.data.recharge?.balanceAfter, 66);

    const balance = await handleGetCreditBalance(fixture.creditAccountService, {
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-static-1",
      "x-request-id": "req-billing-static-balance",
    });

    assert.equal(balance.statusCode, 200);
    assert.equal(balance.body.success, true);
    if (!balance.body.success) {
      return;
    }

    assert.equal(balance.body.data.balance, 66);
  });

  test("manual recharge handlers mark paid orders, list paid orders first, and credit by bound user id", async () => {
    const fixture = createStaticRechargeFixture();
    const userHeaders = {
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-manual-1",
      "x-request-id": "req-billing-manual-create",
    };
    const secondUserHeaders = {
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-manual-2",
      "x-request-id": "req-billing-manual-create-2",
    };
    const adminHeaders = {
      [AUTHENTICATED_USER_ID_HEADER]: "admin-billing-manual-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      [AUTHENTICATED_ADMIN_SESSION_HEADER]: "true",
      "x-request-id": "req-billing-manual-admin",
    };

    const first = await handleCreateRechargeSubmission(fixture.service, {
      amount: 20,
      currencyCode: "CNY",
      paymentChannel: "manual",
      manualProvider: "alipay",
    }, userHeaders);
    const second = await handleCreateRechargeSubmission(fixture.service, {
      amount: 20,
      currencyCode: "CNY",
      paymentChannel: "manual",
      manualProvider: "wechat",
    }, secondUserHeaders);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.body.success, true);
    assert.equal(second.body.success, true);
    if (!first.body.success || !second.body.success) {
      return;
    }

    assert.equal(first.body.data.submission.status, "paying");
    assert.equal(first.body.data.submission.userId, undefined);
    assert.equal(first.body.data.submission.manualProvider, "alipay");
    assert.equal(typeof first.body.data.submission.serviceFee, "number");
    assert.equal(first.body.data.submission.creditAmount, first.body.data.submission.baseCredits! + first.body.data.submission.bonusCredits!);

    const marked = await handleMarkRechargeSubmissionPaid(
      fixture.service,
      second.body.data.submission.submissionId,
      {
        ...secondUserHeaders,
        "x-request-id": "req-billing-manual-paid",
      },
    );
    assert.equal(marked.statusCode, 200);
    assert.equal(marked.body.success, true);
    if (!marked.body.success) {
      return;
    }
    assert.equal(marked.body.data.submission.status, "paying");
    assert.equal(typeof marked.body.data.submission.paymentMarkedAt, "string");

    const list = await handleListAdminRechargeSubmissions(fixture.service, adminHeaders);
    assert.equal(list.statusCode, 200);
    assert.equal(list.body.success, true);
    if (!list.body.success) {
      return;
    }
    assert.equal(list.body.data.items[0].submissionId, second.body.data.submission.submissionId);
    assert.equal(list.body.data.items[0].paymentMarkedAt, marked.body.data.submission.paymentMarkedAt);
    assert.equal(list.body.data.items[0].userId, "user-billing-manual-2");

    const reviewed = await handleReviewRechargeSubmission(
      fixture.service,
      second.body.data.submission.submissionId,
      { decision: "credit" },
      {
        ...adminHeaders,
        "x-request-id": "req-billing-manual-review",
      },
    );
    const duplicate = await handleReviewRechargeSubmission(
      fixture.service,
      second.body.data.submission.submissionId,
      { decision: "credit" },
      {
        ...adminHeaders,
        "x-request-id": "req-billing-manual-review-duplicate",
      },
    );

    assert.equal(reviewed.statusCode, 200);
    assert.equal(duplicate.statusCode, 200);
    assert.equal(reviewed.body.success, true);
    assert.equal(duplicate.body.success, true);
    if (!reviewed.body.success || !duplicate.body.success) {
      return;
    }
    assert.equal(reviewed.body.data.recharge?.identity, "user-billing-manual-2");
    assert.equal(duplicate.body.data.recharge?.balanceAfter, reviewed.body.data.recharge?.balanceAfter);
  });

  test("api server registers split recharge submission routes and keeps the legacy submit route compatible", async () => {
    const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
      allowDegradedPersistence: true,
      resolveAccessToken: (accessToken) => (
        accessToken === "billing-static-user-token"
          ? { userId: "billing-static-route-user", role: "user" }
          : accessToken === "billing-static-admin-token"
            ? { userId: "billing-static-route-admin", role: "admin" }
            : undefined
      ),
      verifyTurnstileToken: async () => ({ success: true }),
    }));
    trackedServers.add(server);

    const baseUrl = getBaseUrl(server);

    const createdResponse = await fetch(`${baseUrl}/api/v1/billing/recharge-submissions`, {
      method: "POST",
      headers: {
        authorization: "Bearer billing-static-user-token",
        "content-type": "application/json",
        "x-request-id": "req-server-static-create",
      },
      body: JSON.stringify({
        amount: 8,
        currencyCode: "CNY",
        paymentChannel: "manual",
      }),
    });

    assert.equal(createdResponse.status, 200);
    const createdPayload = await createdResponse.json() as {
      success: boolean;
      data?: { submission: { submissionId: string; status: string } };
    };
    assert.equal(createdPayload.success, true);
    assert.equal(createdPayload.data?.submission.status, "created");

    const submissionId = createdPayload.data?.submission.submissionId || "";
    assert.ok(submissionId);

    const proofResponse = await fetch(`${baseUrl}/api/v1/billing/recharge-submissions/${submissionId}/proof`, {
      method: "POST",
      headers: {
        authorization: "Bearer billing-static-user-token",
        "content-type": "application/json",
        "x-request-id": "req-server-static-proof",
      },
      body: JSON.stringify({
        transferReferenceLast4: "4321",
        note: "server route proof",
      }),
    });

    assert.equal(proofResponse.status, 200);
    const proofPayload = await proofResponse.json() as {
      success: boolean;
      data?: { submission: { status: string; transferReferenceLast4: string } };
    };
    assert.equal(proofPayload.success, true);
    assert.equal(proofPayload.data?.submission.status, "pending");
    assert.equal(proofPayload.data?.submission.transferReferenceLast4, "4321");

    const adminLookupResponse = await fetch(
      `${baseUrl}/api/v1/admin/billing/recharge-submissions/${submissionId}`,
      {
        headers: {
          authorization: "Bearer billing-static-admin-token",
          "x-request-id": "req-server-static-admin-lookup",
        },
      },
    );

    assert.equal(adminLookupResponse.status, 403);
    const adminLookupPayload = await adminLookupResponse.json() as {
      success: boolean;
      error?: { code?: string };
    };
    assert.equal(adminLookupPayload.success, false);
    assert.equal(adminLookupPayload.error?.code, "ADMIN_ELEVATION_REQUIRED");

    const adminReviewResponse = await fetch(
      `${baseUrl}/api/v1/admin/billing/recharge-submissions/${submissionId}/review`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer billing-static-admin-token",
          "content-type": "application/json",
          "x-request-id": "req-server-static-admin-review",
        },
        body: JSON.stringify({
          decision: "credit",
        }),
      },
    );

    assert.equal(adminReviewResponse.status, 403);
    const adminReviewPayload = await adminReviewResponse.json() as {
      success: boolean;
      error?: { code?: string };
    };
    assert.equal(adminReviewPayload.success, false);
    assert.equal(adminReviewPayload.error?.code, "ADMIN_ELEVATION_REQUIRED");

    const legacyResponse = await fetch(`${baseUrl}/api/v1/billing/submit-recharge`, {
      method: "POST",
      headers: {
        authorization: "Bearer billing-static-user-token",
        "content-type": "application/json",
        "x-request-id": "req-server-static-legacy-submit",
      },
      body: JSON.stringify({
        amount: 6,
        currencyCode: "CNY",
        paymentChannel: "manual",
        transferReferenceLast4: "9876",
        note: "legacy submit",
      }),
    });

    assert.equal(legacyResponse.status, 200);
    const legacyPayload = await legacyResponse.json() as {
      success: boolean;
      data?: { submission: { status: string; transferReferenceLast4: string } };
    };
    assert.equal(legacyPayload.success, true);
    assert.equal(legacyPayload.data?.submission.status, "pending");
    assert.equal(legacyPayload.data?.submission.transferReferenceLast4, "9876");
  });

  test("lists recharge exchange rates and preserves decimal values", async () => {
    const service = new CreditExchangeRateService(new InMemoryCreditExchangeRateRepository({
      CNY: {
        creditsPerUnit: 5.5,
        minAmount: 6.5,
        maxAmount: 520.25,
        isActive: true,
      },
    }));

    const result = await handleListCreditExchangeRates(service, {
      "x-request-id": "req-billing-exchange-rates-list",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(result.body.data.items.length, 2);
    assert.equal(result.body.data.items[0].currencyCode, "CNY");
    assert.equal(result.body.data.items[0].creditsPerUnit, 5.5);
    assert.equal(result.body.data.items[0].minAmount, 6.5);
    assert.equal(result.body.data.items[0].maxAmount, 520.25);
  });

  test("lists recharge payment channels from the canonical billing surface", async () => {
    const service = new RechargePaymentChannelConfigService(
      new InMemoryRechargePaymentChannelConfigRepository({
        alipay: {
          label: "支付宝静态码",
          qrImageDataUrl: "data:image/png;base64,abc123",
          instructionText: "转账后提交账单编号和流水尾号。",
          isActive: true,
        },
      }),
    );

    const result = await handleListRechargePaymentChannels(service, {
      "x-request-id": "req-billing-payment-channels-list",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(result.body.data.items.length >= 1, true);
    assert.equal(result.body.data.items[0].channel, "alipay");
    assert.equal(result.body.data.items[0].label, "支付宝静态码");
    assert.equal(result.body.data.items[0].qrImageDataUrl, "data:image/png;base64,abc123");
  });

  test("exchange rate mutations require an elevated admin session and validate the payload", async () => {
    const service = new CreditExchangeRateService(new InMemoryCreditExchangeRateRepository());
    const input = {
      currencyCode: "USD" as const,
      creditsPerUnit: 22.75,
      minAmount: 2,
      maxAmount: 120,
      isActive: true,
    };

    const unauthorized = await handleUpsertCreditExchangeRate(service, input, {
      "x-request-id": "req-billing-exchange-rates-unauthorized",
    });
    assert.equal(unauthorized.statusCode, 401);

    const forbidden = await handleUpsertCreditExchangeRate(service, input, {
      "x-request-id": "req-billing-exchange-rates-forbidden",
      [AUTHENTICATED_USER_ID_HEADER]: "user-billing-rate-actor",
      [AUTHENTICATED_USER_ROLE_HEADER]: "user",
    });
    assert.equal(forbidden.statusCode, 403);

    const elevationRequired = await handleUpsertCreditExchangeRate(service, input, {
      "x-request-id": "req-billing-exchange-rates-elevation",
      [AUTHENTICATED_USER_ID_HEADER]: "admin-rate-user",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
    });
    assert.equal(elevationRequired.statusCode, 403);
    assert.equal(elevationRequired.body.success, false);
    if (!elevationRequired.body.success) {
      assert.equal(elevationRequired.body.error.code, "ADMIN_ELEVATION_REQUIRED");
    }

    const invalidDetails = validateUpsertCreditExchangeRateRequest({
      currencyCode: "USD",
      creditsPerUnit: 0,
      minAmount: 10,
      maxAmount: 5,
      isActive: "yes",
    });
    assert.ok(invalidDetails.length >= 2);

    const success = await handleUpsertCreditExchangeRate(service, input, {
      "x-request-id": "req-billing-exchange-rates-success",
      [AUTHENTICATED_USER_ID_HEADER]: "admin-rate-user",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      [AUTHENTICATED_ADMIN_SESSION_HEADER]: "true",
    });

    assert.equal(success.statusCode, 200);
    assert.equal(success.body.success, true);
    if (!success.body.success) {
      return;
    }

    assert.equal(success.body.data.currencyCode, "USD");
    assert.equal(success.body.data.creditsPerUnit, 22.75);
    assert.equal(success.body.data.minAmount, 2);
    assert.equal(success.body.data.maxAmount, 120);
    assert.equal(success.body.data.isActive, true);
  });
});
