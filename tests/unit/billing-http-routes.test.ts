import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AUTHENTICATED_ADMIN_SESSION_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
  AUTHENTICATED_USER_ROLE_HEADER,
} from "../../packages/shared/src/index.ts";
import { CreditAccountService } from "../../apps/api/src/modules/billing/application/credit-account-service.ts";
import { InMemoryCreditAccountRepository } from "../../apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts";
import {
  handleAdminRechargeCredits,
  handleDebitCredits,
  handleGetCreditBalance,
  handleListCreditTransactions,
  handleRefundCredits,
} from "../../apps/api/src/modules/billing/presentation/http-billing-routes.ts";

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
    assert.equal(success.body.data.balanceAfter, 125);
  });
});
