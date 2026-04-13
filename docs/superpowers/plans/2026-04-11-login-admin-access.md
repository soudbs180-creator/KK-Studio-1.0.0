# Login And Admin Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google sign-in, demote temporary/admin entry points into one compact auxiliary row on the login screen, and enforce one server-configured primary admin identity while preserving delegated admin roles and elevated admin password sessions.

**Architecture:** Keep authentication split by responsibility: password sign-in remains on the existing KK API path, WeChat keeps its current QR flow, and Google sign-in is added as a focused Supabase OAuth helper that lands in the existing `/auth/callback` hydration path. On the backend, introduce a small primary-admin configuration and resolution layer so `AdminConsoleService` can treat one canonical Supabase user ID as the owner admin while still honoring delegated `profiles.role = "admin"` users and protecting the owner from accidental demotion.

**Tech Stack:** React 19, TypeScript, Vite, node:test, existing `kkWebApiClient`, existing runtime auth state helpers, existing admin-console module, Supabase browser client for Google OAuth.

---

## File Structure

- `apps/api/src/modules/admin-console/application/primary-admin-access.ts`
  - New focused helper for resolving whether an authenticated user is the primary admin, delegated admin, or plain user.
- `apps/api/src/modules/admin-console/application/admin-console-service.ts`
  - Accepts primary-admin configuration and uses it for admin access envelopes and role-mutation guards.
- `apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts`
  - Adds a lookup-by-identity helper used before role mutation so the primary admin can be protected from demotion.
- `apps/api/src/modules/admin-console/infrastructure/supabase-admin-console-repository.ts`
  - Adds the same lookup-by-identity helper for hosted persistence.
- `apps/api/src/lib/server-admin-config.ts`
  - New server-only config helper for `KK_PRIMARY_ADMIN_USER_ID`.
- `apps/api/src/server.ts`
  - Wires the new server-admin config into `AdminConsoleService` and emits a startup warning when the owner admin ID is missing.
- `apps/api/.env.local.example`
  - Documents the new owner-admin environment variable for local API runtime.
- `docs/development/hosted-release-runbook.md`
  - Documents the hosted environment requirement for `KK_PRIMARY_ADMIN_USER_ID`.
- `src/services/auth/googleAuth.ts`
  - New focused Google OAuth launcher.
- `src/components/auth/LoginScreen.tsx`
  - Wires the Google button, compact auxiliary action row, and admin-entry feedback/navigation.
- `src/components/auth/LoginScreen.css`
  - Styles the compact auxiliary actions so admin + temp login sit together as smaller controls.
- `tests/unit/admin-console-primary-admin.test.ts`
  - New service-level tests for primary-admin resolution.
- `tests/unit/admin-console-routes.test.ts`
  - Extended route tests for primary-admin demotion protection.
- `tests/unit/server-admin-config.test.ts`
  - New config-helper tests for `KK_PRIMARY_ADMIN_USER_ID`.
- `tests/unit/api-server-startup.test.ts`
  - Startup-warning coverage for missing owner-admin configuration.
- `tests/unit/google-auth-service.test.ts`
  - New tests for the Google OAuth launcher.
- `tests/unit/login-screen-auth-actions.test.ts`
  - New source-contract test for login-screen action hierarchy and compact styling.

### Task 1: Add Primary Admin Resolution In The Admin Service

