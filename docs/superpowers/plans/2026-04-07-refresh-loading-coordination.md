# Refresh And Loading Coordination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make background refreshes silent, keep the last good data visible, and limit loading indicators to bootstrap or the exact action the user clicked.

**Architecture:** Add small, testable helpers for refresh presentation and cooldown policy, then thread them into the existing `BillingContext`, `adminModelService`, `ApiSettingsView`, and `ThirdPartyProviderManager` without redesigning the UI tree. Keep the current page structure, but split state semantics into bootstrap loading, background refresh, and action-scoped busy states.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Node `node:test`, existing source-contract tests

---

## File Map

- Create: `src/services/billing/billingRefreshMode.ts`
  Encodes when billing refresh should be blocking versus silent.
- Modify: `src/context/BillingContext.tsx`
  Keeps `loading` bootstrap-only, adds `refreshing`, and reuses the billing refresh helper.
- Modify: `src/App.tsx`
  Renames billing loading usage to make bootstrap-only behavior explicit in generation guards and the mobile balance handoff.
- Create: `tests/unit/billing-refresh-mode.test.ts`
  Pure unit tests for billing refresh semantics.

- Create: `src/services/model/adminModelRefreshPolicy.ts`
  Encodes cooldown and visibility-based auto-refresh timing for admin model catalog refreshes.
- Modify: `src/services/model/adminModelService.ts`
  Uses the policy helper to collapse duplicate background refresh triggers.
- Create: `tests/unit/admin-model-refresh-policy.test.ts`
  Pure unit tests for admin model refresh throttling.
- Create: `tests/unit/admin-model-refresh-contract.test.ts`
  Source-contract test to make sure the service keeps using the shared policy helper.

- Create: `src/services/api/userApiViewState.ts`
  Resolves snapshot-backed settings view behavior, including when snapshot hydration should be soft rather than blocking.
- Modify: `src/components/settings/ApiSettingsView.tsx`
  Uses the view-state helper so the page can stay interactive while silent cloud reconciliation runs.
- Create: `tests/unit/user-api-view-state.test.ts`
  Pure unit tests for settings hydration behavior.
- Modify: `tests/unit/frontend-key-boundary-hardening.test.ts`
  Updates source assertions to match the new helper-based state computation.

- Create: `src/services/api/providerManagerBusyState.ts`
  Tracks keyed loading state for provider creation, refresh-all, per-provider refresh, balance sync, and pricing prefetch.
- Modify: `src/components/api/ThirdPartyProviderManager.tsx`
  Replaces the broad `isLoading` flag with action-scoped busy state and suppresses repeated progress toasts during silent refresh.
- Create: `tests/unit/provider-manager-busy-state.test.ts`
  Pure unit tests for the keyed busy-state transitions.
- Create: `tests/unit/provider-manager-loading-contract.test.ts`
  Source-contract test to ensure the component no longer relies on one global `isLoading`.

---

### Task 1: Billing Refresh Semantics

**Files:**
- Create: `src/services/billing/billingRefreshMode.ts`
- Create: `tests/unit/billing-refresh-mode.test.ts`
- Modify: `src/context/BillingContext.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { resolveBillingRefreshMode } from "../../src/services/billing/billingRefreshMode.ts";

test("visible billing seed keeps background refresh silent", () => {
  assert.deepEqual(
    resolveBillingRefreshMode({
      silent: true,
      hasVisibleBillingSeed: true,
    }),
    {
      showBlockingLoading: false,
      markRefreshing: true,
    },
  );
});

test("manual refresh without a visible seed stays blocking", () => {
  assert.deepEqual(
    resolveBillingRefreshMode({
      silent: false,
      hasVisibleBillingSeed: false,
    }),
    {
      showBlockingLoading: true,
      markRefreshing: false,
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/billing-refresh-mode.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/services/billing/billingRefreshMode.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
export interface BillingRefreshModeInput {
  hasVisibleBillingSeed: boolean;
  silent: boolean;
}

export interface BillingRefreshMode {
  showBlockingLoading: boolean;
  markRefreshing: boolean;
}

export function resolveBillingRefreshMode(
  input: BillingRefreshModeInput,
): BillingRefreshMode {
  if (input.silent) {
    return {
      showBlockingLoading: false,
      markRefreshing: true,
    };
  }

  return {
    showBlockingLoading: !input.hasVisibleBillingSeed,
    markRefreshing: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/billing-refresh-mode.test.ts`
Expected: PASS

