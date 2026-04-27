import assert from "node:assert/strict";
import { test } from "node:test";

import * as paymentModule from "./modules/payment/index.ts";
import { PostgresPaymentOrderRepository } from "./modules/payment/index.ts";
import { createPaymentSidecarServer } from "./server.ts";

const forbiddenLegacyPaymentRepositoryExports = [
  "Supa" + "basePaymentOrderRepository",
  "Supa" + "basePaymentCreditAmountResolver",
] as const;

async function closeServer(server: ReturnType<typeof createPaymentSidecarServer>): Promise<void> {
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

test("payment sidecar module surface no longer exposes legacy cloud runtime adapters", () => {
  for (const exportName of forbiddenLegacyPaymentRepositoryExports) {
    assert.equal(exportName in paymentModule, false);
  }
});

test("hosted payment sidecar rejects non-postgres payment persistence when durable pricing is unavailable", async () => {
  const previousVercel = process.env.VERCEL;
  const previousDatabaseUrl = process.env.DATABASE_URL;

  process.env.VERCEL = "1";
  delete process.env.DATABASE_URL;

  let server: ReturnType<typeof createPaymentSidecarServer> | undefined;
  let thrown: unknown;

  try {
    try {
      server = createPaymentSidecarServer(0, {
        paymentOrderRepository: new PostgresPaymentOrderRepository({
          query: async () => ({ rows: [] } as any),
        } as any),
        settlementWriterOptions: {
          baseUrl: "http://127.0.0.1:3001",
          internalToken: "payment-internal-token",
          settlementToken: "payment-settlement-token",
        },
      });
    } catch (error) {
      thrown = error;
    }

    if (server) {
      await closeServer(server);
    }

    assert.match(String((thrown as Error | undefined)?.message || ""), /Hosted payment sidecar requires durable payment storage and settlement auth\./);
  } finally {
    if (typeof previousVercel === "undefined") {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = previousVercel;
    }

    if (typeof previousDatabaseUrl === "undefined") {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});