**Files:**
- Create: `apps/api/src/modules/admin-console/application/primary-admin-access.ts`
- Modify: `apps/api/src/modules/admin-console/application/admin-console-service.ts`
- Test: `tests/unit/admin-console-primary-admin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AdminConsoleService } from '../../apps/api/src/modules/admin-console/application/admin-console-service.ts';
import { InMemoryAdminConsoleRepository } from '../../apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts';

test('primary admin user id resolves as admin even when the stored profile role is user', async () => {
  const repository = new InMemoryAdminConsoleRepository([
    {
      id: 'owner-user-1',
      email: 'owner@example.com',
      role: 'user',
    },
  ]);
  const service = new AdminConsoleService(repository, {
    primaryAdminUserId: 'owner-user-1',
  });

  const result = await service.getAccess('owner-user-1', 'req-owner-admin-access');

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.role, 'admin');
  assert.equal(result.data.isAdmin, true);
  assert.equal(result.data.adminSessionActive, false);
});

test('delegated profile admins still resolve as admins when they are not the owner admin', async () => {
  const repository = new InMemoryAdminConsoleRepository([
    {
      id: 'delegated-admin-1',
      email: 'delegate@example.com',
      role: 'admin',
    },
  ]);
  const service = new AdminConsoleService(repository, {
    primaryAdminUserId: 'owner-user-1',
  });

  const result = await service.getAccess('delegated-admin-1', 'req-delegated-admin-access');

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.role, 'admin');
  assert.equal(result.data.isAdmin, true);
});

test('non-admin users stay non-admin when they are neither the owner nor a delegated admin', async () => {
  const repository = new InMemoryAdminConsoleRepository([
    {
      id: 'plain-user-1',
      email: 'user@example.com',
      role: 'user',
    },
  ]);
  const service = new AdminConsoleService(repository, {
    primaryAdminUserId: 'owner-user-1',
  });

  const result = await service.getAccess('plain-user-1', 'req-plain-user-access');

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.role, 'user');
  assert.equal(result.data.isAdmin, false);
  assert.equal(result.data.requiresPasswordChange, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/admin-console-primary-admin.test.ts
```

Expected: FAIL because `tests/unit/admin-console-primary-admin.test.ts` does not exist yet, `primary-admin-access.ts` does not exist yet, and `AdminConsoleService` does not accept a second `options` argument.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/api/src/modules/admin-console/application/primary-admin-access.ts`:

```ts
import type {
  AdminProfileRecord,
  AdminRole,
} from '../infrastructure/in-memory-admin-console-repository.ts';

export interface PrimaryAdminAccessOptions {
  primaryAdminUserId?: string;
}

export interface ResolvedAdminAccess {
  role: AdminRole;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
}

export function normalizePrimaryAdminUserId(value: string | undefined): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

export function resolveAdminAccess(
  userId: string,
  profile: AdminProfileRecord | undefined,
  options: PrimaryAdminAccessOptions = {},
): ResolvedAdminAccess {
  const primaryAdminUserId = normalizePrimaryAdminUserId(options.primaryAdminUserId);

  if (primaryAdminUserId && userId === primaryAdminUserId) {
    return {
      role: 'admin',
      isAdmin: true,
      isPrimaryAdmin: true,
    };
  }

  const role: AdminRole = profile?.role === 'admin' ? 'admin' : 'user';
  return {
    role,
    isAdmin: role === 'admin',
    isPrimaryAdmin: false,
  };
}
```

Update `apps/api/src/modules/admin-console/application/admin-console-service.ts`:

```ts
import {
  resolveAdminAccess,
  type PrimaryAdminAccessOptions,
} from './primary-admin-access.ts';

export class AdminConsoleService {
  private readonly repository: AdminConsoleRepository;
  private readonly primaryAdminUserId?: string;

  constructor(
    repository: AdminConsoleRepository,
    options: PrimaryAdminAccessOptions = {},
  ) {
    this.repository = repository;
    this.primaryAdminUserId = options.primaryAdminUserId;
  }

