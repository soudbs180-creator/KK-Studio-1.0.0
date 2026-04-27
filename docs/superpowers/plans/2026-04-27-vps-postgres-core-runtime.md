# VPS PostgreSQL Core Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Supabase-dependent production sign-in path with a VPS-hosted PostgreSQL auth/session runtime that requires real login before workspace access and keeps browser sessions alive for 30 days.

**Architecture:** Keep 1-hour KK bearer access tokens for API authorization, but move the durable browser login to a server-managed refresh-session cookie backed by PostgreSQL `user_sessions`. Frontend bootstrap restores auth through `/api/v1/auth/session` and `/api/v1/auth/refresh` instead of Supabase or durable browser tokens, while startup diagnostics switch from `Supabase canonical cloud ready` to `self-hosted core runtime ready`.

**Tech Stack:** TypeScript, React 19, Vite, Node HTTP server, PostgreSQL, `pg`, Node test runner

---

**Scope boundary:** This plan implements **Phase 1 only** from `docs/superpowers/specs/2026-04-27-vps-postgres-self-hosted-runtime-design.md`: password/admin auth, browser session persistence, hosted login gate, frontend bootstrap, and VPS bootstrap SQL. Payment ledger cutover and Google/WeChat callback cutover stay in later plans.

## File Structure

### Create

- `apps/api/src/modules/auth/domain/browser-session.ts`
  - Browser-session constants, cookie names/options, DTO-shaping helpers, and shared types for refresh-session rotation.
- `apps/api/src/modules/auth/application/browser-session-service.ts`
  - Issues, rotates, resolves, and revokes 30-day browser sessions backed by `user_sessions`.
- `apps/api/src/modules/auth/infrastructure/postgres-auth-identity-store.ts`
  - PostgreSQL-backed password/profile implementation for the existing `AuthIdentityStore` contract.
- `apps/api/src/modules/auth/infrastructure/postgres-user-session-repository.ts`
  - Raw SQL repository for `user_sessions`.
- `apps/api/src/modules/auth/presentation/http-session-routes.ts`
  - HTTP handlers for `GET /api/v1/auth/session`, `POST /api/v1/auth/refresh`, and `POST /api/v1/auth/logout`.
- `apps/api/sql/bootstrap-self-hosted-postgres.sql`
  - Phase 1 bootstrap SQL for `profiles`, `password_identities`, `user_sessions`, `admin_auth`, `admin_sessions`, `temp_users`, `workspace_layouts`, and `workspace_cloud_images`.
- `src/services/api/kkApiBaseUrl.ts`
  - Shared runtime base-URL/origin logic used by both the normal API client and the cookie-session bootstrap client.
- `src/services/auth/kkApiSessionBootstrap.ts`
  - Cookie-session bootstrap client that can restore, refresh, and logout without depending on the token-aware `kkWebApiClient`.
- `tests/unit/kk-api-client-session-cookie.test.ts`
  - Contract test for `credentials: "include"` and cookie-driven session calls.
- `tests/unit/kk-api-session-bootstrap.test.ts`
  - Frontend bootstrap, refresh, and logout flow tests using mocked fetch.
- `apps/api/src/modules/auth/application/browser-session-service.test.ts`
  - Rotation, reuse, and revocation tests for the 30-day browser session service.
- `apps/api/src/modules/auth/presentation/http-session-routes.test.ts`
  - Route-envelope tests for session, refresh, and logout cookie handling.

### Modify

- `packages/contracts/src/dto/auth.ts`
  - Make refresh-token response fields optional for browser-cookie mode and align auth session DTOs with Phase 1.
- `packages/contracts/src/client/kk-api-client.ts`
  - Ensure session endpoints send browser cookies and can retry through cookie refresh.
- `apps/api/src/modules/auth/application/auth-service.ts`
  - Prefer PostgreSQL identity storage when DB config is present and delegate durable browser sessions to `BrowserSessionService`.
- `apps/api/src/modules/auth/index.ts`
  - Export new browser-session domain, application, infrastructure, and presentation files.
- `apps/api/src/modules/auth/infrastructure/in-memory-auth-identity-store.ts`
  - Keep local-only compatibility, but make refresh token fields optional and keep password-code behavior aligned with the PostgreSQL store contract.
- `apps/api/src/modules/auth/infrastructure/file-auth-identity-store.ts`
  - Carry the same contract update as the in-memory store.
- `apps/api/src/modules/auth/presentation/http-auth-routes.ts`
  - Allow route handlers to return `Set-Cookie` headers on login and share success and error envelope helpers with session routes.
