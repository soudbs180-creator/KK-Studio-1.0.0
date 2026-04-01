import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  ADMIN_CONSOLE_DRAFT_SCOPE,
  clearScopedAdminConsoleState,
  loadScopedAdminConsoleState,
  loadStoredAdminSystemTab,
  saveScopedAdminConsoleState,
  saveStoredAdminSystemTab,
} from "../../src/services/admin/adminConsoleState.ts";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function installBrowserStorage() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: new MemoryStorage(),
    },
  });
}

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window;
});

test("admin system tab is stored per user and restored safely", () => {
  installBrowserStorage();

  saveStoredAdminSystemTab("admin-a", "exchange-rates");
  saveStoredAdminSystemTab("admin-b", "admin-console");

  assert.equal(loadStoredAdminSystemTab("admin-a"), "exchange-rates");
  assert.equal(loadStoredAdminSystemTab("admin-b"), "admin-console");
  assert.equal(loadStoredAdminSystemTab("missing", "credit-models"), "credit-models");
});

test("scoped admin drafts only affect the matching user", () => {
  installBrowserStorage();

  saveScopedAdminConsoleState(ADMIN_CONSOLE_DRAFT_SCOPE, "admin-a", {
    identity: "user-a@example.com",
    rechargeAmount: 88,
  });
  saveScopedAdminConsoleState(ADMIN_CONSOLE_DRAFT_SCOPE, "admin-b", {
    identity: "user-b@example.com",
    rechargeAmount: 144,
  });

  assert.deepEqual(loadScopedAdminConsoleState(ADMIN_CONSOLE_DRAFT_SCOPE, "admin-a"), {
    identity: "user-a@example.com",
    rechargeAmount: 88,
  });
  assert.deepEqual(loadScopedAdminConsoleState(ADMIN_CONSOLE_DRAFT_SCOPE, "admin-b"), {
    identity: "user-b@example.com",
    rechargeAmount: 144,
  });

  clearScopedAdminConsoleState(ADMIN_CONSOLE_DRAFT_SCOPE, "admin-a");

  assert.equal(loadScopedAdminConsoleState(ADMIN_CONSOLE_DRAFT_SCOPE, "admin-a"), undefined);
  assert.deepEqual(loadScopedAdminConsoleState(ADMIN_CONSOLE_DRAFT_SCOPE, "admin-b"), {
    identity: "user-b@example.com",
    rechargeAmount: 144,
  });
});

test("invalid stored admin state is discarded instead of crashing", () => {
  installBrowserStorage();
  const storage = (globalThis as typeof globalThis & {
    window: { localStorage: Storage };
  }).window.localStorage;
  storage.setItem(
    "kk.admin.console.state.v1:admin-console-draft:admin-a",
    "{not-json",
  );

  assert.equal(loadScopedAdminConsoleState(ADMIN_CONSOLE_DRAFT_SCOPE, "admin-a"), undefined);
  assert.equal(
    storage.getItem("kk.admin.console.state.v1:admin-console-draft:admin-a"),
    null,
  );
});
