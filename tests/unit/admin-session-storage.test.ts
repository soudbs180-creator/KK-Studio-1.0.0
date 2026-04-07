import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearStoredAdminSession,
  getStoredAdminSessionToken,
  setStoredAdminSession,
} from "../../src/services/api/adminSession.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test("admin session tokens are stored in sessionStorage only", () => {
  const sessionStorage = new MemoryStorage();
  const localStorage = new MemoryStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage,
      localStorage,
      dispatchEvent() {},
    },
  });

  setStoredAdminSession("adm_test_token", "2999-01-01T00:00:00.000Z", "admin-user-1");

  assert.equal(getStoredAdminSessionToken(), "adm_test_token");
  assert.equal(sessionStorage.getItem("kk_admin_session") !== null, true);
  assert.equal(localStorage.getItem("kk_admin_session"), null);

  clearStoredAdminSession();
  assert.equal(getStoredAdminSessionToken(), undefined);
  assert.equal(sessionStorage.getItem("kk_admin_session"), null);
});