- `apps/api/src/lib/request-authenticator.ts`
  - Keep KK bearer-token verification, but prefer stateful profile resolution through the PostgreSQL identity store when available.
- `apps/api/src/server.ts`
  - Parse cookies, write multi-value headers, mount the new session routes, emit self-hosted core health fields, and add credential-aware CORS for explicit web origins.
- `src/services/api/authAccessToken.ts`
  - Stop treating browser storage as the long-term hosted session source of truth; restore and refresh through cookie-backed API bootstrap instead.
- `src/services/api/kkApiClient.ts`
  - Import the new shared base-URL helper and keep token-aware API calls separate from cookie bootstrap calls.
- `src/context/AuthContext.tsx`
  - Restore a hosted session from `/api/v1/auth/session`, call `/api/v1/auth/logout` on sign-out, and stop requiring a preexisting access token before session recovery starts.
- `src/services/auth/passwordSignIn.ts`
  - Treat login success as `access token + runtime profile + browser cookie already set by the server`.
- `src/pages/AuthCallback.tsx`
  - Fall back to cookie-session restoration so OAuth callback pages can still land in a valid runtime after later phases remove hash-token assumptions.
- `src/components/auth/LoginScreen.tsx`
  - Hide temporary local access when running against a hosted/VPS runtime so production always requires real sign-in.
- `src/main.tsx`
  - Remove fatal Supabase deployment hints and replace them with KK API and self-hosted session diagnostics.
- `src/lib/supabase.ts`
  - Downgrade to a compatibility shim that is not part of the normal production auth path.
- `src/context/AppStartupContext.tsx`
  - Treat self-hosted auth, session, and workspace readiness as the startup success criteria instead of `Supabase canonical cloud ready`.
- `src/services/api/kkApiServerHealth.ts`
  - Add `authSessions` and `selfHostedCoreReady` helpers so the frontend can distinguish `Phase 1 core ready` from `Phase 2 billing still pending`.
- `tests/unit/auth-access-token.test.ts`
  - Update storage and refresh expectations for cookie-backed hosted sessions.
- `tests/unit/password-sign-in-fallback.test.ts`
  - Update password sign-in expectations for hosted login without browser-held refresh tokens.
- `tests/unit/api-server-startup.test.ts`
  - Cover self-hosted Phase 1 readiness instead of Supabase-centric startup assumptions.
- `scripts/vps/kk-api.env.example`
  - Add cookie, CORS, and temp-user env knobs for VPS deployment.
- `.env.example`
  - Remove Supabase-required root guidance and point hosted frontend runtime at the VPS KK API flow.

## Task 1: Lock the Cookie-Session Client Contract

**Files:**
- Create: `tests/unit/kk-api-client-session-cookie.test.ts`
- Modify: `packages/contracts/src/dto/auth.ts`
- Modify: `packages/contracts/src/client/kk-api-client.ts`

- [ ] **Step 1: Write the failing client contract test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createKkApiClient } from '../../packages/contracts/src/client/kk-api-client.ts';

const profile = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'worker@example.com',
  nickname: 'worker',
  role: 'user',
  status: 'active',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

test('session endpoints include browser credentials and allow empty refresh bodies', async () => {
  const requests: Array<{
    url: string;
    credentials: RequestCredentials | undefined;
    method: string;
    body?: string;
  }> = [];

  const client = createKkApiClient({
    baseUrl: 'https://app.example.com/',
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        credentials: init?.credentials,
        method: String(init?.method || 'GET'),
        body: typeof init?.body === 'string' ? init.body : undefined,
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          accessToken: 'access-token-1',
          expiresIn: 3600,
          sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          profile,
        },
        meta: {
          requestId: 'req-session-cookie',
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    },
  });

  await client.getSession();
  await client.refreshSession({});
  await client.logout();

  assert.deepEqual(
    requests.map((request) => [request.method, request.credentials]),
    [
      ['GET', 'include'],
      ['POST', 'include'],
      ['POST', 'include'],
    ],
  );
  assert.equal(requests[1]?.body, JSON.stringify({}));
});
```

- [ ] **Step 2: Run the focused client contract test to confirm it fails**

Run: `node --test tests/unit/kk-api-client-session-cookie.test.ts`
Expected: FAIL because `requestJson(...)` does not currently set `credentials: "include"` and the session DTOs still assume a browser-visible refresh token.

- [ ] **Step 3: Update the auth DTOs for cookie-backed hosted sessions**

```ts
export interface LoginResponseDto {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  sessionExpiresAt?: string;
  profile: ProfileDto;
}