- [ ] **Step 5: Integrate the helper into `BillingContext`**

```ts
import { resolveBillingRefreshMode } from "../services/billing/billingRefreshMode";

interface BillingContextType {
  balance: number;
  loading: boolean;
  refreshing: boolean;
  recharge: (amount: number, currency: "CNY" | "USD") => Promise<void>;
  // ...
}

const [refreshing, setRefreshing] = useState(false);

const refreshBilling = useCallback(async (options?: RefreshBillingOptions) => {
  if (!canStartBillingBootstrap) {
    return;
  }

  if (refreshPromiseRef.current) {
    return refreshPromiseRef.current;
  }

  const includeTransactions = options?.includeTransactions === true;
  const refreshMode = resolveBillingRefreshMode({
    silent: options?.silent === true,
    hasVisibleBillingSeed: hasVisibleBillingSeedRef.current,
  });

  if (refreshMode.showBlockingLoading) {
    setLoading(true);
  }
  if (refreshMode.markRefreshing) {
    setRefreshing(true);
  }

  const refreshPromise = (includeTransactions
    ? Promise.all([refreshBalanceOnly(), loadCreditTransactions(false)])
    : refreshBalanceOnly().then((canonicalBalance) => [canonicalBalance, undefined] as const))
    .then(([canonicalBalance, latestBalanceAfter]) => {
      const resolvedBalance = typeof canonicalBalance === "number"
        ? canonicalBalance
        : latestBalanceAfter;

      if (typeof resolvedBalance === "number") {
        setBalance(resolvedBalance);
      }
    })
    .finally(() => {
      if (refreshPromiseRef.current === refreshPromise) {
        refreshPromiseRef.current = null;
      }
      if (refreshMode.showBlockingLoading) {
        setLoading(false);
      }
      if (refreshMode.markRefreshing) {
        setRefreshing(false);
      }
    });

  refreshPromiseRef.current = refreshPromise;
  return refreshPromise;
}, [refreshBalanceOnly, loadCreditTransactions, canStartBillingBootstrap]);

<BillingContext.Provider
  value={{
    balance: visibleBalance,
    loading: visibleLoading,
    refreshing,
    recharge,
    // ...
  }}
>
```

- [ ] **Step 6: Make the bootstrap-only meaning explicit in `App.tsx`**

```ts
const {
  balance,
  loading: billingBootstrapLoading,
  refreshing: billingRefreshing,
  showRechargeModal,
  setShowRechargeModal,
  consumeCreditsDetailed,
  refundCreditsByTransaction,
  refreshBilling,
  adjustBalanceOptimistically,
} = useBilling();

void billingRefreshing;

const remainingBalanceDisplay = billingBootstrapLoading
  ? "..."
  : formatRemainingCredits(balance, "zh-CN");

if (billingBootstrapLoading) {
  import("./services/system/notificationService").then(({ notify }) => {
    notify.info("余额同步中", "正在刷新账户余额，请稍后重试。");
  });
  return { success: false as const };
}
```

- [ ] **Step 7: Run the touched tests and typecheck**

Run: `node --test tests/unit/billing-refresh-mode.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/services/billing/billingRefreshMode.ts src/context/BillingContext.tsx src/App.tsx tests/unit/billing-refresh-mode.test.ts
git commit -m "refactor: make billing refresh bootstrap-aware"
```

### Task 2: Admin Model Catalog Refresh Policy

**Files:**
- Create: `src/services/model/adminModelRefreshPolicy.ts`
- Create: `tests/unit/admin-model-refresh-policy.test.ts`
- Create: `tests/unit/admin-model-refresh-contract.test.ts`
- Modify: `src/services/model/adminModelService.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminModelAutoRefreshDelay,
  shouldStartAdminModelRefresh,
} from "../../src/services/model/adminModelRefreshPolicy.ts";

test("visible tabs use the fast admin catalog refresh interval", () => {
  assert.equal(getAdminModelAutoRefreshDelay("visible"), 10_000);
});

test("hidden tabs use the slow admin catalog refresh interval", () => {
  assert.equal(getAdminModelAutoRefreshDelay("hidden"), 60_000);
});

test("background refresh skips duplicate triggers inside cooldown", () => {
  assert.equal(
    shouldStartAdminModelRefresh({
      force: false,
      hasInflightRequest: false,
      lastAttemptAt: 1_000,
      now: 8_000,
      cooldownMs: 15_000,
    }),
    false,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/admin-model-refresh-policy.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/services/model/adminModelRefreshPolicy.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
export type AdminModelVisibility = "visible" | "hidden";

export interface AdminModelRefreshPolicyInput {
  cooldownMs: number;
  force: boolean;
  hasInflightRequest: boolean;
  lastAttemptAt: number;
  now: number;
}

export function shouldStartAdminModelRefresh(
  input: AdminModelRefreshPolicyInput,
): boolean {
  if (input.hasInflightRequest) {
    return false;
  }
  if (input.force) {
    return true;
  }
  if (!input.lastAttemptAt) {
    return true;
  }

  return input.now - input.lastAttemptAt >= input.cooldownMs;
}

export function getAdminModelAutoRefreshDelay(
  visibility: AdminModelVisibility,
): number {
  return visibility === "visible" ? 10_000 : 60_000;
}
```

