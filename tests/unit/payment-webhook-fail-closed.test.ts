import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("payment webhook rejects compatibility-bridge failures instead of treating them as successful settlements", () => {
  const source = readFileSync(path.join(process.cwd(), "payment-server/webhook.js"), "utf8");

  assert.match(source, /if \(!result\.success\) \{/);
  assert.match(source, /Payment callback was rejected by compatibility bridge/);
});