export type AuthSessionDto = LoginResponseDto;

export interface RefreshSessionRequestDto {
  refreshToken?: string;
}
```

- [ ] **Step 4: Make the shared API client send cookies on session routes**

```ts
const response = await fetchImpl(new URL(path, normalizeBaseUrl(config.baseUrl)), {
  ...init,
  headers,
  credentials: "include",
  signal: options?.signal,
});
```

- [ ] **Step 5: Re-run the focused client contract test**

Run: `node --test tests/unit/kk-api-client-session-cookie.test.ts`
Expected: PASS

## Task 2: Add PostgreSQL Identity and Browser-Session Persistence

**Files:**
- Create: `apps/api/src/modules/auth/domain/browser-session.ts`
- Create: `apps/api/src/modules/auth/application/browser-session-service.ts`
- Create: `apps/api/src/modules/auth/infrastructure/postgres-auth-identity-store.ts`
- Create: `apps/api/src/modules/auth/infrastructure/postgres-user-session-repository.ts`
- Create: `apps/api/src/modules/auth/application/browser-session-service.test.ts`
- Create: `apps/api/sql/bootstrap-self-hosted-postgres.sql`
- Modify: `apps/api/src/modules/auth/infrastructure/in-memory-auth-identity-store.ts`
- Modify: `apps/api/src/modules/auth/infrastructure/file-auth-identity-store.ts`
- Modify: `apps/api/src/modules/auth/index.ts`

- [ ] **Step 1: Write the failing browser-session service tests**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  BROWSER_SESSION_TTL_SECONDS,
  type BrowserSessionRecord,
} from '../domain/browser-session.ts';
import { BrowserSessionService } from './browser-session-service.ts';

class InMemoryBrowserSessionRepository {
  private readonly rows = new Map<string, BrowserSessionRecord>();

  async insert(record: BrowserSessionRecord): Promise<void> {
    this.rows.set(record.id, { ...record });
  }

  async findActiveByRefreshTokenHash(
    refreshTokenHash: string,
    nowIso: string,
  ): Promise<BrowserSessionRecord | undefined> {
    return Array.from(this.rows.values()).find((record) =>
      record.refreshTokenHash === refreshTokenHash
      && !record.revokedAt
      && record.expiresAt > nowIso,
    );
  }

  async revokeSession(id: string, revokedAt: string): Promise<void> {
    const current = this.rows.get(id);
    if (!current) return;
    this.rows.set(id, { ...current, revokedAt });
  }

  async replaceRotatedSession(
    currentId: string,
    nextRecord: BrowserSessionRecord,
    revokedAt: string,
  ): Promise<void> {
    await this.revokeSession(currentId, revokedAt);
    await this.insert(nextRecord);
  }
}

test('browser session rotation keeps 1h access tokens and 30d refresh sessions', async () => {
  const repository = new InMemoryBrowserSessionRepository();
  const service = new BrowserSessionService({
    repository,
    now: () => new Date('2026-04-27T00:00:00.000Z'),
    sessionSigningSecret: 'test-session-secret',
  });

  const issued = await service.issueSession({
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    role: 'user',
  }, {
    ip: '127.0.0.1',
    userAgent: 'node-test',
  });

  assert.equal(issued.expiresIn, ACCESS_TOKEN_TTL_SECONDS);
  assert.equal(BROWSER_SESSION_TTL_SECONDS, 30 * 24 * 60 * 60);
  assert.ok(issued.sessionExpiresAt);
  assert.ok(issued.setCookie[0]?.includes('HttpOnly'));
});

test('refresh-token reuse is rejected after rotation', async () => {
  const repository = new InMemoryBrowserSessionRepository();
  const service = new BrowserSessionService({
    repository,
    now: () => new Date('2026-04-27T00:00:00.000Z'),
    sessionSigningSecret: 'test-session-secret',
  });

  const issued = await service.issueSession({
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    role: 'user',
  }, {
    ip: '127.0.0.1',
    userAgent: 'node-test',
  });

  const rotated = await service.rotateSession(issued.rawRefreshToken, {
    ip: '127.0.0.1',
    userAgent: 'node-test',
  });

  assert.ok(rotated);
  await assert.rejects(
    () => service.rotateSession(issued.rawRefreshToken, {
      ip: '127.0.0.1',
      userAgent: 'node-test',
    }),
    /revoked|invalid|expired/i,
  );
});
```

- [ ] **Step 2: Run the browser-session service tests to confirm they fail**