- [ ] **Step 4: Run helper test to verify it passes**

Run: `node --test tests/unit/admin-model-refresh-policy.test.ts`
Expected: PASS

- [ ] **Step 5: Integrate the policy into `adminModelService`**

```ts
import {
  getAdminModelAutoRefreshDelay,
  shouldStartAdminModelRefresh,
} from "./adminModelRefreshPolicy";

private requestBackgroundRefresh(force = false): void {
  const now = Date.now();
  const shouldStart = shouldStartAdminModelRefresh({
    force,
    hasInflightRequest: Boolean(this.loadingPromise),
    lastAttemptAt: this.lastLoadAttemptAt,
    now,
    cooldownMs: AdminModelService.LOAD_RETRY_INTERVAL_MS,
  });

  if (!this.backgroundRefreshEnabled || !shouldStart) {
    return;
  }

  void this.loadAdminModels(force).catch((error) => {
    console.warn("[AdminModelService] Background refresh failed:", error);
  });
}

const refreshNow = () => {
  this.requestBackgroundRefresh(false);
};

const reschedule = (delayMs?: number) => {
  if (this.autoRefreshTimer) {
    clearTimeout(this.autoRefreshTimer);
  }

  const nextDelay = delayMs ?? getAdminModelAutoRefreshDelay(
    document.visibilityState === "visible" ? "visible" : "hidden",
  );

  this.autoRefreshTimer = setTimeout(() => {
    refreshNow();
    reschedule();
  }, nextDelay);
};

channel.addEventListener("message", (event) => {
  const payload = event.data as { event?: string } | null;
  if (payload?.event !== AdminModelService.BROADCAST_EVENT) {
    return;
  }

  this.requestBackgroundRefresh(false);
});
```

- [ ] **Step 6: Lock the integration with a contract test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("admin model service routes background refreshes through the shared policy helper", () => {
  const serviceSource = readSource("src/services/model/adminModelService.ts");

  assert.match(serviceSource, /import \{\s*getAdminModelAutoRefreshDelay,\s*shouldStartAdminModelRefresh,\s*\} from '\.\/adminModelRefreshPolicy';/);
  assert.match(serviceSource, /private requestBackgroundRefresh\(force = false\): void \{/);
  assert.match(serviceSource, /const shouldStart = shouldStartAdminModelRefresh\(/);
  assert.match(serviceSource, /const nextDelay = delayMs \?\? getAdminModelAutoRefreshDelay\(/);
});
```

- [ ] **Step 7: Run the touched tests and typecheck**

Run: `node --test tests/unit/admin-model-refresh-policy.test.ts tests/unit/admin-model-refresh-contract.test.ts tests/unit/admin-model-service-runtime-fallback.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/services/model/adminModelRefreshPolicy.ts src/services/model/adminModelService.ts tests/unit/admin-model-refresh-policy.test.ts tests/unit/admin-model-refresh-contract.test.ts
git commit -m "refactor: throttle background admin model refreshes"
```

### Task 3: Snapshot-Backed API Settings Hydration

**Files:**
- Create: `src/services/api/userApiViewState.ts`
- Create: `tests/unit/user-api-view-state.test.ts`
- Modify: `src/components/settings/ApiSettingsView.tsx`
- Modify: `tests/unit/frontend-key-boundary-hardening.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { resolveUserApiViewState } from "../../src/services/api/userApiViewState.ts";

test("readonly snapshot hydration stays interactive when display data exists", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: true,
    isAuthenticated: true,
    isPersistenceDegraded: false,
    runtimeOfficialCount: 0,
    runtimeProviderCount: 0,
  });

  assert.equal(viewState.isHydratingRuntimeUserApis, true);
  assert.equal(viewState.userApiActionsDisabled, false);
  assert.equal(viewState.providerActionsDisabled, false);
  assert.equal(viewState.shouldUseReadonlySnapshotForDisplay, true);
});