  async getAccess(
    userId: string,
    requestId: string,
    clientVersion?: string,
    adminSessionToken?: string,
  ): Promise<ApiResponse<AdminAccessDto>> {
    const profile = await this.repository.getUserProfile(userId);
    const access = resolveAdminAccess(userId, profile, {
      primaryAdminUserId: this.primaryAdminUserId,
    });
    const passwordState = access.isAdmin
      ? await this.repository.getAdminPasswordState()
      : { requiresPasswordChange: false };
    const adminSession = access.isAdmin
      ? await this.resolveAdminSession(userId, adminSessionToken)
      : { active: false };

    return {
      success: true,
      data: {
        userId,
        role: access.role,
        isAdmin: access.isAdmin,
        requiresPasswordChange: passwordState.requiresPasswordChange,
        adminSessionActive: adminSession.active,
        adminSessionExpiresAt: adminSession.expiresAt,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/admin-console-primary-admin.test.ts
```

Expected: PASS with all three access-resolution tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin-console/application/primary-admin-access.ts apps/api/src/modules/admin-console/application/admin-console-service.ts tests/unit/admin-console-primary-admin.test.ts
git commit -m "feat: resolve owner admin identity in admin access service"
```

### Task 2: Protect The Primary Admin From Demotion And Add Identity Lookup Helpers

**Files:**
- Modify: `apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts`
- Modify: `apps/api/src/modules/admin-console/infrastructure/supabase-admin-console-repository.ts`
- Modify: `apps/api/src/modules/admin-console/application/admin-console-service.ts`
- Modify: `tests/unit/admin-console-routes.test.ts`

- [ ] **Step 1: Extend the failing route test**

Append this test to `tests/unit/admin-console-routes.test.ts`:

```ts
test('owner admin cannot be demoted through the delegated role mutation route', async () => {
  const service = new AdminConsoleService(new InMemoryAdminConsoleRepository(), {
    primaryAdminUserId: 'admin-user-1',
  });

  const verify = await handleVerifyAdminPassword(service, {
    password: '123456',
  }, {
    [AUTHENTICATED_USER_ID_HEADER]: 'admin-user-1',
    [AUTHENTICATED_USER_ROLE_HEADER]: 'admin',
    'x-request-id': 'req-owner-demotion-verify',
  });

  assert.equal(verify.statusCode, 200);
  assert.equal(verify.body.success, true);
  if (!verify.body.success) {
    return;
  }

  const demotion = await handleSetUserRole(service, {
    identity: 'admin-user-1',
    role: 'user',
  }, {
    [AUTHENTICATED_USER_ID_HEADER]: 'admin-user-1',
    [AUTHENTICATED_USER_ROLE_HEADER]: 'admin',
    [ADMIN_SESSION_TOKEN_HEADER]: verify.body.data.adminSessionToken,
    'x-request-id': 'req-owner-demotion',
  });

  assert.equal(demotion.statusCode, 409);
  assert.equal(demotion.body.success, false);
  if (demotion.body.success) {
    return;
  }

  assert.equal(demotion.body.error.code, 'PRIMARY_ADMIN_ROLE_PROTECTED');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/admin-console-routes.test.ts
```

Expected: FAIL because the current repository interface cannot look up the target before updating it, and `handleSetUserRole` still allows the owner admin to be demoted.

- [ ] **Step 3: Write the minimal implementation**

Extend the repository interface in `apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts`:

```ts
export interface AdminConsoleRepository {
  getUserProfile(userId: string): Promise<AdminProfileRecord | undefined>;
  findUserProfileByIdentity(identity: string): Promise<AdminProfileRecord | undefined>;
  verifyAdminPassword(password: string): Promise<boolean>;
  getAdminPasswordState(): Promise<AdminPasswordState>;
  getActiveAdminSession(
    adminUserId: string,
    sessionTokenHash: string,
    now: string,
  ): Promise<AdminSessionRecord | undefined>;
  createAdminSession(input: CreateAdminSessionInput): Promise<void>;
  revokeAdminSessions(adminUserId: string, revokedAt: string): Promise<void>;
  changeAdminPassword(oldPassword: string, newPassword: string): Promise<void>;
  setUserRole(identity: string, role: AdminRole): Promise<ResolvedRoleChangeTarget>;
}

async findUserProfileByIdentity(identity: string): Promise<AdminProfileRecord | undefined> {
  const normalizedIdentity = String(identity || '').trim();
  const target = Array.from(this.profiles.values()).find((profile) => (
    profile.id === normalizedIdentity
    || String(profile.email || '').trim().toLowerCase() === normalizedIdentity.toLowerCase()
  ));

  return target ? { ...target } : undefined;
}
```

Add the Supabase lookup mirror in `apps/api/src/modules/admin-console/infrastructure/supabase-admin-console-repository.ts`:

```ts
async findUserProfileByIdentity(identity: string): Promise<AdminProfileRecord | undefined> {
  const target = await this.findTargetProfile(identity);
  if (!target) {
    return undefined;
  }

  return {
    id: target.id,
    email: target.email || undefined,
    role: normalizeRole(target.role),
  };
}
```

Guard the demotion path in `apps/api/src/modules/admin-console/application/admin-console-service.ts`:

```ts
const PRIMARY_ADMIN_ROLE_PROTECTED_CODE = 'PRIMARY_ADMIN_ROLE_PROTECTED';

async setUserRole(
  userId: string,
  input: SetUserRoleRequestDto,
  requestId: string,
  clientVersion?: string,
  adminSessionToken?: string,
): Promise<ApiResponse<SetUserRoleResponseDto>> {
  const access = await this.requireElevatedAdmin(
    userId,
    adminSessionToken,
    requestId,
    clientVersion,
  );
  if (access !== true) {
    return access;
  }

  const target = await this.repository.findUserProfileByIdentity(input.identity);
  if (!target) {
    return {
      success: false,
      error: {
        code: 'ADMIN_TARGET_NOT_FOUND',
        message: 'The target profile could not be found.',
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  if (
    input.role === 'user'
    && this.primaryAdminUserId
    && target.id === this.primaryAdminUserId
  ) {
    return {
      success: false,
      error: {
        code: PRIMARY_ADMIN_ROLE_PROTECTED_CODE,
        message: 'The primary admin account cannot be demoted.',
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  const updated = await this.repository.setUserRole(input.identity, input.role);
  return {
    success: true,
    data: updated,
    meta: buildRequestMeta(requestId, clientVersion),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/admin-console-primary-admin.test.ts tests/unit/admin-console-routes.test.ts
```

Expected:

- `tests/unit/admin-console-primary-admin.test.ts` stays green
- `tests/unit/admin-console-routes.test.ts` passes with the new owner-admin demotion protection

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts apps/api/src/modules/admin-console/infrastructure/supabase-admin-console-repository.ts apps/api/src/modules/admin-console/application/admin-console-service.ts tests/unit/admin-console-routes.test.ts
git commit -m "feat: protect owner admin from delegated demotion"
```

### Task 3: Add Server Admin Config Wiring And Documentation

**Files:**
- Create: `apps/api/src/lib/server-admin-config.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/.env.local.example`
- Modify: `docs/development/hosted-release-runbook.md`
- Create: `tests/unit/server-admin-config.test.ts`
- Modify: `tests/unit/api-server-startup.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/server-admin-config.test.ts`:

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  resolveServerAdminConfig,
  summarizeServerAdminConfig,
} from '../../apps/api/src/lib/server-admin-config.ts';

const originalPrimaryAdminUserId = process.env.KK_PRIMARY_ADMIN_USER_ID;

afterEach(() => {
  if (typeof originalPrimaryAdminUserId === 'string') {
    process.env.KK_PRIMARY_ADMIN_USER_ID = originalPrimaryAdminUserId;
  } else {
    delete process.env.KK_PRIMARY_ADMIN_USER_ID;
  }
});

test('server admin config reports when the owner admin id is configured', () => {
  process.env.KK_PRIMARY_ADMIN_USER_ID = 'owner-user-1';

  const config = resolveServerAdminConfig();
  const summary = summarizeServerAdminConfig(config);

  assert.equal(config.primaryAdminUserId, 'owner-user-1');
  assert.equal(summary.primaryAdminUserIdConfigured, true);
  assert.deepEqual(summary.blockers, []);
});

test('server admin config reports a clear blocker when the owner admin id is missing', () => {
  delete process.env.KK_PRIMARY_ADMIN_USER_ID;

  const config = resolveServerAdminConfig();
  const summary = summarizeServerAdminConfig(config);

  assert.equal(config.primaryAdminUserId, undefined);
  assert.equal(summary.primaryAdminUserIdConfigured, false);
  assert.deepEqual(summary.blockers, ['KK_PRIMARY_ADMIN_USER_ID_MISSING']);
});
```

Append this test to `tests/unit/api-server-startup.test.ts`:

```ts
test('startApiServer warns once when the owner admin id is missing', async () => {
  const originalPrimaryAdminUserId = process.env.KK_PRIMARY_ADMIN_USER_ID;
  delete process.env.KK_PRIMARY_ADMIN_USER_ID;

  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const server = await startApiServer(0, {
      allowDegradedPersistence: true,
      verifyTurnstileToken: async () => ({ success: true }),
    });
    trackedServers.add(server);
  } finally {
    console.warn = originalWarn;
    if (typeof originalPrimaryAdminUserId === 'string') {
      process.env.KK_PRIMARY_ADMIN_USER_ID = originalPrimaryAdminUserId;
    }
  }

  assert.match(warnings.join('\n'), /KK_PRIMARY_ADMIN_USER_ID/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/server-admin-config.test.ts tests/unit/api-server-startup.test.ts
```

Expected: FAIL because `server-admin-config.ts` does not exist yet and startup currently does not warn about a missing owner-admin ID.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/api/src/lib/server-admin-config.ts`:

```ts
export interface ServerAdminConfig {
  primaryAdminUserId?: string;
}

export interface ServerAdminConfigSummary {
  primaryAdminUserIdConfigured: boolean;
  blockers: string[];
}

export function resolveServerAdminConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerAdminConfig {
  const primaryAdminUserId = String(env.KK_PRIMARY_ADMIN_USER_ID || '').trim() || undefined;
  return {
    primaryAdminUserId,
  };
}

export function summarizeServerAdminConfig(
  config: ServerAdminConfig,
): ServerAdminConfigSummary {
  return {
    primaryAdminUserIdConfigured: Boolean(config.primaryAdminUserId),
    blockers: config.primaryAdminUserId ? [] : ['KK_PRIMARY_ADMIN_USER_ID_MISSING'],
  };
}
```

Wire it in `apps/api/src/server.ts`:

```ts
import {
  resolveServerAdminConfig,
  summarizeServerAdminConfig,
} from './lib/server-admin-config.ts';

const serverAdminConfig = resolveServerAdminConfig();
const serverAdminSummary = summarizeServerAdminConfig(serverAdminConfig);

if (!serverAdminSummary.primaryAdminUserIdConfigured) {
  logStartupMode(
    'warn',
    'Owner admin identity is not configured. Set KK_PRIMARY_ADMIN_USER_ID to lock the default administrator.',
    {
      blockers: serverAdminSummary.blockers,
    },
  );
}

const adminConsoleService = new AdminConsoleService(adminConsoleRepository, {
  primaryAdminUserId: serverAdminConfig.primaryAdminUserId,
});
```

Document the new variable in `apps/api/.env.local.example`:

```env
SUPABASE_URL=https://ovdjhdofjysanamgkfng.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-your-supabase-service-role-key
USER_API_ENCRYPTION_SECRET=replace-with-a-stable-random-secret
KK_PRIMARY_ADMIN_USER_ID=replace-with-the-owner-supabase-user-id
```

Add the hosted runbook note in `docs/development/hosted-release-runbook.md`:

```md
### Hosted API owner-admin config

Required:

- `KK_PRIMARY_ADMIN_USER_ID`

Why:

- Hosted admin access defaults to one owner Supabase user ID.
- Delegated `profiles.role = 'admin'` users remain supported, but the owner admin must be configured explicitly.
```

- [ ] **Step 4: Run tests and doc verification to verify they pass**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/server-admin-config.test.ts tests/unit/api-server-startup.test.ts
cmd /c npm run governance:agent-docs
cmd /c npm run check:encoding
```

Expected:

- the new config helper test passes
- the startup warning test passes
- agent-docs and encoding checks both pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/server-admin-config.ts apps/api/src/server.ts apps/api/.env.local.example docs/development/hosted-release-runbook.md tests/unit/server-admin-config.test.ts tests/unit/api-server-startup.test.ts
git commit -m "feat: wire owner admin server config"
```

### Task 4: Add The Google OAuth Launcher

**Files:**
- Create: `src/services/auth/googleAuth.ts`
- Test: `tests/unit/google-auth-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/google-auth-service.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildGoogleSignInRedirectUrl,
  startGoogleSignIn,
} from '../../src/services/auth/googleAuth.ts';

test('buildGoogleSignInRedirectUrl always points to /auth/callback', () => {
  assert.equal(
    buildGoogleSignInRedirectUrl('https://app.example.com'),
    'https://app.example.com/auth/callback',
  );
});

test('startGoogleSignIn launches Supabase OAuth with the Google provider and callback redirect', async () => {
  let capturedPayload: unknown;

  await startGoogleSignIn({
    auth: {
      signInWithOAuth: async (payload: unknown) => {
        capturedPayload = payload;
        return {
          data: {
            provider: 'google',
            url: 'https://accounts.google.com/o/oauth2/v2/auth',
          },
          error: null,
        };
      },
    },
  } as any, 'https://app.example.com');

  assert.deepEqual(capturedPayload, {
    provider: 'google',
    options: {
      redirectTo: 'https://app.example.com/auth/callback',
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });
});

test('startGoogleSignIn surfaces Supabase OAuth errors', async () => {
  await assert.rejects(
    () => startGoogleSignIn({
      auth: {
        signInWithOAuth: async () => ({
          data: {
            provider: 'google',
            url: null,
          },
          error: new Error('Google OAuth disabled'),
        }),
      },
    } as any, 'https://app.example.com'),
    /Google OAuth disabled/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/google-auth-service.test.ts
```

Expected: FAIL because `src/services/auth/googleAuth.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/services/auth/googleAuth.ts`:

```ts
import { resolveAuthRedirectOrigin } from '../../config/authRedirect.ts';
import { supabase } from '../../lib/supabase.ts';

type GoogleAuthClient = Pick<typeof supabase, 'auth'>;

export function buildGoogleSignInRedirectUrl(origin = resolveAuthRedirectOrigin()): string {
  return new URL('/auth/callback', origin).toString();
}

export async function startGoogleSignIn(
  client: GoogleAuthClient = supabase,
  origin = resolveAuthRedirectOrigin(),
): Promise<void> {
  const redirectTo = buildGoogleSignInRedirectUrl(origin);
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/google-auth-service.test.ts
```

Expected: PASS with redirect, payload-shape, and error-surfacing coverage all green.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth/googleAuth.ts tests/unit/google-auth-service.test.ts
git commit -m "feat: add google oauth launcher"
```

### Task 5: Update The Login Screen Hierarchy And Wire The New Google Action

**Files:**
- Modify: `src/components/auth/LoginScreen.tsx`
- Modify: `src/components/auth/LoginScreen.css`
- Create: `tests/unit/login-screen-auth-actions.test.ts`

- [ ] **Step 1: Write the failing source-contract test**

Create `tests/unit/login-screen-auth-actions.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const LOGIN_SCREEN_PATH = 'src/components/auth/LoginScreen.tsx';
const LOGIN_SCREEN_CSS_PATH = 'src/components/auth/LoginScreen.css';

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('LoginScreen stays parseable and exposes google plus compact auxiliary auth actions', () => {
  const source = readSource(LOGIN_SCREEN_PATH);
  const sourceFile = ts.createSourceFile(
    LOGIN_SCREEN_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  assert.deepEqual(sourceFile.parseDiagnostics, []);
  assert.match(source, /import \{ startGoogleSignIn \} from '\.\.\/\.\.\/services\/auth\/googleAuth\.ts';/);
  assert.match(source, /const handleGoogleLogin = async \(\) => \{/);
  assert.match(source, /Continue with Google/);
  assert.match(source, /className="auth-aux-actions"/);
  assert.match(source, /Temporary account/);
  assert.match(source, /Admin sign-in/);
  assert.match(source, /Sign in with an administrator account first\./);
  assert.match(source, /Current account is not an administrator\./);
});

test('LoginScreen styles keep temporary and admin entry points compact and grouped', () => {
  const source = readSource(LOGIN_SCREEN_CSS_PATH);

  assert.match(source, /\.auth-aux-actions \{/);
  assert.match(source, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(source, /\.auth-btn-compact \{/);
  assert.match(source, /min-height:\s*40px;/);
  assert.match(source, /font-size:\s*13px;/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/login-screen-auth-actions.test.ts
```

Expected: FAIL because `LoginScreen.tsx` does not import `startGoogleSignIn`, does not render Google as a real auth button, and has no compact auxiliary row for temp/admin actions.

- [ ] **Step 3: Write the minimal implementation**

Update `src/components/auth/LoginScreen.tsx` imports and state:

```tsx
import { useAdminRole } from '../../hooks/useAdminRole';
import { startGoogleSignIn } from '../../services/auth/googleAuth.ts';

const LoginScreen: React.FC = () => {
  const { loginAsTempUser, user } = useAuth();
  const { isAdmin, checkingAdmin } = useAdminRole();
  const [googleLoading, setGoogleLoading] = useState(false);
```

Add the new handlers:

```tsx
const handleGoogleLogin = async () => {
  if (loading || googleLoading || wechatLoading) {
    return;
  }

  setError(null);
  setMessage(null);
  setGoogleLoading(true);

  try {
    await startGoogleSignIn();
  } catch (authError) {
    setError(resolveAuthErrorMessage(authError, 'login'));
    setGoogleLoading(false);
  }
};

const handleAdminEntry = () => {
  setError(null);
  setMessage(null);

  if (!user) {
    setError(t('请先使用管理员账号登录。', 'Sign in with an administrator account first.'));
    return;
  }

  if (checkingAdmin) {
    setMessage(t('正在识别管理员权限，请稍候。', 'Checking administrator access...'));
    return;
  }

  if (!isAdmin) {
    setError(t('当前账号没有管理员权限。', 'Current account is not an administrator.'));
    return;
  }

  window.location.href = '/settings/api-management';
};
```

Replace the current login-provider block in `src/components/auth/LoginScreen.tsx`:

```tsx
{view === 'login' && (
  <>
    <div className="auth-divider">
      <span>{t('或使用以下方式进入', 'Or continue with')}</span>
    </div>

    <button
      type="button"
      className="auth-btn auth-btn-ghost"
      onClick={handleWechatLogin}
      disabled={loading || wechatLoading || googleLoading}
    >
      <QrCode size={18} />
      {t('使用微信扫码登录', 'Continue with WeChat QR')}
    </button>

    <button
      type="button"
      className="auth-btn auth-btn-google"
      onClick={() => void handleGoogleLogin()}
      disabled={loading || googleLoading || wechatLoading}
    >
      {googleLoading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {t('跳转中...', 'Redirecting...')}
        </>
      ) : (
        <>{t('使用 Google 登录', 'Continue with Google')}</>
      )}
    </button>

    <div className="auth-aux-actions">
      <button
        type="button"
        className="auth-btn auth-btn-ghost auth-btn-compact"
        onClick={() => setShowTempUserWarning(true)}
        disabled={loading || googleLoading || wechatLoading}
      >
        {t('临时登录', 'Temporary account')}
      </button>
      <button
        type="button"
        className="auth-btn auth-btn-ghost auth-btn-compact"
        onClick={handleAdminEntry}
        disabled={checkingAdmin}
      >
        {t('管理员登录', 'Admin sign-in')}
      </button>
    </div>
  </>
)}
```

Add the compact styling to `src/components/auth/LoginScreen.css`:

```css
.auth-aux-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.auth-btn-compact {
  min-height: 40px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 14px;
}
```

- [ ] **Step 4: Run tests and typecheck to verify they pass**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/google-auth-service.test.ts tests/unit/login-screen-auth-actions.test.ts
cmd /c npm run typecheck
```

Expected:

- the new Google auth test passes
- the login-screen source-contract test passes
- `typecheck` passes with the new login-screen imports and state

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/LoginScreen.tsx src/components/auth/LoginScreen.css tests/unit/login-screen-auth-actions.test.ts
git commit -m "feat: add google sign-in and compact auxiliary auth actions"
```

### Task 6: Run The Full Focused Verification Sweep

**Files:**
- Modify: `src/components/auth/LoginScreen.tsx`
- Modify: `apps/api/src/modules/admin-console/application/admin-console-service.ts`
- Modify: `apps/api/src/server.ts`
- Test: `tests/unit/admin-console-primary-admin.test.ts`
- Test: `tests/unit/admin-console-routes.test.ts`
- Test: `tests/unit/server-admin-config.test.ts`
- Test: `tests/unit/api-server-startup.test.ts`
- Test: `tests/unit/google-auth-service.test.ts`
- Test: `tests/unit/login-screen-auth-actions.test.ts`

- [ ] **Step 1: Run the focused unit suites**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/admin-console-primary-admin.test.ts tests/unit/admin-console-routes.test.ts tests/unit/server-admin-config.test.ts tests/unit/api-server-startup.test.ts tests/unit/google-auth-service.test.ts tests/unit/login-screen-auth-actions.test.ts
```

Expected: PASS with all focused login/admin tests green.

- [ ] **Step 2: Run repository-wide type safety**

Run:

```bash
cmd /c npm run typecheck
```

Expected: PASS with no new TypeScript errors in admin-console, auth services, or login screen code.

- [ ] **Step 3: Run docs and encoding verification**

Run:

```bash
cmd /c npm run governance:agent-docs
cmd /c npm run check:encoding
```

Expected:

- `governance:agent-docs` passes because the new server-admin env is documented
- `check:encoding` passes with no new mojibake regressions

- [ ] **Step 4: Review the final diff before handing it back**

Run:

```bash
git diff --stat
git diff -- apps/api/src/modules/admin-console/application/admin-console-service.ts apps/api/src/server.ts src/components/auth/LoginScreen.tsx src/components/auth/LoginScreen.css src/services/auth/googleAuth.ts
```

Expected:

- diff stays limited to login/auth/admin files plus the two planned docs
- no unrelated churn appears in the final review set

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin-console/application/primary-admin-access.ts apps/api/src/modules/admin-console/application/admin-console-service.ts apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts apps/api/src/modules/admin-console/infrastructure/supabase-admin-console-repository.ts apps/api/src/lib/server-admin-config.ts apps/api/src/server.ts apps/api/.env.local.example docs/development/hosted-release-runbook.md src/services/auth/googleAuth.ts src/components/auth/LoginScreen.tsx src/components/auth/LoginScreen.css tests/unit/admin-console-primary-admin.test.ts tests/unit/admin-console-routes.test.ts tests/unit/server-admin-config.test.ts tests/unit/api-server-startup.test.ts tests/unit/google-auth-service.test.ts tests/unit/login-screen-auth-actions.test.ts
git commit -m "feat: tighten login entry points and owner admin access"
```