Run: `node --test apps/api/src/modules/auth/application/browser-session-service.test.ts`
Expected: FAIL because the new browser-session domain and service files do not exist yet.

- [ ] **Step 3: Create the shared browser-session constants and service**

```ts
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const BROWSER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const DEFAULT_SESSION_COOKIE_NAME = 'kk_refresh_session';

export interface BrowserSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  rotatedFrom?: string;
  revokedAt?: string;
}
```

```ts
const accessToken = createKkSessionToken({
  tokenType: 'access',
  userId: profile.id,
  email: profile.email,
  role: profile.role,
  expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
});
```

- [ ] **Step 4: Add the PostgreSQL-backed auth identity store**

```ts
const result = await this.queryable.query(
  `select p.id, p.email, p.nickname, p.avatar_url, p.role, p.status,
          p.created_at, p.updated_at,
          i.password_salt, i.password_hash,
          i.password_change_code_salt, i.password_change_code_hash, i.password_change_code_expires_at
     from profiles p
     join password_identities i on i.user_id = p.id
    where lower(p.email) = lower($1)
    limit 1`,
  [normalizedEmail],
);
```

```ts
await this.queryable.query(
  `insert into profiles (
     id, email, nickname, avatar_url, role, status, user_apis, created_at, updated_at
   ) values (
     $1, $2, $3, $4, 'user', 'active', '[]'::jsonb, $5, $5
   )`,
  [userId, normalizedEmail, nickname, null, now],
);
```

- [ ] **Step 5: Add the PostgreSQL `user_sessions` repository**

```ts
await this.queryable.query(
  `insert into user_sessions (
     id, user_id, refresh_token_hash, expires_at, rotated_from, revoked_at,
     created_at, last_seen_at, user_agent, ip_address
   ) values (
     $1, $2, $3, $4, $5, null, $6, $6, $7, $8
   )`,
  [
    record.id,
    record.userId,
    record.refreshTokenHash,
    record.expiresAt,
    record.rotatedFrom || null,
    record.createdAt,
    record.userAgent || null,
    record.ipAddress || null,
  ],
);
```

- [ ] **Step 6: Write the Phase 1 PostgreSQL bootstrap SQL**

```sql
create table if not exists profiles (
  id uuid primary key,
  email text unique not null,
  nickname text,
  avatar_url text,
  role text not null default 'user',
  status text not null default 'active',
  user_apis jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists password_identities (
  user_id uuid primary key references profiles(id) on delete cascade,
  password_salt text not null,
  password_hash text not null,
  password_changed_at timestamptz not null default now(),
  password_change_code_salt text,
  password_change_code_hash text,
  password_change_code_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_sessions (
  id uuid primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  refresh_token_hash text not null unique,
  expires_at timestamptz not null,
  rotated_from uuid references user_sessions(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  user_agent text,
  ip_address text
);

create table if not exists admin_auth (
  id integer primary key check (id = 1),
  password_hash text not null,
  requires_password_change boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  id uuid primary key,
  admin_user_id uuid not null references profiles(id) on delete cascade,
  session_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists temp_users (
  id uuid primary key,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  is_active boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists workspace_layouts (
  user_id uuid primary key references profiles(id) on delete cascade,
  layout_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists workspace_cloud_images (
  id uuid primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 7: Re-run the new browser-session tests**

Run: `node --test apps/api/src/modules/auth/application/browser-session-service.test.ts`
Expected: PASS

## Task 3: Wire Login, Session, Refresh, Logout, Cookies, and Server Health

**Files:**
- Create: `apps/api/src/modules/auth/presentation/http-session-routes.ts`
- Create: `apps/api/src/modules/auth/presentation/http-session-routes.test.ts`
- Modify: `apps/api/src/modules/auth/application/auth-service.ts`
- Modify: `apps/api/src/modules/auth/presentation/http-auth-routes.ts`
- Modify: `apps/api/src/lib/request-authenticator.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/auth/index.ts`
- Modify: `tests/unit/api-server-startup.test.ts`

- [ ] **Step 1: Write failing route tests for cookie-backed login, session, and logout**

```ts
test('login sets a refresh-session cookie', async () => {
  const result = await handleVersionedLogin(service, {
    email: 'route-user@example.com',
    password: 'password-123',
  }, {
    'x-request-id': 'req-login-cookie',
  }, '127.0.0.1', 'node-test', {});

  assert.equal(result.statusCode, 200);
  assert.ok(Array.isArray(result.headers?.['set-cookie']));
  assert.match(String(result.headers?.['set-cookie']?.[0] || ''), /HttpOnly/);
});