test("unauthenticated users still stay blocked", () => {
  const viewState = resolveUserApiViewState({
    hasReadonlySnapshot: true,
    isAuthenticated: false,
    isPersistenceDegraded: false,
    runtimeOfficialCount: 0,
    runtimeProviderCount: 0,
  });

  assert.equal(viewState.userApiActionsDisabled, true);
  assert.equal(viewState.providerActionsDisabled, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/user-api-view-state.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/services/api/userApiViewState.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
export interface UserApiViewStateInput {
  hasReadonlySnapshot: boolean;
  isAuthenticated: boolean;
  isPersistenceDegraded: boolean;
  runtimeOfficialCount: number;
  runtimeProviderCount: number;
}

export interface UserApiViewState {
  isHydratingRuntimeUserApis: boolean;
  providerActionsDisabled: boolean;
  shouldUseReadonlyProfileFallback: boolean;
  shouldUseReadonlySnapshotForDisplay: boolean;
  userApiActionsDisabled: boolean;
}

export function resolveUserApiViewState(
  input: UserApiViewStateInput,
): UserApiViewState {
  const shouldUseReadonlyProfileFallback =
    input.hasReadonlySnapshot
    && input.runtimeOfficialCount === 0
    && input.runtimeProviderCount === 0;

  const isHydratingRuntimeUserApis =
    shouldUseReadonlyProfileFallback
    && !input.isPersistenceDegraded;

  const shouldUseReadonlySnapshotForDisplay =
    shouldUseReadonlyProfileFallback
    || (
      input.isPersistenceDegraded
      && input.runtimeOfficialCount === 0
      && input.runtimeProviderCount === 0
    );

  const actionsDisabled = !input.isAuthenticated;

  return {
    isHydratingRuntimeUserApis,
    providerActionsDisabled: actionsDisabled,
    shouldUseReadonlyProfileFallback,
    shouldUseReadonlySnapshotForDisplay,
    userApiActionsDisabled: actionsDisabled,
  };
}
```

- [ ] **Step 4: Run helper test to verify it passes**

Run: `node --test tests/unit/user-api-view-state.test.ts`
Expected: PASS

- [ ] **Step 5: Integrate the helper into `ApiSettingsView`**

```ts
import { resolveUserApiViewState } from "../../services/api/userApiViewState";

const userApiViewState = resolveUserApiViewState({
  hasReadonlySnapshot,
  isAuthenticated,
  isPersistenceDegraded: isUserApiPersistenceDegraded,
  runtimeOfficialCount: runtimeOfficialSlots.length,
  runtimeProviderCount: runtimeThirdPartyProviders.length,
});

const shouldUseReadonlyProfileFallback =
  userApiViewState.shouldUseReadonlyProfileFallback;
const isHydratingRuntimeUserApis =
  userApiViewState.isHydratingRuntimeUserApis;
const shouldUseReadonlySnapshotForDisplay =
  userApiViewState.shouldUseReadonlySnapshotForDisplay;

const userApiActionsDisabled = userApiViewState.userApiActionsDisabled;
const providerActionsDisabled = userApiViewState.providerActionsDisabled;
const userApiEditorDisabled =
  !isAuthenticated || (!hasReadonlySnapshot && isHydratingRuntimeUserApis);
const userApiEditorReadOnly = userApiEditorDisabled;
const providerEditorReadOnly =
  !isAuthenticated || (!hasReadonlySnapshot && isHydratingRuntimeUserApis);
```

- [ ] **Step 6: Update the source-contract test to match the helper-based state**

```ts
assert.match(source, /import \{ resolveUserApiViewState \} from '\.\.\/\.\.\/services\/api\/userApiViewState';/);
assert.match(source, /const userApiViewState = resolveUserApiViewState\(\{/);
assert.match(source, /const userApiActionsDisabled = userApiViewState\.userApiActionsDisabled;/);
assert.match(source, /const providerActionsDisabled = userApiViewState\.providerActionsDisabled;/);
assert.match(source, /const userApiEditorDisabled =\s*!isAuthenticated \|\| \(!hasReadonlySnapshot && isHydratingRuntimeUserApis\);/);
```

- [ ] **Step 7: Run the touched tests and typecheck**

Run: `node --test tests/unit/user-api-view-state.test.ts tests/unit/frontend-key-boundary-hardening.test.ts tests/unit/billing-remaining-balance-contract.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/services/api/userApiViewState.ts src/components/settings/ApiSettingsView.tsx tests/unit/user-api-view-state.test.ts tests/unit/frontend-key-boundary-hardening.test.ts
git commit -m "refactor: keep api settings responsive during silent sync"
```

### Task 4: Provider Manager Action-Scoped Loading

**Files:**
- Create: `src/services/api/providerManagerBusyState.ts`
- Create: `tests/unit/provider-manager-busy-state.test.ts`
- Create: `tests/unit/provider-manager-loading-contract.test.ts`
- Modify: `src/components/api/ThirdPartyProviderManager.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  IDLE_PROVIDER_MANAGER_BUSY_STATE,
  finishProviderManagerBusy,
  isAnyProviderManagerBusy,
  startProviderManagerBusy,
} from "../../src/services/api/providerManagerBusyState.ts";

test("provider refresh only marks the targeted provider as busy", () => {
  const busyState = startProviderManagerBusy(
    IDLE_PROVIDER_MANAGER_BUSY_STATE,
    { type: "refresh-provider", providerId: "provider-1" },
  );

  assert.equal(busyState.refreshingProviderId, "provider-1");
  assert.equal(busyState.creating, false);
  assert.equal(isAnyProviderManagerBusy(busyState), true);
});

test("finishing a provider refresh clears the targeted busy slot", () => {
  const busyState = finishProviderManagerBusy(
    {
      ...IDLE_PROVIDER_MANAGER_BUSY_STATE,
      refreshingProviderId: "provider-1",
    },
    { type: "refresh-provider", providerId: "provider-1" },
  );

  assert.equal(busyState.refreshingProviderId, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/provider-manager-busy-state.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/services/api/providerManagerBusyState.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ProviderManagerBusyState {
  creating: boolean;
  prefetchingPricingProviderId: string | null;
  refreshingAll: boolean;
  refreshingProviderId: string | null;
  updatingBalanceProviderId: string | null;
}

export const IDLE_PROVIDER_MANAGER_BUSY_STATE: ProviderManagerBusyState = {
  creating: false,
  prefetchingPricingProviderId: null,
  refreshingAll: false,
  refreshingProviderId: null,
  updatingBalanceProviderId: null,
};

export type ProviderManagerBusyAction =
  | { type: "create" }
  | { type: "refresh-all" }
  | { type: "refresh-provider"; providerId: string }
  | { type: "update-balance"; providerId: string }
  | { type: "prefetch-pricing"; providerId: string };

export function startProviderManagerBusy(
  state: ProviderManagerBusyState,
  action: ProviderManagerBusyAction,
): ProviderManagerBusyState {
  switch (action.type) {
    case "create":
      return { ...state, creating: true };
    case "refresh-all":
      return { ...state, refreshingAll: true };
    case "refresh-provider":
      return { ...state, refreshingProviderId: action.providerId };
    case "update-balance":
      return { ...state, updatingBalanceProviderId: action.providerId };
    case "prefetch-pricing":
      return { ...state, prefetchingPricingProviderId: action.providerId };
  }
}

export function finishProviderManagerBusy(
  state: ProviderManagerBusyState,
  action: ProviderManagerBusyAction,
): ProviderManagerBusyState {
  switch (action.type) {
    case "create":
      return { ...state, creating: false };
    case "refresh-all":
      return { ...state, refreshingAll: false };
    case "refresh-provider":
      return state.refreshingProviderId === action.providerId
        ? { ...state, refreshingProviderId: null }
        : state;
    case "update-balance":
      return state.updatingBalanceProviderId === action.providerId
        ? { ...state, updatingBalanceProviderId: null }
        : state;
    case "prefetch-pricing":
      return state.prefetchingPricingProviderId === action.providerId
        ? { ...state, prefetchingPricingProviderId: null }
        : state;
  }
}

export function isAnyProviderManagerBusy(state: ProviderManagerBusyState): boolean {
  return state.creating
    || state.refreshingAll
    || Boolean(state.refreshingProviderId)
    || Boolean(state.updatingBalanceProviderId)
    || Boolean(state.prefetchingPricingProviderId);
}
```

- [ ] **Step 4: Run helper test to verify it passes**

Run: `node --test tests/unit/provider-manager-busy-state.test.ts`
Expected: PASS

- [ ] **Step 5: Integrate keyed loading state into `ThirdPartyProviderManager`**

```ts
import {
  finishProviderManagerBusy,
  IDLE_PROVIDER_MANAGER_BUSY_STATE,
  isAnyProviderManagerBusy,
  startProviderManagerBusy,
} from "../../services/api/providerManagerBusyState";

const [busyState, setBusyState] = useState(IDLE_PROVIDER_MANAGER_BUSY_STATE);

const withBusyState = async <T,>(
  action: ProviderManagerBusyAction,
  task: () => Promise<T>,
): Promise<T> => {
  setBusyState((current) => startProviderManagerBusy(current, action));
  try {
    return await task();
  } finally {
    setBusyState((current) => finishProviderManagerBusy(current, action));
  }
};

const handleAddProvider = async () => withBusyState({ type: "create" }, async () => {
  // existing creation body
});

const refreshManagementData = async (
  provider: ThirdPartyProvider,
  options?: { silent?: boolean; timeout?: number },
) => withBusyState({ type: "refresh-provider", providerId: provider.id }, async () => {
  if (!options?.silent) {
    notify.info("正在刷新...", "获取渠道和分组信息");
  }

  // existing fetch logic
});

const updateChannelsBalance = async (provider: ThirdPartyProvider) =>
  withBusyState({ type: "update-balance", providerId: provider.id }, async () => {
    // existing balance sync logic
  });

const refreshAllProviders = async () =>
  withBusyState({ type: "refresh-all" }, async () => {
    for (const provider of managementProviders) {
      await refreshManagementData(provider, { silent: true, timeout: 10_000 });
    }
  });
```

- [ ] **Step 6: Lock the component contract**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("ThirdPartyProviderManager uses keyed busy state instead of one global loading flag", () => {
  const source = readSource("src/components/api/ThirdPartyProviderManager.tsx");

  assert.match(source, /import \{\s*finishProviderManagerBusy,\s*IDLE_PROVIDER_MANAGER_BUSY_STATE,\s*isAnyProviderManagerBusy,\s*startProviderManagerBusy,\s*\} from '\.\.\/\.\.\/services\/api\/providerManagerBusyState';/);
  assert.match(source, /const \[busyState, setBusyState\] = useState\(IDLE_PROVIDER_MANAGER_BUSY_STATE\);/);
  assert.match(source, /const withBusyState = async <T,>\(/);
  assert.match(source, /if \(!options\?\.silent\) \{\s*notify\.info\("正在刷新\.\.\.", "获取渠道和分组信息"\);\s*\}/);
  assert.doesNotMatch(source, /const \[isLoading, setIsLoading\] = useState\(false\);/);
});
```

- [ ] **Step 7: Run the touched tests and typecheck**

Run: `node --test tests/unit/provider-manager-busy-state.test.ts tests/unit/provider-manager-loading-contract.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/services/api/providerManagerBusyState.ts src/components/api/ThirdPartyProviderManager.tsx tests/unit/provider-manager-busy-state.test.ts tests/unit/provider-manager-loading-contract.test.ts
git commit -m "refactor: scope provider manager loading states"
```

### Task 5: Full Verification And Handoff

**Files:**
- Modify: `docs/development/progress.md`

- [ ] **Step 1: Record the refresh-loading rollout in progress notes**

```md
## 2026-04-07

- Refined billing refresh to keep bootstrap loading separate from silent background refresh.
- Added admin model refresh cooldown policy to reduce duplicate focus and visibility refreshes.
- Kept API settings snapshot-backed during silent cloud reconciliation.
- Replaced provider manager page-wide loading with action-scoped busy states.
```

- [ ] **Step 2: Run unit tests for the whole refresh-loading surface**

Run: `node --test tests/unit/billing-refresh-mode.test.ts tests/unit/admin-model-refresh-policy.test.ts tests/unit/admin-model-refresh-contract.test.ts tests/unit/user-api-view-state.test.ts tests/unit/provider-manager-busy-state.test.ts tests/unit/provider-manager-loading-contract.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts`
Expected: PASS

- [ ] **Step 3: Run required project checks**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run governance:agent-docs`
Expected: PASS

Run: `npm run check:encoding`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/development/progress.md
git commit -m "docs: record refresh and loading coordination rollout"
```

---

## Self-Review

- Spec coverage checked: billing semantics, admin model throttling, snapshot-backed settings hydration, and provider-manager scoped loading all map to concrete tasks.
- Placeholder scan checked: no `TODO`, `TBD`, or implicit "write tests later" steps remain.
- Type consistency checked: helper names used in later tasks match earlier task definitions.
