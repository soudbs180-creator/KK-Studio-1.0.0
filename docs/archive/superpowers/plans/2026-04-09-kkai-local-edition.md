# KKAI Local Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable `KKAI` local-only edition that opens directly into the workspace, stores API/provider/model settings only through the local API plus local file persistence, and removes login, billing, admin, and cloud sync behavior.

**Architecture:** Keep the existing frontend and local API shape, but introduce an explicit local-only runtime contract. Use that contract to replace auth-gated startup, route all BYOK/provider state through the local API-backed file store, remove backend cloud mirroring, then strip hosted-only feature surfaces and safely stage the resulting standalone project into `C:\Users\Administrator\Downloads\KKAI`.

**Tech Stack:** React 19, TypeScript, Vite, Node `node:test`, local API server in `apps/api`, PowerShell scripts, existing `packages/contracts` and `packages/shared`

---

### Task 1: Lock the local-only runtime contract with failing tests

**Files:**
- Create: `src/app/kkaiLocalRuntime.ts`
- Create: `tests/unit/kkai-local-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KKAI_LOCAL_USER_ID,
  createKkaiLocalRuntime,
} from '../../src/app/kkaiLocalRuntime.ts';

test('createKkaiLocalRuntime returns the fixed local profile and restores the latest local workspace when available', () => {
  assert.deepEqual(
    createKkaiLocalRuntime({ hasStoredWorkspace: true }),
    {
      mode: 'local-only',
      userId: KKAI_LOCAL_USER_ID,
      launchTarget: 'restore-last-workspace',
      cloudReadsAllowed: false,
      cloudWritesAllowed: false,
      billingEnabled: false,
      adminEnabled: false,
    },
  );
});

test('createKkaiLocalRuntime falls back to a blank local workspace when nothing is stored yet', () => {
  assert.equal(
    createKkaiLocalRuntime({ hasStoredWorkspace: false }).launchTarget,
    'default-workspace',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/kkai-local-runtime.test.ts"`
Expected: FAIL because `src/app/kkaiLocalRuntime.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export const KKAI_LOCAL_USER_ID = 'local-user';

export interface KkaiLocalRuntime {
  mode: 'local-only';
  userId: string;
  launchTarget: 'restore-last-workspace' | 'default-workspace';
  cloudReadsAllowed: false;
  cloudWritesAllowed: false;
  billingEnabled: false;
  adminEnabled: false;
}

export function createKkaiLocalRuntime(
  input: { hasStoredWorkspace: boolean },
): KkaiLocalRuntime {
  return {
    mode: 'local-only',
    userId: KKAI_LOCAL_USER_ID,
    launchTarget: input.hasStoredWorkspace ? 'restore-last-workspace' : 'default-workspace',
    cloudReadsAllowed: false,
    cloudWritesAllowed: false,
    billingEnabled: false,
    adminEnabled: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "tests/unit/kkai-local-runtime.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/kkaiLocalRuntime.ts tests/unit/kkai-local-runtime.test.ts
git commit -m "test: lock kkai local runtime contract"
```

### Task 2: Replace auth-gated startup with a direct local-only app root

**Files:**
- Create: `src/context/KkaiRuntimeContext.tsx`
- Create: `tests/unit/kkai-app-root.test.ts`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/context/AppStartupContext.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createAppRootMode,
  createKkaiRuntimeAuthSnapshot,
} from '../../src/context/KkaiRuntimeContext.tsx';

test('createKkaiRuntimeAuthSnapshot produces a non-loading fixed local runtime user', () => {
  const snapshot = createKkaiRuntimeAuthSnapshot();

  assert.equal(snapshot.loading, false);
  assert.equal(snapshot.isTempUser, false);
  assert.equal(snapshot.user?.id, 'local-user');
  assert.equal(snapshot.session, null);
});

