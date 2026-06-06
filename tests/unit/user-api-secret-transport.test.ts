import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  getBlockedUserApiSecretReason,
  isSendableUserApiSecret,
  normalizeUserApiSecretForTransport,
} = require("../../server/lib/userApiSecret.js");

test("user API secret transport guard blocks placeholders and encrypted envelopes", () => {
  const blockedCases: Array<[unknown, string]> = [
    [null, "missing"],
    ["", "missing"],
    ["sk-readonly-0000", "readonly-placeholder"],
    ["__kk_redacted__:provider:route-1", "redacted-placeholder"],
    ["[object Object]", "object-string"],
    ["\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", "masked-preview"],
    ["sk-live...tail", "masked-preview"],
  ];

  for (const [value, reason] of blockedCases) {
    assert.equal(getBlockedUserApiSecretReason(value), reason);
    assert.equal(isSendableUserApiSecret(value), false);
    assert.equal(normalizeUserApiSecretForTransport(value), "");
  }
});

test("user API secret transport guard preserves encrypted envelope for backend handling", () => {
  const envelope = { __kkUserApiSecret: true, ciphertext: "cipher", iv: "iv" };
  assert.equal(getBlockedUserApiSecretReason(envelope), "");
  assert.equal(isSendableUserApiSecret(envelope), true);
  
  const jsonStr = JSON.stringify({ ciphertext: "cipher", nonce: "nonce" });
  assert.equal(getBlockedUserApiSecretReason(jsonStr), "");
  assert.equal(isSendableUserApiSecret(jsonStr), true);
  assert.equal(normalizeUserApiSecretForTransport(jsonStr), jsonStr);
});

test("user API secret transport guard preserves real user-entered key text", () => {
  assert.equal(getBlockedUserApiSecretReason("  wu-real-key_123  "), "");
  assert.equal(isSendableUserApiSecret("  wu-real-key_123  "), true);
  assert.equal(normalizeUserApiSecretForTransport("  wu-real-key_123  "), "wu-real-key_123");
});
