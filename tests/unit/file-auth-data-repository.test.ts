import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { FileBackedAuthDataRepository } from "../../apps/api/src/modules/auth/infrastructure/file-auth-data-repository.ts";

describe("file-backed auth data repository", () => {
  test("persists user api entries and key-manager state across repository instances", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "kk-auth-data-"));
    const filePath = path.join(tempDir, "auth-data.json");
    const secret = "local-auth-data-secret-seed";

    try {
      const first = new FileBackedAuthDataRepository({
        filePath,
        storageEncryptionKey: secret,
      });

      await first.replaceUserApiEntries("user-1", "user-1@example.com", [
        {
          id: "entry-1",
          name: "Example Provider",
          provider: "Custom",
          type: "proxy",
          format: "openai",
          key: "sk-live-secret-123456",
          baseUrl: "https://api.example.com/v1",
          supportedModels: ["gpt-4.1"],
          disabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "unknown",
          failCount: 0,
          successCount: 0,
          totalCost: 0,
          budgetLimit: -1,
          tokenLimit: -1,
          usedTokens: 0,
          lastUsed: null,
          lastError: null,
        },
      ]);

      await first.replaceKeyManagerCloudState("user-1", "user-1@example.com", {
        version: 2,
        slots: [
          {
            id: "slot-1",
            name: "Example Slot",
            provider: "Custom",
            key: "sk-live-secret-123456",
            type: "proxy",
            format: "openai",
            baseUrl: "https://api.example.com/v1",
            supportedModels: ["gpt-4.1"],
            disabled: false,
            createdAt: Date.now(),
            totalCost: 0,
            budgetLimit: -1,
          },
        ],
        providers: [
          {
            id: "provider-1",
            name: "Example Provider",
            baseUrl: "https://api.example.com/v1",
            apiKey: "sk-live-secret-123456",
            models: ["gpt-4.1"],
            format: "openai",
            isActive: true,
          },
        ],
      });

      const second = new FileBackedAuthDataRepository({
        filePath,
        storageEncryptionKey: secret,
      });

      const entries = await second.listUserApiEntries("user-1", "user-1@example.com");
      assert.equal(entries.length, 1);
      assert.equal(entries[0].id, "entry-1");
      assert.match(String(entries[0].key || ""), /^__kk_redacted__:/);

      const state = await second.getKeyManagerCloudState("user-1", "user-1@example.com");
      assert.equal(state.slots.length, 1);
      assert.equal(state.providers.length, 1);
      assert.match(String((state.providers[0] as { apiKey?: unknown }).apiKey || ""), /^__kk_redacted__:/);

      const fileContents = await readFile(filePath, "utf8");
      assert.doesNotMatch(fileContents, /sk-live-secret-123456/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("cleans stale temp files before writing the next auth-data snapshot", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "kk-auth-data-stale-"));
    const filePath = path.join(tempDir, "auth-data.json");
    const staleTempPath = `${filePath}.stale-write.tmp`;

    try {
      await writeFile(staleTempPath, '{"stale":true}', "utf8");

      const repository = new FileBackedAuthDataRepository({
        filePath,
        storageEncryptionKey: "local-auth-data-secret-seed",
      });

      await repository.replaceUserApiEntries("user-2", "user-2@example.com", [
        {
          id: "entry-2",
          name: "Example Provider",
          provider: "Custom",
          type: "proxy",
          format: "openai",
          key: "sk-live-secret-654321",
          baseUrl: "https://api.example.com/v1",
          supportedModels: ["gpt-4.1"],
          disabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "unknown",
          failCount: 0,
          successCount: 0,
          totalCost: 0,
          budgetLimit: -1,
          tokenLimit: -1,
          usedTokens: 0,
          lastUsed: null,
          lastError: null,
        },
      ]);

      const files = await readdir(tempDir);
      assert.equal(files.includes(path.basename(staleTempPath)), false);
      assert.equal(files.some((fileName) => fileName.endsWith(".tmp")), false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
