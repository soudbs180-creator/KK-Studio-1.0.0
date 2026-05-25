import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  buildGenerationAttemptIdempotencyKey,
  buildGenerationAttemptRequestId,
  buildGenerationBillingAttempt,
  resolveGenerationAttemptFailureState,
} from "../../apps/web/src/services/billing/generationBillingCoordinator.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

describe("generation billing coordinator", () => {
  test("builds stable attempt billing ids and request ids from one attempt seed", () => {
    const attempt = buildGenerationBillingAttempt({
      nodeId: "node-123",
      phase: "retry",
      attemptId: "attempt-fixed-1",
    });

    assert.equal(attempt.attemptId, "attempt-fixed-1");
    assert.equal(attempt.businessRefId, "attempt-fixed-1");
    assert.equal(attempt.idempotencyKey, buildGenerationAttemptIdempotencyKey("attempt-fixed-1"));
    assert.equal(buildGenerationAttemptRequestId(attempt.attemptId, 2), "attempt-fixed-1:2");
  });

  test("refund helper clears client-side debit state after a successful refund", async () => {
    const result = await resolveGenerationAttemptFailureState(
      {
        id: "node-123",
        billingMode: "credits",
        creditSettlement: "client",
        isPaymentProcessed: true,
        paymentTransactionId: "ledger-client-1",
        refundStatus: undefined,
        cost: 6,
      },
      {
        refundCreditsByTransaction: async (transactionId, reason) => {
          assert.equal(transactionId, "ledger-client-1");
          assert.equal(reason, "退款 node-123");
          return { success: true, newBalance: 42, message: "ok" };
        },
        refreshBilling: async () => {
          throw new Error("refresh should not run for client settlement");
        },
      },
    );

    assert.deepEqual(result, {
      refundStatus: "success",
      isPaymentProcessed: false,
      paymentTransactionId: undefined,
    });
  });

  test("refund helper refreshes server-side billing state after failed server settlement attempts", async () => {
    let refreshCount = 0;

    const result = await resolveGenerationAttemptFailureState(
      {
        id: "node-456",
        billingMode: "credits",
        creditSettlement: "server",
        isPaymentProcessed: false,
        paymentTransactionId: undefined,
        refundStatus: undefined,
        cost: 8,
      },
      {
        refundCreditsByTransaction: async () => {
          throw new Error("refund should not run for server settlement");
        },
        refreshBilling: async () => {
          refreshCount += 1;
        },
      },
    );

    assert.equal(refreshCount, 1);
    assert.deepEqual(result, {
      refundStatus: "success",
      isPaymentProcessed: false,
      paymentTransactionId: undefined,
    });
  });

  test("frontend generation flows share the coordinator for attempt ids and refund handling", () => {
    const appSource = readSource("src/App.tsx");
    const generationRuntimeSource = readSource("src/app/useGenerationRuntime.ts");
    const billingContextSource = readSource("src/context/BillingContext.tsx");
    const imageGenerationSource = readSource("src/hooks/useImageGeneration.ts");
    const typesSource = readSource("src/types.ts");

    assert.match(typesSource, /billingAttemptId\?: string;/);
    assert.match(typesSource, /balanceAfter\?: number;/);
    assert.match(generationRuntimeSource, /buildGenerationBillingAttempt\(/);
    assert.match(generationRuntimeSource, /resolveGenerationAttemptFailureState\(/);
    assert.match(generationRuntimeSource, /billingAttemptId: params\.billingAttempt\.attemptId,/);
    assert.match(imageGenerationSource, /buildGenerationAttemptRequestId\(/);
    assert.match(imageGenerationSource, /resolveGenerationAttemptFailureState\(/);
    assert.match(imageGenerationSource, /applyAuthoritativeBalance\(/);
    assert.match(imageGenerationSource, /balanceAfter: firstSuccess\?\.balanceAfter,/);
    assert.match(billingContextSource, /details\?\.attemptId/);
    assert.match(billingContextSource, /buildGenerationAttemptIdempotencyKey\(/);
    assert.match(billingContextSource, /applyAuthoritativeBalance: \(nextBalance: number\) => void;/);
  });
});