test('logout clears the browser-session cookie', async () => {
  const result = await handleLogoutSession(service, {
    'x-request-id': 'req-logout-cookie',
  }, {
    kk_refresh_session: 'raw-cookie-value',
  });

  assert.equal(result.statusCode, 200);
  assert.match(String(result.headers?.['set-cookie']?.[0] || ''), /Max-Age=0/);
});
```

- [ ] **Step 2: Run the focused session-route tests and the startup regression**

Run: `node --test apps/api/src/modules/auth/presentation/http-session-routes.test.ts`
Expected: FAIL because the session route module and route headers do not exist yet.

Run: `node --test tests/unit/api-server-startup.test.ts`
Expected: FAIL once the test is updated to expect `authSessions` and self-hosted core health fields.

- [ ] **Step 3: Extend auth-service to issue browser sessions when PostgreSQL auth is active**

```ts
constructor(dependencies: AuthServiceDependencies) {
  this.identityStore = dependencies.identityStore || createDefaultIdentityStore();
  this.browserSessionService = dependencies.browserSessionService;
}

async login(input: LoginRequestDto, context: AuthRequestContext): Promise<AuthHandlerResult<LoginResponseDto>> {
  const session = this.identityStore.authenticatePassword(emailCheck.normalizedEmail, input.password);
  if (!session) {
    return this.unauthorized("Invalid email or password.");
  }

  const browserSession = this.browserSessionService
    ? await this.browserSessionService.issueSession(session.profile, {
      ip: context.ip,
      userAgent: context.userAgent,
    })
    : null;

  return this.success(200, {
    accessToken: browserSession?.accessToken || session.accessToken,
    refreshToken: session.refreshToken || undefined,
    expiresIn: browserSession?.expiresIn || session.expiresIn,
    sessionExpiresAt: browserSession?.sessionExpiresAt,
    profile: session.profile,
  }, {
    headers: browserSession ? { 'set-cookie': browserSession.setCookie } : undefined,
  });
}
```

- [ ] **Step 4: Let auth route handlers return extra headers**

```ts
interface HttpAuthRouteResult<T> {
  statusCode: number;
  body: ApiResponse<T>;
  headers?: Record<string, string | string[]>;
}
```

```ts
return buildSuccessEnvelope(
  requestId,
  clientVersion,
  result.statusCode,
  result.body.data as LoginResponseDto,
  result.headers,
);
```

- [ ] **Step 5: Add the dedicated session route handlers**

```ts
export async function handleGetSession(
  service: AuthService,
  headers: Record<string, string>,
  cookies: Record<string, string>,
  ip: string,
  userAgent: string,
): Promise<HttpAuthRouteResult<AuthSessionDto>> {
  const requestId = headers['x-request-id'] || randomUUID();
  const clientVersion = headers['x-client-version'];
  const result = await service.getSession(headers, cookies, {
    ip,
    userAgent,
  });

  return buildSuccessEnvelope(
    requestId,
    clientVersion,
    result.statusCode,
    result.body.data as AuthSessionDto,
    result.headers,
  );
}
```

- [ ] **Step 6: Add cookie parsing, multi-header writes, session routes, and explicit CORS**

```ts
function writeJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders: Record<string, string | string[]> = {},
) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}
```

```ts
if (req.method === 'OPTIONS') {
  res.writeHead(204, corsHeaders);
  res.end();
  return;
}

if (req.method === 'GET' && pathname === '/api/v1/auth/session') {
  const result = await handleGetSession(authService, requestHeaders, requestCookies, requestIp, requestUserAgent);
  writeJson(res, result.statusCode, result.body, result.headers);
  return;
}
```

```ts
persistence: {
  userApiKeys: criticalPersistence.authData.ready,
  keyManager: criticalPersistence.authData.ready,
  authData: criticalPersistence.authData.ready,
  authSessions: Boolean(browserSessionHealth.ready),
  tempUsers: criticalPersistence.guestSessions.ready,
  credits: criticalPersistence.billing.ready,
  creditProviders: criticalPersistence.creditProviders.ready,
  workspaceLayout: criticalPersistence.workspaceLayout.ready,
},
```

- [ ] **Step 7: Update the startup regression to assert Phase 1 self-hosted readiness**

```ts
assert.equal(healthPayload.data?.persistence?.authSessions, true);
assert.equal(healthPayload.data?.persistence?.workspaceLayout, true);
assert.equal(healthPayload.data?.repositories?.authData, 'postgres');
```

- [ ] **Step 8: Re-run the focused route and startup tests**

Run: `node --test apps/api/src/modules/auth/presentation/http-session-routes.test.ts`
Expected: PASS

Run: `node --test tests/unit/api-server-startup.test.ts`
Expected: PASS

## Task 4: Replace Frontend Session Bootstrap and Remove the Workspace Bypass

**Files:**
- Create: `src/services/api/kkApiBaseUrl.ts`
- Create: `src/services/auth/kkApiSessionBootstrap.ts`
- Create: `tests/unit/kk-api-session-bootstrap.test.ts`
- Modify: `src/services/api/kkApiClient.ts`
- Modify: `src/services/api/authAccessToken.ts`
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/services/auth/passwordSignIn.ts`
- Modify: `src/pages/AuthCallback.tsx`
- Modify: `src/components/auth/LoginScreen.tsx`
- Modify: `tests/unit/auth-access-token.test.ts`
- Modify: `tests/unit/password-sign-in-fallback.test.ts`

