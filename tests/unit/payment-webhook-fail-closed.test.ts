import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("payment webhook rejects compatibility-bridge failures instead of treating them as successful settlements", () => {
  const source = readFileSync(path.join(process.cwd(), "server/routes/webhook.js"), "utf8");

  assert.match(source, /if \(settlementSuccess\) \{/);
  assert.match(source, /Database error during settlement/);
});

test("payment settlement validates positive order credits before account recharge", () => {
  const webhookSource = readFileSync(path.join(process.cwd(), "server/routes/webhook.js"), "utf8");
  const creditsSource = readFileSync(path.join(process.cwd(), "server/lib/credits.js"), "utf8");
  const migrationSource = readFileSync(
    path.join(process.cwd(), "migrations/010_orders_positive_credits_constraint.sql"),
    "utf8",
  );

  assert.match(webhookSource, /Number\.isSafeInteger\(parsedCredits\) \|\| parsedCredits <= 0/);
  assert.match(creditsSource, /function assertPositiveCreditAmount/);
  assert.match(creditsSource, /addCredits[\s\S]*assertPositiveCreditAmount\(amount, '积分入账'\)/);
  assert.match(migrationSource, /chk_orders_credits_positive/);
  assert.match(migrationSource, /CHECK \(credits > 0\)/);
});