test('createAppRootMode always boots the workspace shell in local-only mode', () => {
  assert.equal(createAppRootMode({ pathname: '/' }), 'workspace');
  assert.equal(createAppRootMode({ pathname: '/auth/callback' }), 'workspace');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/kkai-app-root.test.ts"`
Expected: FAIL because `KkaiRuntimeContext.tsx` and the app-root helper do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```tsx
export function createKkaiRuntimeAuthSnapshot() {
  return {
    session: null,
    user: {
      id: 'local-user',
      email: null,
      user_metadata: {},
    },
    loading: false,
    isTempUser: false,
    tempUserExpiry: null,
    signOut: async () => {},
    loginAsTempUser: async () => {},
  };
}

export function createAppRootMode(_input: { pathname: string }) {
  return 'workspace' as const;
}
```

Apply that contract in the root:

```tsx
// src/main.tsx
root.render(
  <ErrorBoundary>
    <LocaleProvider>
      <KkaiRuntimeProvider>
        <App />
      </KkaiRuntimeProvider>
    </LocaleProvider>
  </ErrorBoundary>
);
```

```tsx
// src/App.tsx
const App: React.FC = () => (
  <ThemeProvider>
    <AppStartupProvider>
      <CanvasProvider>
        <AuthenticatedAppShell
          showCostEstimation={false}
          onExitCostEstimation={() => undefined}
          AppContentComponent={AppContent}
        />
      </CanvasProvider>
    </AppStartupProvider>
  </ThemeProvider>
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "tests/unit/kkai-local-runtime.test.ts" "tests/unit/kkai-app-root.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/KkaiRuntimeContext.tsx src/main.tsx src/App.tsx src/context/AppStartupContext.tsx tests/unit/kkai-app-root.test.ts
git commit -m "feat: boot kkai directly into the local workspace"
```

### Task 3: Move frontend settings and key-manager state to the local API plus local file store only

**Files:**
- Create: `src/services/api/kkaiUserApiStorageMode.ts`
- Create: `tests/unit/kkai-user-api-storage-mode.test.ts`
- Modify: `src/components/settings/ApiSettingsView.tsx`
- Modify: `src/services/auth/keyManager.ts`
- Modify: `src/services/api/userApiProfileStorage.ts`
- Modify: `src/services/api/userApiCloudRecordStorage.ts`
- Modify: `src/services/api/kkApiServerHealth.ts`
- Modify: `tests/unit/user-api-cloud-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isKkaiUserApiStorageReady,
  resolveKkaiUserApiStorageMode,
} from '../../src/services/api/kkaiUserApiStorageMode.ts';

test('resolveKkaiUserApiStorageMode treats local-file auth persistence as ready in KKAI', () => {
  assert.equal(
    resolveKkaiUserApiStorageMode({
      reachable: true,
      repositories: { authData: 'local-file' },
      persistence: { userApiKeys: true, keyManager: true },
    }),
    'local-file-ready',
  );
});

test('isKkaiUserApiStorageReady rejects cloud fallback writes', () => {
  assert.equal(
    isKkaiUserApiStorageReady({
      reachable: false,
      repositories: { authData: 'unknown' },
      persistence: { userApiKeys: false, keyManager: false },
    }),
    false,
  );
});
```

Also add one regression to the existing cloud-storage suite that proves KKAI storage helpers no longer call Supabase when the local API succeeds.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test "tests/unit/kkai-user-api-storage-mode.test.ts" "tests/unit/user-api-cloud-storage.test.ts"`
Expected: FAIL because the storage-mode helper does not exist and the current storage implementation still imports Supabase fallback behavior.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function resolveKkaiUserApiStorageMode(health: {
  reachable: boolean;
  repositories: { authData: string };
  persistence: { userApiKeys: boolean; keyManager: boolean };
}) {
  if (
    health.reachable
    && health.repositories.authData === 'local-file'
    && health.persistence.userApiKeys
    && health.persistence.keyManager
  ) {
    return 'local-file-ready' as const;
  }

  return 'not-ready' as const;
}
```

Use that helper to collapse the cloud branches:

```tsx
// ApiSettingsView.tsx
const storageMode = resolveKkaiUserApiStorageMode(apiHealthLikeObject);
const useCloudBackedUserApiWrites = false;
const shouldUseReadonlyProfileFallback = false;
```

```ts
// userApiCloudRecordStorage.ts
export async function loadUserApisPayloadFromCloudRecord() {
  const response = await legacyWebApiClient.getKeyManagerCloudState();
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to load local user API payload.');
  }
  return response.data;
}
```

```ts
// keyManager.ts
const response = await legacyWebApiClient.replaceKeyManagerCloudState({
  version: 2,
  slots: compactSlots,
  providers: compactProviders,
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "tests/unit/kkai-user-api-storage-mode.test.ts" "tests/unit/user-api-cloud-storage.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/api/kkaiUserApiStorageMode.ts src/components/settings/ApiSettingsView.tsx src/services/auth/keyManager.ts src/services/api/userApiProfileStorage.ts src/services/api/userApiCloudRecordStorage.ts src/services/api/kkApiServerHealth.ts tests/unit/kkai-user-api-storage-mode.test.ts tests/unit/user-api-cloud-storage.test.ts
git commit -m "feat: make kkai user api settings local-only"
```

### Task 4: Make the local API backend writable without Supabase and remove auth-data cloud mirroring

**Files:**
- Create: `scripts/run-api-local.mjs`
- Create: `tests/unit/kkai-local-api-startup.test.ts`
- Modify: `scripts/lib/local-api-bootstrap.mjs`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/auth/application/auth-data-service.ts`
- Modify: `tests/unit/auth-data-routes.test.ts`
- Modify: `tests/unit/api-server-startup.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { startApiServer } from '../../apps/api/src/server.ts';

test('startApiServer exposes profile routes in KKAI local-only mode without Supabase config', async () => {
  process.env.KKAI_LOCAL_ONLY = 'true';

  const server = await startApiServer(0, {
    allowDegradedPersistence: true,
    verifyTurnstileToken: async () => ({ success: true }),
  });

  assert.equal(server.listening, true);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
```

Add one auth-data route regression that proves replacing user API payload does not require a `cloudMirror` instance in local-only mode.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test "tests/unit/kkai-local-api-startup.test.ts" "tests/unit/auth-data-routes.test.ts" "tests/unit/api-server-startup.test.ts"`
Expected: FAIL because local API bootstrap still requires canonical Supabase config and `AuthDataService` still contains cloud-mirror behavior.

- [ ] **Step 3: Write the minimal implementation**

```ts
// scripts/run-api-local.mjs
process.env.KKAI_LOCAL_ONLY = 'true';
process.env.RUN_KK_API_SKELETON = 'false';
process.env.PORT = process.env.PORT || '3001';

const { startApiServer } = await import('../apps/api/src/server.ts');
await startApiServer(Number(process.env.PORT), {
  allowDegradedPersistence: true,
});
```

```ts
// server.ts
const isKkaiLocalOnly = process.env.KKAI_LOCAL_ONLY === 'true';
const authDataService = new AuthDataService(authDataRepository);
const effectiveAuthenticatedUser = isKkaiLocalOnly
  ? { userId: 'local-user', email: undefined, role: undefined }
  : authenticatedUser;
```

```ts
// auth-data-service.ts
constructor(repository: AuthDataRepository) {
  this.repository = repository;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "tests/unit/kkai-local-api-startup.test.ts" "tests/unit/auth-data-routes.test.ts" "tests/unit/api-server-startup.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/run-api-local.mjs scripts/lib/local-api-bootstrap.mjs apps/api/src/server.ts apps/api/src/modules/auth/application/auth-data-service.ts tests/unit/kkai-local-api-startup.test.ts tests/unit/auth-data-routes.test.ts tests/unit/api-server-startup.test.ts
git commit -m "feat: make kkai api server local-only"
```

### Task 5: Remove hosted-only feature surfaces and cloud workspace sync from the runtime

**Files:**
- Create: `src/app/kkaiFeatureFlags.ts`
- Create: `tests/unit/kkai-feature-surface.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/PromptBar.tsx`
- Modify: `src/components/layout/ChatSidebar.tsx`
- Modify: `src/routes/settingsRoutes.tsx`
- Modify: `src/context/CanvasContext.tsx`
- Modify: `src/services/system/syncService.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KKAI_FEATURE_FLAGS,
  shouldEnableWorkspaceCloudSync,
} from '../../src/app/kkaiFeatureFlags.ts';

test('KKAI disables billing, admin, and workspace cloud sync features', () => {
  assert.deepEqual(KKAI_FEATURE_FLAGS, {
    billing: false,
    admin: false,
    workspaceCloudSync: false,
    cloudProfileFallback: false,
  });
  assert.equal(shouldEnableWorkspaceCloudSync(), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test "tests/unit/kkai-feature-surface.test.ts"`
Expected: FAIL because the feature-flag contract does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export const KKAI_FEATURE_FLAGS = {
  billing: false,
  admin: false,
  workspaceCloudSync: false,
  cloudProfileFallback: false,
} as const;

export function shouldEnableWorkspaceCloudSync() {
  return KKAI_FEATURE_FLAGS.workspaceCloudSync;
}
```

Thread the flags through the runtime:

```tsx
// App.tsx
const showBalanceUi = KKAI_FEATURE_FLAGS.billing;
const showAdminUi = KKAI_FEATURE_FLAGS.admin;
```

```ts
// syncService.ts
async loadLayout(): Promise<Canvas[]> {
  return [];
}
```

```ts
// CanvasContext.tsx
const canLoadCloudLayout = false;
const canSaveCloudLayout = false;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "tests/unit/kkai-feature-surface.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/kkaiFeatureFlags.ts src/App.tsx src/components/layout/PromptBar.tsx src/components/layout/ChatSidebar.tsx src/routes/settingsRoutes.tsx src/context/CanvasContext.tsx src/services/system/syncService.ts tests/unit/kkai-feature-surface.test.ts
git commit -m "feat: strip hosted-only kkai runtime surfaces"
```

### Task 6: Stage and verify the standalone `KKAI` project safely

**Files:**
- Create: `scripts/kkai/stage-local-edition.mjs`
- Create: `tests/unit/kkai-stage-manifest.test.ts`
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-04-09-kkai-local-edition-design.md`
- Modify: `docs/superpowers/plans/2026-04-09-kkai-local-edition.md`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getKkaiStageManifest } from '../../scripts/kkai/stage-local-edition.mjs';

test('getKkaiStageManifest stages the required frontend, local API, scripts, and packages', () => {
  const manifest = getKkaiStageManifest();

  assert.equal(manifest.targetRoot.endsWith('KKAI'), true);
  assert.deepEqual(
    manifest.requiredPaths,
    ['src', 'apps/api', 'scripts', 'packages', 'public', 'package.json', 'vite.config.ts'],
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test "tests/unit/kkai-stage-manifest.test.ts"`
Expected: FAIL because the staging script does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```js
export function getKkaiStageManifest() {
  return {
    targetRoot: 'C:\\Users\\Administrator\\Downloads\\KKAI',
    backupRootPrefix: 'C:\\Users\\Administrator\\Downloads\\KKAI.backup-',
    requiredPaths: [
      'src',
      'apps/api',
      'scripts',
      'packages',
      'public',
      'package.json',
      'vite.config.ts',
    ],
  };
}
```

Add scripts:

```json
{
  "scripts": {
    "kkai:stage": "node scripts/kkai/stage-local-edition.mjs",
    "kkai:api:dev": "node scripts/run-api-local.mjs"
  }
}
```

- [ ] **Step 4: Run the staging test and required project verification**

Run: `node --test "tests/unit/kkai-stage-manifest.test.ts"`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

Run: `npm run governance:agent-docs`
Expected: PASS

Run: `npm run check:encoding`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/kkai/stage-local-edition.mjs package.json tests/unit/kkai-stage-manifest.test.ts docs/superpowers/specs/2026-04-09-kkai-local-edition-design.md docs/superpowers/plans/2026-04-09-kkai-local-edition.md
git commit -m "docs: plan kkai local edition staging"
```