- [ ] **Step 1: Write the failing hosted session-bootstrap test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getLatestRuntimeAuthState } from '../../src/services/auth/runtimeAuthState.ts';
import { restoreHostedSessionFromServer } from '../../src/services/auth/kkApiSessionBootstrap.ts';

test('hosted startup restores a session from the server cookie even when no access token is cached', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true,
    data: {
      accessToken: 'restored-token',
      expiresIn: 3600,
      sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      profile: {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'restored@example.com',
        nickname: 'restored',
        role: 'user',
        status: 'active',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    },
    meta: {
      requestId: 'req-hosted-bootstrap',
      timestamp: new Date().toISOString(),
    },
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });

  const restored = await restoreHostedSessionFromServer();

  assert.equal(restored?.accessToken, 'restored-token');
  assert.equal(getLatestRuntimeAuthState().user?.email, 'restored@example.com');
});
```

- [ ] **Step 2: Run the hosted bootstrap test and the existing auth token test file**

Run: `node --test tests/unit/kk-api-session-bootstrap.test.ts`
Expected: FAIL because the bootstrap helper does not exist yet.

Run: `node --test tests/unit/auth-access-token.test.ts`
Expected: FAIL once the test is updated to expect cookie-driven hosted refresh instead of local durable persistence.

- [ ] **Step 3: Move shared base-URL and origin logic out of `kkApiClient.ts`**

```ts
export function resolveKkApiBaseUrl(): string {
  const configuredBaseUrl = readRuntimeEnv('VITE_KK_API_BASE_URL') || '';
  const runtimeOrigin = readRuntimeOrigin();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }
  if (runtimeOrigin) {
    return runtimeOrigin;
  }
  return 'http://127.0.0.1:3001';
}
```

- [ ] **Step 4: Add a pure cookie-session bootstrap client**

```ts
const cookieSessionClient = createKkApiClient({
  baseUrl: resolveKkApiBaseUrl(),
  getClientVersion: () => 'kk-web-cookie-bootstrap',
});

export async function fetchHostedSessionFromServer() {
  return cookieSessionClient.getSession();
}

export async function refreshHostedSessionFromServer() {
  return cookieSessionClient.refreshSession({});
}

export async function logoutHostedSessionFromServer() {
  return cookieSessionClient.logout();
}
```

- [ ] **Step 5: Make `authAccessToken.ts` refresh from the cookie-session API**

```ts
let hostedRefreshPromise: Promise<string | undefined> | null = null;

export async function refreshPreferredKkApiAccessToken(): Promise<string | undefined> {
  if (hostedRefreshPromise) {
    return hostedRefreshPromise;
  }

  hostedRefreshPromise = refreshHostedSessionFromServer()
    .then((response) => {
      if (!response.success) {
        setStoredKkApiAccessToken(undefined);
        return undefined;
      }

      setStoredKkApiAccessToken(response.data.accessToken);
      return response.data.accessToken;
    })
    .finally(() => {
      hostedRefreshPromise = null;
    });

  return hostedRefreshPromise;
}
```

- [ ] **Step 6: Let `AuthContext` bootstrap from the server even when no token is cached**

```tsx
useEffect(() => {
  if (runtimeState.isTempUser) {
    return;
  }

  let disposed = false;
  setSessionRecoveryLoading(true);

  void fetchHostedSessionFromServer().then((response) => {
    if (disposed) return;

    if (!response.success) {
      setSessionRecoveryLoading(false);
      setRuntimeState(clearPersistedRuntimeAuthState());
      return;
    }

    setStoredKkApiAccessToken(response.data.accessToken);
    const nextState = updateRuntimeAuthStateFromProfile(response.data.profile);
    setSessionRecoveryWarning(null);
    setSessionRecoveryLoading(false);
    setRuntimeState(nextState);
  });

  return () => {
    disposed = true;
  };
}, []);
```

- [ ] **Step 7: Make sign-out call the server and hide temporary local access in hosted mode**

```tsx
signOut: async () => {
  await logoutHostedSessionFromServer().catch(() => {});
  tempUserService.clearCachedTempUser();
  setStoredKkApiAccessToken(undefined);
  clearStoredAdminSession();
  setRuntimeState(clearPersistedRuntimeAuthState());
},
```

```tsx
const hostedRuntime = isHostedRuntime();

