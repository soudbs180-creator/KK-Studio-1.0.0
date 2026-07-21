import assert from "node:assert/strict";
import { test } from "node:test";

import cryptoUtils from "../../services/api/utils/crypto.js";

test("AES-256-GCM encryption and decryption round-trip works correctly", () => {
  const originalText = "sk-proj-sensitive-api-key-value-1234567890";
  const encrypted = cryptoUtils.encrypt(originalText);

  assert.ok(encrypted);
  assert.notEqual(encrypted, originalText);
  
  // 验证是否包含 3 部分：iv:authTag:ciphertext
  const parts = encrypted.split(":");
  assert.equal(parts.length, 3);
  
  // 验证各部分不为空
  assert.ok(parts[0].length > 0);
  assert.ok(parts[1].length > 0);
  assert.ok(parts[2].length > 0);

  const decrypted = cryptoUtils.decrypt(encrypted);
  assert.equal(decrypted, originalText);
});

test("AES-256-GCM encryption handles different inputs", () => {
  const emptyText = "";
  const encrypted = cryptoUtils.encrypt(emptyText);
  assert.equal(cryptoUtils.decrypt(encrypted), emptyText);
});

test("encryption throws error for non-string inputs", () => {
  assert.throws(() => {
    cryptoUtils.encrypt(123 as any);
  });
  assert.throws(() => {
    cryptoUtils.encrypt(null as any);
  });
});

test("decryption throws error for invalid envelope formats", () => {
  assert.throws(() => {
    cryptoUtils.decrypt("invalid-envelope");
  });
  assert.throws(() => {
    cryptoUtils.decrypt("iv:authTag");
  });
  assert.throws(() => {
    cryptoUtils.decrypt(null as any);
  });
});