{!hostedRuntime ? (
  <button
    type="button"
    className="auth-btn auth-btn-ghost auth-btn-compact"
    onClick={() => void handleTempUserEntry()}
  >
    {t('Temporary local access', 'Temporary local access')}
  </button>
) : null}
```

- [ ] **Step 8: Let `AuthCallback` recover through the cookie session when hash tokens are absent**

```ts
if (!hydratedFromHash) {
  const response = await fetchHostedSessionFromServer();
  if (response.success) {
    setStoredKkApiAccessToken(response.data.accessToken);
    updateRuntimeAuthStateFromProfile(response.data.profile);
    emitAuthSessionChange({
      hasSession: true,
      userId: response.data.profile.id,
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      isTempUser: false,
    });
    finishWithRedirect('success', 'Session restored.', 1200);
    return;
  }
}
```

- [ ] **Step 9: Re-run the frontend session tests**

Run: `node --test tests/unit/kk-api-session-bootstrap.test.ts`
Expected: PASS

Run: `node --test tests/unit/auth-access-token.test.ts`
Expected: PASS

Run: `node --test tests/unit/password-sign-in-fallback.test.ts`
Expected: PASS

## Task 5: Remove Supabase Startup Assumptions and Reframe Health for Self-Hosted Phase 1

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/lib/supabase.ts`
- Modify: `src/context/AppStartupContext.tsx`
- Modify: `src/services/api/kkApiServerHealth.ts`
- Modify: `.env.example`
- Modify: `scripts/vps/kk-api.env.example`

- [ ] **Step 1: Add a failing health-helper test for `self-hosted core ready`**

```ts
test('self-hosted core readiness ignores missing phase-2 billing persistence', () => {
  assert.equal(isKkApiSelfHostedCoreReadyFromHealth({
    reachable: true,
    verified: true,
    status: 'degraded',
    repositories: {
      adminConsole: 'postgres',
      authData: 'postgres',
      creditAccounts: 'memory',
      creditProviders: 'memory',
      workspaceLayout: 'postgres',
    },
    persistence: {
      userApiKeys: true,
      keyManager: true,
      authData: true,
      authSessions: true,
      tempUsers: true,
      credits: false,
      creditProviders: false,
      workspaceLayout: true,
    },
  } as any), true);
});
```

- [ ] **Step 2: Run the startup-health helper test to confirm it fails**

Run: `node --test tests/unit/api-server-startup.test.ts`
Expected: FAIL because the frontend and server health helpers still equate startup success with Supabase or canonical billing readiness.

- [ ] **Step 3: Add a self-hosted core readiness helper**

```ts
export function isKkApiSelfHostedCoreReadyFromHealth(
  health: KkApiServerHealth | null | undefined,
): boolean {
  return Boolean(
    health
    && health.reachable
    && health.verified
    && health.repositories.adminConsole === 'postgres'
    && health.repositories.authData === 'postgres'
    && health.repositories.workspaceLayout === 'postgres'
    && health.persistence.authData
    && health.persistence.authSessions
    && health.persistence.tempUsers
    && health.persistence.workspaceLayout
  );
}
```

- [ ] **Step 4: Stop the startup banner from warning just because Phase 2 is not done yet**

```tsx
if (isKkApiSelfHostedCoreReadyFromHealth(health)) {
  setLastStartupWarning(null);
  return;
}

if (!health.reachable) {
  setLastStartupWarning(health.errorMessage || 'KK API server is unreachable.');
  return;
}
```

- [ ] **Step 5: Replace Supabase startup hints with KK API and session hints**

```tsx
function getDeploymentHints(): string[] {
  const hints: string[] = [];

  if (
    !import.meta.env.VITE_KK_API_BASE_URL
    && window.location.hostname !== '127.0.0.1'
    && window.location.hostname !== 'localhost'
  ) {
    hints.push(
      pickStartupText(
        'Missing `VITE_KK_API_BASE_URL` for hosted runtime.',
        'Missing `VITE_KK_API_BASE_URL` for hosted runtime.',
      ),
    );
  }

  return hints;
}
```

- [ ] **Step 6: Downgrade `src/lib/supabase.ts` to a compatibility shim**

```ts
export const hasSupabaseConfig = false;
export const isUsingBuiltinSupabaseConfig = false;
export const supabaseConfigIssue = 'Supabase runtime auth is disabled for the VPS self-hosted build.';

export const supabase = new Proxy({}, {
  get() {
    throw new Error('Supabase runtime access is disabled in the VPS self-hosted auth path.');
  },
});
```

- [ ] **Step 7: Update the env examples for VPS auth and session deployment**

```env
RUN_KK_API_SKELETON=true
PORT=3001
DATABASE_URL=postgres://kkstudio:CHANGE_ME@127.0.0.1:5432/kkstudio
KK_API_SESSION_SIGNING_SECRET=CHANGE_ME_LONG_RANDOM_SECRET
USER_API_ENCRYPTION_SECRET=CHANGE_ME_LONG_RANDOM_SECRET
KK_PRIMARY_ADMIN_USER_ID=11111111-1111-1111-1111-111111111111
KK_ALLOWED_WEB_ORIGINS=http://127.0.0.1:3000,https://app.example.com
KK_SESSION_COOKIE_NAME=kk_refresh_session
KK_SESSION_COOKIE_SECURE=false
KK_SESSION_COOKIE_SAME_SITE=lax
KK_TEMP_USER_MODE=local-only
```

- [ ] **Step 8: Re-run the startup regression**

Run: `node --test tests/unit/api-server-startup.test.ts`
Expected: PASS

## Task 6: Apply the VPS Bootstrap and Run Full Repository Verification

**Files:**
- Verify current change set only

- [ ] **Step 1: Apply the Phase 1 PostgreSQL bootstrap on the VPS**

Run:

```bash
psql "$DATABASE_URL" -f apps/api/sql/bootstrap-self-hosted-postgres.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, or `NOTICE: relation already exists, skipping`

- [ ] **Step 2: Seed the primary admin profile so `KK_PRIMARY_ADMIN_USER_ID` resolves**

Run:

```sql
insert into profiles (
  id, email, nickname, role, status, user_apis, created_at, updated_at
) values (
  '11111111-1111-1111-1111-111111111111',
  'admin@example.com',
  'admin',
  'admin',
  'active',
  '[]'::jsonb,
  now(),
  now()
)
on conflict (id) do update
  set email = excluded.email,
      nickname = excluded.nickname,
      role = excluded.role,
      status = excluded.status,
      updated_at = now();
```

Expected: `INSERT 0 1` or `INSERT 0 0`

- [ ] **Step 3: Start the API against PostgreSQL and confirm health**

Run:

```bash
npm run typecheck
node --test apps/api/src/modules/auth/application/browser-session-service.test.ts
node --test apps/api/src/modules/auth/presentation/http-session-routes.test.ts
node --test tests/unit/kk-api-client-session-cookie.test.ts
node --test tests/unit/kk-api-session-bootstrap.test.ts
node --test tests/unit/auth-access-token.test.ts
node --test tests/unit/password-sign-in-fallback.test.ts
node --test tests/unit/api-server-startup.test.ts
```

Expected: PASS on all focused test files

- [ ] **Step 4: Run repository-wide required verification**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run governance:agent-docs`
Expected: PASS

Run: `npm run check:encoding`
Expected: PASS

## Self-Review

- **Spec coverage check:** Phase 1 requirements from the approved spec are covered here:
  - PostgreSQL on VPS: Task 2 + Task 6
  - password login through PostgreSQL: Task 2 + Task 3
  - admin login through PostgreSQL: Task 2 + Task 6
  - 30-day refresh-session model: Task 2 + Task 3 + Task 4
  - workspace access behind real login: Task 4
  - frontend startup without Supabase public-config dependency: Task 5
- **Intentional exclusions:** payment ledger cutover, payment callback persistence, Google callback finalization, and WeChat callback finalization are not part of this plan.
- **Placeholder scan:** no `TODO`, `TBD`, or `implement later` placeholders are left in the tasks.
- **Type consistency check:** the plan consistently uses `AuthSessionDto` and `LoginResponseDto` with optional `refreshToken`, `sessionExpiresAt`, `authSessions`, and `isKkApiSelfHostedCoreReadyFromHealth`.
