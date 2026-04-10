# Independent Admin Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate `apps/admin` admin-only application that runs on the user's VPS, reuses the existing KK-Studio API contracts, keeps system API settings server-owned, and leaves the current user-facing frontend unchanged except for an admin-login redirect entry.

**Architecture:** Add a second Vite/React frontend under `apps/admin` instead of burying admin pages inside the current app shell. Reuse the existing `/api/v1/auth/login`, `/api/v1/admin/access`, `/api/v1/admin/session/verify-password`, billing routes, and credit-provider routes, then fill the one missing backend gap by adding an admin credit-account lookup endpoint. Keep the browser side thin: the admin app stores only short-lived browser session tokens, never server secrets, and all privileged writes continue to flow through `apps/api`.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Node `node:test`, existing `apps/api`, `packages/contracts`, `packages/shared`, Supabase-backed repositories, Nginx on the VPS

---

## File Structure

- `package.json`
  - Add `admin:dev`, `admin:build`, and `admin:preview` scripts that target a separate Vite config under `apps/admin`.
- `apps/admin/index.html`
  - Minimal admin HTML shell with no remote scripts, no analytics, and no ad embeds.
- `apps/admin/vite.config.ts`
  - Standalone Vite config for the admin app.
- `apps/admin/tsconfig.json`
  - Admin app TypeScript config.
- `apps/admin/src/main.tsx`
  - Admin app bootstrap.
- `apps/admin/src/App.tsx`
  - Router entry for the admin app.
- `apps/admin/src/styles/admin.css`
  - First-party admin styles only.
- `apps/admin/src/config/adminRuntime.ts`
  - Resolve admin app base URL and API base URL from runtime environment.
- `apps/admin/src/services/adminBrowserSession.ts`
  - Store and validate admin browser session state.
- `apps/admin/src/services/adminApiClient.ts`
  - Create a KK API client configured for the admin app.
- `apps/admin/src/services/adminAuthFlow.ts`
  - Pure login and route-gate helpers that implement `user login -> admin access check -> admin password elevation`.
- `apps/admin/src/context/AdminAuthContext.tsx`
  - Admin session orchestration, sign-in, sign-out, and guard state.
- `apps/admin/src/components/layout/AdminShell.tsx`
  - Shared admin navigation shell.
- `apps/admin/src/routes/AdminRouter.tsx`
  - Route table for `/login`, `/`, `/exchange-rates`, `/providers`, and `/users/credits`.
- `apps/admin/src/routes/RequireAdminRoute.tsx`
  - Fail-closed route guard.
- `apps/admin/src/pages/AdminLoginPage.tsx`
  - Admin login screen.
- `apps/admin/src/pages/AdminDashboardPage.tsx`
  - Admin dashboard landing page.
- `apps/admin/src/features/exchange-rates/exchangeRatesModel.ts`
  - Pure data helpers for editable exchange-rate rows.
- `apps/admin/src/pages/ExchangeRatesPage.tsx`
  - Exchange-rate management UI.
- `apps/admin/src/features/providers/providerEditorModel.ts`
  - Provider editor normalization and dirty-state helpers.
- `apps/admin/src/pages/AdminProvidersPage.tsx`
  - System API and provider management UI.
- `packages/contracts/src/dto/billing.ts`
  - Add DTOs for admin credit-account lookup.
- `packages/contracts/src/client/kk-api-client.ts`
  - Add `getAdminCreditAccount` client method.
- `apps/api/src/modules/billing/application/credit-account-service.ts`
  - Add admin credit-account lookup service method.
- `apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts`
  - Extend repository contract for lookup by identity.
- `apps/api/src/modules/billing/infrastructure/file-backed-credit-account-repository.ts`
  - File-backed implementation of admin identity lookup.
- `apps/api/src/modules/billing/infrastructure/supabase-credit-account-repository.ts`
  - Reuse the existing `resolveUserByIdentity()` path and add account + transaction lookup.
- `apps/api/src/modules/billing/presentation/http-billing-routes.ts`
  - Add validation and handler for admin credit-account lookup.
- `apps/api/src/server.ts`
  - Register the new admin credit-account lookup route.
- `apps/admin/src/features/user-credits/userCreditLookupModel.ts`
  - Pure admin user-credit page helpers.
- `apps/admin/src/pages/UserCreditsPage.tsx`
  - User credit lookup + recharge UI.
- `src/services/admin/adminEntry.ts`
  - Main-frontend helper for building the admin login URL.
- `src/components/auth/LoginScreen.tsx`
  - Add the administrator redirect action without changing regular login behavior.
- `apps/admin/.env.example`
  - Document runtime env needed for the admin app.
- `deploy/nginx/kk-admin.conf`
  - Nginx config template for the VPS.
- `docs/deployment/admin-vps.md`
  - Operator deployment runbook for the admin app on the VPS.
- `tests/unit/admin-app-workspace.test.ts`
  - Build-surface and ad-free shell contract test.
- `tests/unit/admin-runtime-config.test.ts`
  - Runtime URL resolver test.
- `tests/unit/admin-browser-session.test.ts`
  - Browser session normalization and expiry test.
- `tests/unit/admin-auth-flow.test.ts`
  - Two-stage admin login helper test.
- `tests/unit/admin-exchange-rates.test.ts`
  - Exchange-rate model helper test.
- `tests/unit/admin-providers-page.test.ts`
  - Provider editor helper test.
- `tests/unit/admin-credit-lookup-contract.test.ts`
  - Admin credit-account lookup contract and route-validation test.
- `tests/unit/admin-user-credits-page.test.ts`
  - User-credit page helper test.
- `tests/unit/login-screen-admin-entry.test.ts`
  - Main login page redirect contract test.

### Task 1: Scaffold the admin build target and ad-free app shell

**Files:**
- Create: `apps/admin/index.html`
- Create: `apps/admin/vite.config.ts`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/App.tsx`
- Create: `apps/admin/src/styles/admin.css`
- Modify: `package.json`
- Test: `tests/unit/admin-app-workspace.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('package.json exposes admin scripts for the separate Vite target', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

  assert.equal(pkg.scripts['admin:dev'], 'vite --config apps/admin/vite.config.ts');
  assert.equal(pkg.scripts['admin:build'], 'vite build --config apps/admin/vite.config.ts');
  assert.equal(pkg.scripts['admin:preview'], 'vite preview --config apps/admin/vite.config.ts');
});

test('admin html shell is local-only and ad-free', () => {
  assert.equal(existsSync('apps/admin/index.html'), true);
  const html = readFileSync('apps/admin/index.html', 'utf8');

  assert.match(html, /<div id="root"><\\/div>/);
  assert.doesNotMatch(html, /https?:\\/\\//i);
  assert.doesNotMatch(html, /googletag|doubleclick|gtag|analytics|adservice/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/admin-app-workspace.test.ts"`
Expected: FAIL because the admin scripts and `apps/admin/index.html` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```json
// package.json
{
  "scripts": {
    "admin:dev": "vite --config apps/admin/vite.config.ts",
    "admin:build": "vite build --config apps/admin/vite.config.ts",
    "admin:preview": "vite preview --config apps/admin/vite.config.ts"
  }
}
```

```html
<!-- apps/admin/index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KK Studio Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```ts
// apps/admin/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4174,
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
```

```json
// apps/admin/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

```tsx
// apps/admin/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './styles/admin.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```tsx
// apps/admin/src/App.tsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <div className="admin-app-shell">KK Studio Admin bootstrap</div>
    </BrowserRouter>
  );
}
```

```css
/* apps/admin/src/styles/admin.css */
:root {
  color-scheme: light;
  font-family: "Segoe UI", sans-serif;
  background: #f3f6fb;
  color: #102038;
}

body {
  margin: 0;
  min-height: 100vh;
}

.admin-app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "tests/unit/admin-app-workspace.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json apps/admin/index.html apps/admin/vite.config.ts apps/admin/tsconfig.json apps/admin/src/main.tsx apps/admin/src/App.tsx apps/admin/src/styles/admin.css tests/unit/admin-app-workspace.test.ts
git commit -m "feat: scaffold standalone admin app shell"
```

### Task 2: Add admin runtime URL resolution and browser-session storage

**Files:**
- Create: `apps/admin/src/config/adminRuntime.ts`
- Create: `apps/admin/src/services/adminBrowserSession.ts`
- Test: `tests/unit/admin-runtime-config.test.ts`
- Test: `tests/unit/admin-browser-session.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolveAdminApiBaseUrl,
  resolveAdminAppBaseUrl,
} from '../../apps/admin/src/config/adminRuntime.ts';
import {
  isAdminBrowserSessionExpired,
  normalizeAdminBrowserSession,
} from '../../apps/admin/src/services/adminBrowserSession.ts';

test('resolveAdminAppBaseUrl trims trailing slashes and falls back to current origin', () => {
  assert.equal(
    resolveAdminAppBaseUrl({
      configuredAdminUrl: 'https://admin.example.com///',
      runtimeOrigin: 'http://127.0.0.1:4174',
    }),
    'https://admin.example.com',
  );

  assert.equal(
    resolveAdminAppBaseUrl({
      configuredAdminUrl: '',
      runtimeOrigin: 'http://127.0.0.1:4174',
    }),
    'http://127.0.0.1:4174',
  );
});

test('resolveAdminApiBaseUrl defaults to same-origin api when no explicit api base is configured', () => {
  assert.equal(
    resolveAdminApiBaseUrl({
      configuredApiUrl: '',
      adminAppBaseUrl: 'https://admin.example.com',
    }),
    'https://admin.example.com',
  );
});

test('normalizeAdminBrowserSession rejects empty tokens and strips unrelated secret fields', () => {
  assert.equal(
    normalizeAdminBrowserSession({ accessToken: '', adminSessionToken: 'x' }),
    null,
  );

  assert.deepEqual(
    normalizeAdminBrowserSession({
      accessToken: 'user-token',
      adminSessionToken: 'admin-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      adminSessionExpiresAt: '2099-01-01T01:00:00.000Z',
      serviceRoleKey: 'should-not-survive',
    }),
    {
      accessToken: 'user-token',
      adminSessionToken: 'admin-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      adminSessionExpiresAt: '2099-01-01T01:00:00.000Z',
    },
  );
});

test('isAdminBrowserSessionExpired fails closed on malformed or expired timestamps', () => {
  assert.equal(isAdminBrowserSessionExpired(undefined), true);
  assert.equal(isAdminBrowserSessionExpired('not-a-date'), true);
  assert.equal(isAdminBrowserSessionExpired('2000-01-01T00:00:00.000Z'), true);
  assert.equal(isAdminBrowserSessionExpired('2099-01-01T00:00:00.000Z'), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test "tests/unit/admin-runtime-config.test.ts" "tests/unit/admin-browser-session.test.ts"`
Expected: FAIL because neither helper file exists yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// apps/admin/src/config/adminRuntime.ts
function trimUrl(value: string | undefined): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function resolveAdminAppBaseUrl(input: {
  configuredAdminUrl?: string;
  runtimeOrigin?: string;
}): string {
  const configured = trimUrl(input.configuredAdminUrl);
  if (configured) {
    return configured;
  }

  const runtimeOrigin = trimUrl(input.runtimeOrigin);
  return runtimeOrigin || 'http://127.0.0.1:4174';
}

export function resolveAdminApiBaseUrl(input: {
  configuredApiUrl?: string;
  adminAppBaseUrl: string;
}): string {
  const configured = trimUrl(input.configuredApiUrl);
  return configured || trimUrl(input.adminAppBaseUrl);
}
```

```ts
// apps/admin/src/services/adminBrowserSession.ts
export interface AdminBrowserSession {
  accessToken: string;
  adminSessionToken: string;
  accessTokenExpiresAt: string;
  adminSessionExpiresAt: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
}

export function normalizeAdminBrowserSession(value: unknown): AdminBrowserSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const accessToken = String(candidate.accessToken || '').trim();
  const adminSessionToken = String(candidate.adminSessionToken || '').trim();
  const accessTokenExpiresAt = String(candidate.accessTokenExpiresAt || '').trim();
  const adminSessionExpiresAt = String(candidate.adminSessionExpiresAt || '').trim();

  if (!accessToken || !adminSessionToken || !accessTokenExpiresAt || !adminSessionExpiresAt) {
    return null;
  }

  return {
    accessToken,
    adminSessionToken,
    accessTokenExpiresAt,
    adminSessionExpiresAt,
    refreshToken: String(candidate.refreshToken || '').trim() || undefined,
    userId: String(candidate.userId || '').trim() || undefined,
    email: String(candidate.email || '').trim() || undefined,
  };
}

export function isAdminBrowserSessionExpired(expiresAt?: string): boolean {
  const normalized = String(expiresAt || '').trim();
  if (!normalized) {
    return true;
  }

  const expiresAtMs = Date.parse(normalized);
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= Date.now();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "tests/unit/admin-runtime-config.test.ts" "tests/unit/admin-browser-session.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/config/adminRuntime.ts apps/admin/src/services/adminBrowserSession.ts tests/unit/admin-runtime-config.test.ts tests/unit/admin-browser-session.test.ts
git commit -m "test: lock admin runtime and browser session helpers"
```

### Task 3: Implement the two-stage admin login flow and protected admin router

**Files:**
- Create: `apps/admin/src/services/adminApiClient.ts`
- Create: `apps/admin/src/services/adminAuthFlow.ts`
- Create: `apps/admin/src/context/AdminAuthContext.tsx`
- Create: `apps/admin/src/components/layout/AdminShell.tsx`
- Create: `apps/admin/src/routes/AdminRouter.tsx`
- Create: `apps/admin/src/routes/RequireAdminRoute.tsx`
- Create: `apps/admin/src/pages/AdminLoginPage.tsx`
- Create: `apps/admin/src/pages/AdminDashboardPage.tsx`
- Modify: `apps/admin/src/App.tsx`
- Test: `tests/unit/admin-auth-flow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canUseAdminRoute,
  performAdminLogin,
} from '../../apps/admin/src/services/adminAuthFlow.ts';

test('performAdminLogin requires a normal auth login, admin role, and elevated admin session', async () => {
  const result = await performAdminLogin(
    {
      email: 'admin@example.com',
      password: 'user-password',
      adminPassword: 'admin-password',
    },
    {
      client: {
        login: async () => ({
          success: true,
          data: {
            accessToken: 'user-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            profile: {
              id: 'user-1',
              email: 'admin@example.com',
              role: 'admin',
              status: 'active',
              createdAt: '2026-04-10T00:00:00.000Z',
              updatedAt: '2026-04-10T00:00:00.000Z',
            },
          },
        }),
        getAdminAccess: async () => ({
          success: true,
          data: {
            role: 'admin',
            isAdmin: true,
            adminSessionActive: false,
            requiresPasswordChange: false,
          },
        }),
        verifyAdminPassword: async () => ({
          success: true,
          data: {
            verified: true,
            adminSessionToken: 'admin-session-token',
            adminSessionExpiresAt: '2099-01-01T00:00:00.000Z',
          },
        }),
      } as any,
    },
  );

  assert.equal(result.accessToken, 'user-token');
  assert.equal(result.adminSessionToken, 'admin-session-token');
});

test('canUseAdminRoute fails closed when either session layer is missing', () => {
  assert.equal(canUseAdminRoute(null), false);
  assert.equal(
    canUseAdminRoute({
      accessToken: 'user-token',
      adminSessionToken: '',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      adminSessionExpiresAt: '2099-01-01T01:00:00.000Z',
    } as any),
    false,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/admin-auth-flow.test.ts"`
Expected: FAIL because the admin auth flow helper and route gate do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// apps/admin/src/services/adminApiClient.ts
import {
  createKkApiClient,
  type KkApiClient,
} from '../../../../packages/contracts/src/index.ts';
import { ADMIN_SESSION_TOKEN_HEADER } from '../../../../packages/shared/src/index.ts';

import { resolveAdminApiBaseUrl, resolveAdminAppBaseUrl } from '../config/adminRuntime';
import { normalizeAdminBrowserSession } from './adminBrowserSession';

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem('kk_admin_browser_session');
  if (!raw) {
    return null;
  }

  try {
    return normalizeAdminBrowserSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function createAdminApiClient(): KkApiClient {
  const adminAppBaseUrl = resolveAdminAppBaseUrl({
    configuredAdminUrl: import.meta.env.VITE_KK_ADMIN_URL,
    runtimeOrigin: window.location.origin,
  });
  const baseUrl = resolveAdminApiBaseUrl({
    configuredApiUrl: import.meta.env.VITE_KK_ADMIN_API_BASE_URL,
    adminAppBaseUrl,
  });

  return createKkApiClient({
    baseUrl,
    getAccessToken: () => readStoredSession()?.accessToken,
    getDefaultHeaders: () => ({
      [ADMIN_SESSION_TOKEN_HEADER]: readStoredSession()?.adminSessionToken,
    }),
    getClientVersion: () => 'kk-admin-web',
  });
}
```

```ts
// apps/admin/src/services/adminAuthFlow.ts
import type { KkApiClient } from '../../../../packages/contracts/src/index.ts';
import { isAdminBrowserSessionExpired, type AdminBrowserSession } from './adminBrowserSession';

export async function performAdminLogin(
  input: { email: string; password: string; adminPassword: string },
  deps: { client: KkApiClient },
): Promise<AdminBrowserSession> {
  const login = await deps.client.login({
    email: input.email.trim(),
    password: input.password,
  });
  if (!login.success) {
    throw new Error(login.error?.message || 'LOGIN_FAILED');
  }

  const access = await deps.client.getAdminAccess({
    accessToken: login.data.accessToken,
  });
  if (!access.success || access.data.isAdmin !== true) {
    throw new Error('ADMIN_FORBIDDEN');
  }

  const verified = await deps.client.verifyAdminPassword(
    { password: input.adminPassword },
    { accessToken: login.data.accessToken },
  );
  if (!verified.success) {
    throw new Error(verified.error?.message || 'ADMIN_PASSWORD_INVALID');
  }

  const accessTokenExpiresAt = new Date(Date.now() + login.data.expiresIn * 1000).toISOString();

  return {
    accessToken: login.data.accessToken,
    refreshToken: login.data.refreshToken,
    adminSessionToken: verified.data.adminSessionToken,
    accessTokenExpiresAt,
    adminSessionExpiresAt: verified.data.adminSessionExpiresAt,
    userId: login.data.profile.id,
    email: login.data.profile.email,
  };
}

export function canUseAdminRoute(session: AdminBrowserSession | null): boolean {
  if (!session) {
    return false;
  }

  return !isAdminBrowserSessionExpired(session.accessTokenExpiresAt)
    && !isAdminBrowserSessionExpired(session.adminSessionExpiresAt)
    && session.accessToken.length > 0
    && session.adminSessionToken.length > 0;
}
```

```tsx
// apps/admin/src/context/AdminAuthContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';

import { createAdminApiClient } from '../services/adminApiClient';
import { canUseAdminRoute, performAdminLogin } from '../services/adminAuthFlow';
import { normalizeAdminBrowserSession, type AdminBrowserSession } from '../services/adminBrowserSession';

const STORAGE_KEY = 'kk_admin_browser_session';
const client = createAdminApiClient();

function readInitialSession(): AdminBrowserSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeAdminBrowserSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

type AdminAuthContextValue = {
  session: AdminBrowserSession | null;
  isAuthorized: boolean;
  signIn: (input: { email: string; password: string; adminPassword: string }) => Promise<void>;
  signOut: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminBrowserSession | null>(() => readInitialSession());

  const value = useMemo<AdminAuthContextValue>(() => ({
    session,
    isAuthorized: canUseAdminRoute(session),
    signIn: async (input) => {
      const nextSession = await performAdminLogin(input, { client });
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    },
    signOut: () => {
      window.sessionStorage.removeItem(STORAGE_KEY);
      setSession(null);
    },
  }), [session]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('AdminAuthContext is missing');
  }

  return context;
}
```

```tsx
// apps/admin/src/routes/RequireAdminRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export function RequireAdminRoute() {
  const { isAuthorized } = useAdminAuth();
  return isAuthorized ? <Outlet /> : <Navigate to="/login" replace />;
}
```

```tsx
// apps/admin/src/components/layout/AdminShell.tsx
import { Link, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminShell() {
  const { signOut } = useAdminAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-shell__nav">
        <Link to="/">Dashboard</Link>
        <Link to="/exchange-rates">Exchange Rates</Link>
        <Link to="/providers">Providers</Link>
        <Link to="/users/credits">User Credits</Link>
        <button type="button" onClick={signOut}>Sign out</button>
      </aside>
      <main className="admin-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
```

```tsx
// apps/admin/src/pages/AdminLoginPage.tsx
import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLoginPage() {
  const { isAuthorized, signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isAuthorized) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await signIn({ email, password, adminPassword });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Admin login failed.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-login-card">
      <h1>KK Studio Admin</h1>
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
      <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
      <input value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Admin password" type="password" />
      {error ? <p>{error}</p> : null}
      <button type="submit">Sign in</button>
    </form>
  );
}
```

```tsx
// apps/admin/src/pages/AdminDashboardPage.tsx
export default function AdminDashboardPage() {
  return (
    <section>
      <h1>Admin Dashboard</h1>
      <p>Use the left navigation to manage exchange rates, providers, and user credits.</p>
    </section>
  );
}
```

```tsx
// apps/admin/src/routes/AdminRouter.tsx
import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminAuthProvider } from '../context/AdminAuthContext';
import AdminShell from '../components/layout/AdminShell';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import AdminLoginPage from '../pages/AdminLoginPage';
import { RequireAdminRoute } from './RequireAdminRoute';

export default function AdminRouter() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdminRoute />}>
          <Route element={<AdminShell />}>
            <Route path="/" element={<AdminDashboardPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}
```

```tsx
// apps/admin/src/App.tsx
import React from 'react';

import AdminRouter from './routes/AdminRouter';

export default function App() {
  return <AdminRouter />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "tests/unit/admin-auth-flow.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/services/adminApiClient.ts apps/admin/src/services/adminAuthFlow.ts apps/admin/src/context/AdminAuthContext.tsx apps/admin/src/components/layout/AdminShell.tsx apps/admin/src/routes/AdminRouter.tsx apps/admin/src/routes/RequireAdminRoute.tsx apps/admin/src/pages/AdminLoginPage.tsx apps/admin/src/pages/AdminDashboardPage.tsx apps/admin/src/App.tsx tests/unit/admin-auth-flow.test.ts
git commit -m "feat: add protected admin auth flow"
```

### Task 4: Build the exchange-rate management page on top of canonical billing routes

**Files:**
- Create: `apps/admin/src/features/exchange-rates/exchangeRatesModel.ts`
- Create: `apps/admin/src/pages/ExchangeRatesPage.tsx`
- Modify: `apps/admin/src/routes/AdminRouter.tsx`
- Test: `tests/unit/admin-exchange-rates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createEditableExchangeRateRows,
  toUpsertCreditExchangeRateInput,
} from '../../apps/admin/src/features/exchange-rates/exchangeRatesModel.ts';

test('createEditableExchangeRateRows sorts CNY before USD and keeps disabled rows visible', () => {
  const rows = createEditableExchangeRateRows([
    { currencyCode: 'USD', creditsPerUnit: 30, minAmount: 1, maxAmount: 100, isActive: true },
    { currencyCode: 'CNY', creditsPerUnit: 5, minAmount: 5, maxAmount: 500, isActive: false },
  ]);

  assert.equal(rows[0].currencyCode, 'CNY');
  assert.equal(rows[1].currencyCode, 'USD');
  assert.equal(rows[0].isActive, false);
});

test('toUpsertCreditExchangeRateInput returns the canonical request payload', () => {
  assert.deepEqual(
    toUpsertCreditExchangeRateInput({
      currencyCode: 'CNY',
      creditsPerUnit: 8,
      minAmount: 10,
      maxAmount: 300,
      isActive: true,
    }),
    {
      currencyCode: 'CNY',
      creditsPerUnit: 8,
      minAmount: 10,
      maxAmount: 300,
      isActive: true,
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/admin-exchange-rates.test.ts"`
Expected: FAIL because the exchange-rate model helper does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// apps/admin/src/features/exchange-rates/exchangeRatesModel.ts
import type { CreditExchangeRateDto, UpsertCreditExchangeRateRequestDto } from '../../../../packages/contracts/src/index.ts';

export function createEditableExchangeRateRows(rows: CreditExchangeRateDto[]) {
  return [...rows].sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));
}

export function toUpsertCreditExchangeRateInput(
  row: CreditExchangeRateDto,
): UpsertCreditExchangeRateRequestDto {
  return {
    currencyCode: row.currencyCode,
    creditsPerUnit: Number(row.creditsPerUnit),
    minAmount: row.minAmount,
    maxAmount: row.maxAmount,
    isActive: row.isActive,
  };
}
```

```tsx
// apps/admin/src/pages/ExchangeRatesPage.tsx
import { useEffect, useState } from 'react';

import type { CreditExchangeRateDto } from '../../../../packages/contracts/src/index.ts';
import { createAdminApiClient } from '../services/adminApiClient';
import { createEditableExchangeRateRows, toUpsertCreditExchangeRateInput } from '../features/exchange-rates/exchangeRatesModel';

const client = createAdminApiClient();

export default function ExchangeRatesPage() {
  const [rows, setRows] = useState<CreditExchangeRateDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client.listCreditExchangeRates().then((response) => {
      if (!response.success) {
        setError(response.error?.message || 'Failed to load exchange rates.');
        return;
      }
      setRows(createEditableExchangeRateRows(response.data.items));
    });
  }, []);

  async function handleSave(row: CreditExchangeRateDto) {
    const response = await client.upsertCreditExchangeRate(toUpsertCreditExchangeRateInput(row));
    if (!response.success) {
      setError(response.error?.message || 'Failed to save exchange rate.');
      return;
    }

    setRows((current) => current.map((candidate) => (
      candidate.currencyCode === response.data.currencyCode ? response.data : candidate
    )));
  }

  return (
    <section>
      <h1>Exchange Rates</h1>
      {error ? <p>{error}</p> : null}
      {rows.map((row) => (
        <article key={row.currencyCode}>
          <strong>{row.currencyCode}</strong>
          <span>{row.creditsPerUnit}</span>
          <button type="button" onClick={() => void handleSave(row)}>Save</button>
        </article>
      ))}
    </section>
  );
}
```

```tsx
// apps/admin/src/routes/AdminRouter.tsx
import ExchangeRatesPage from '../pages/ExchangeRatesPage';

// inside the protected AdminShell route block
<Route path="/exchange-rates" element={<ExchangeRatesPage />} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "tests/unit/admin-exchange-rates.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/exchange-rates/exchangeRatesModel.ts apps/admin/src/pages/ExchangeRatesPage.tsx apps/admin/src/routes/AdminRouter.tsx tests/unit/admin-exchange-rates.test.ts
git commit -m "feat: add admin exchange rate management page"
```

### Task 5: Build the system provider management page against existing admin provider routes

**Files:**
- Create: `apps/admin/src/features/providers/providerEditorModel.ts`
- Create: `apps/admin/src/pages/AdminProvidersPage.tsx`
- Modify: `apps/admin/src/routes/AdminRouter.tsx`
- Test: `tests/unit/admin-providers-page.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createProviderEditorState,
  mergePricingSnapshotTimestamp,
} from '../../apps/admin/src/features/providers/providerEditorModel.ts';

test('createProviderEditorState keeps editable provider fields without storing secret placeholders', () => {
  assert.deepEqual(
    createProviderEditorState({
      id: 'provider-1',
      label: 'System Route',
      baseUrl: 'https://example.com/v1',
      pricingCacheUpdatedAt: null,
    }),
    {
      id: 'provider-1',
      label: 'System Route',
      baseUrl: 'https://example.com/v1',
      pricingCacheUpdatedAt: null,
    },
  );
});

test('mergePricingSnapshotTimestamp keeps the latest non-empty timestamp', () => {
  assert.equal(
    mergePricingSnapshotTimestamp('2026-04-10T10:00:00.000Z', '2026-04-10T12:00:00.000Z'),
    '2026-04-10T12:00:00.000Z',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/admin-providers-page.test.ts"`
Expected: FAIL because the provider editor helper does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// apps/admin/src/features/providers/providerEditorModel.ts
export interface ProviderEditorState {
  id: string;
  label: string;
  baseUrl: string;
  pricingCacheUpdatedAt: string | null;
}

export function createProviderEditorState(input: ProviderEditorState): ProviderEditorState {
  return {
    id: input.id,
    label: input.label,
    baseUrl: input.baseUrl,
    pricingCacheUpdatedAt: input.pricingCacheUpdatedAt || null,
  };
}

export function mergePricingSnapshotTimestamp(
  current: string | null,
  incoming: string | null,
): string | null {
  if (!incoming) {
    return current;
  }
  if (!current) {
    return incoming;
  }
  return Date.parse(incoming) > Date.parse(current) ? incoming : current;
}
```

```tsx
// apps/admin/src/pages/AdminProvidersPage.tsx
import { useEffect, useState } from 'react';

import type { SaveAdminCreditProviderRequestDto } from '../../../../packages/contracts/src/index.ts';
import { createAdminApiClient } from '../services/adminApiClient';
import { createProviderEditorState, mergePricingSnapshotTimestamp, type ProviderEditorState } from '../features/providers/providerEditorModel';

const client = createAdminApiClient();

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<ProviderEditorState[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client.listAdminCreditProviders().then((response) => {
      if (!response.success) {
        setError(response.error?.message || 'Failed to load providers.');
        return;
      }

      setProviders(response.data.items.map((item) => createProviderEditorState({
        id: item.providerId,
        label: item.displayName,
        baseUrl: item.baseUrl,
        pricingCacheUpdatedAt: item.pricingCacheUpdatedAt || null,
      })));
    });
  }, []);

  async function handleSave(provider: ProviderEditorState) {
    const payload: SaveAdminCreditProviderRequestDto = {
      displayName: provider.label,
      baseUrl: provider.baseUrl,
      status: 'active',
      models: [],
    };

    const response = await client.saveAdminCreditProvider(provider.id, payload);
    if (!response.success) {
      setError(response.error?.message || 'Failed to save provider.');
      return;
    }

    setProviders((current) => current.map((candidate) => (
      candidate.id === provider.id
        ? {
            ...candidate,
            pricingCacheUpdatedAt: mergePricingSnapshotTimestamp(
              candidate.pricingCacheUpdatedAt,
              response.data.provider.pricingCacheUpdatedAt || null,
            ),
          }
        : candidate
    )));
  }

  return (
    <section>
      <h1>System Providers</h1>
      {error ? <p>{error}</p> : null}
      {providers.map((provider) => (
        <article key={provider.id}>
          <strong>{provider.label}</strong>
          <span>{provider.baseUrl}</span>
          <button type="button" onClick={() => void handleSave(provider)}>Save</button>
        </article>
      ))}
    </section>
  );
}
```

```tsx
// apps/admin/src/routes/AdminRouter.tsx
import AdminProvidersPage from '../pages/AdminProvidersPage';

// inside the protected AdminShell route block
<Route path="/providers" element={<AdminProvidersPage />} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "tests/unit/admin-providers-page.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/providers/providerEditorModel.ts apps/admin/src/pages/AdminProvidersPage.tsx apps/admin/src/routes/AdminRouter.tsx tests/unit/admin-providers-page.test.ts
git commit -m "feat: add admin provider management page"
```

### Task 6: Add the missing admin credit-account lookup contract and API route

**Files:**
- Modify: `packages/contracts/src/dto/billing.ts`
- Modify: `packages/contracts/src/client/kk-api-client.ts`
- Modify: `apps/api/src/modules/billing/application/credit-account-service.ts`
- Modify: `apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts`
- Modify: `apps/api/src/modules/billing/infrastructure/file-backed-credit-account-repository.ts`
- Modify: `apps/api/src/modules/billing/infrastructure/supabase-credit-account-repository.ts`
- Modify: `apps/api/src/modules/billing/presentation/http-billing-routes.ts`
- Modify: `apps/api/src/server.ts`
- Test: `tests/unit/admin-credit-lookup-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('billing dto exports the admin credit-account lookup response', () => {
  const source = readFileSync('packages/contracts/src/dto/billing.ts', 'utf8');

  assert.match(source, /export interface AdminCreditAccountLookupDto/);
  assert.match(source, /transactions: CreditTransactionDto\\[]/);
});

test('billing route source registers the admin credit-account lookup handler', () => {
  const routes = readFileSync('apps/api/src/modules/billing/presentation/http-billing-routes.ts', 'utf8');
  const server = readFileSync('apps/api/src/server.ts', 'utf8');

  assert.match(routes, /handleGetAdminCreditAccount/);
  assert.match(server, /\\/api\\/v1\\/admin\\/billing\\/accounts\\//);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/admin-credit-lookup-contract.test.ts"`
Expected: FAIL because the admin credit-account DTO and handler do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// packages/contracts/src/dto/billing.ts
export interface AdminCreditAccountLookupDto {
  identity: string;
  subjectId: EntityId;
  subjectEmail?: string;
  balance: number;
  frozenBalance: number;
  transactions: CreditTransactionDto[];
}
```

```ts
// packages/contracts/src/client/kk-api-client.ts
getAdminCreditAccount(
  identity: string,
  options?: ApiClientRequestOptions,
): Promise<ApiResponse<AdminCreditAccountLookupDto>>;

// inside the concrete client implementation
getAdminCreditAccount(identity, options) {
  return requestJson<AdminCreditAccountLookupDto>(
    config,
    'GET',
    `/api/v1/admin/billing/accounts/${encodeURIComponent(identity)}`,
    undefined,
    options,
  );
}
```

```ts
// apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts
import type { AdminCreditAccountLookupDto } from '../../../../../../packages/contracts/src/index.ts';

export interface CreditAccountRepository {
  // existing methods...
  adminGetAccountByIdentity(
    identity: string,
    limit?: number,
  ): Promise<AdminCreditAccountLookupDto>;
}
```

```ts
// apps/api/src/modules/billing/application/credit-account-service.ts
import type { AdminCreditAccountLookupDto } from '../../../../../../packages/contracts/src/index.ts';

async adminGetAccountByIdentity(
  identity: string,
  requestId: string,
  clientVersion?: string,
): Promise<ApiResponse<AdminCreditAccountLookupDto>> {
  const result = await this.repository.adminGetAccountByIdentity(identity, 50);

  return {
    success: true,
    data: result,
    meta: buildRequestMeta(requestId, clientVersion),
  };
}
```

```ts
// apps/api/src/modules/billing/infrastructure/supabase-credit-account-repository.ts
async adminGetAccountByIdentity(
  identity: string,
  limit = 50,
): Promise<AdminCreditAccountLookupDto> {
  const resolvedUser = await this.resolveUserByIdentity(String(identity || '').trim());
  if (!resolvedUser) {
    throw new Error('The requested credit account could not be resolved.');
  }

  const account = await this.getOrCreate(resolvedUser.subjectId);
  const transactions = await this.listTransactions(resolvedUser.subjectId, { limit });

  return {
    identity: String(identity || '').trim(),
    subjectId: resolvedUser.subjectId,
    subjectEmail: resolvedUser.email,
    balance: account.balance,
    frozenBalance: account.frozenBalance,
    transactions,
  };
}
```

```ts
// apps/api/src/modules/billing/presentation/http-billing-routes.ts
export async function handleGetAdminCreditAccount(
  service: CreditAccountService,
  identity: string,
  headers: Record<string, string>,
) {
  const requestId = headers['x-request-id'] || randomUUID();
  const clientVersion = headers['x-client-version'];
  const userId = resolveUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  if (!isAdminRequest(headers)) {
    return buildAdminForbiddenResult(requestId, clientVersion);
  }

  if (!hasElevatedAdminSession(headers)) {
    return buildAdminElevationRequiredResult(requestId, clientVersion);
  }

  return {
    statusCode: 200,
    body: await service.adminGetAccountByIdentity(identity, requestId, clientVersion),
  };
}
```

```ts
// apps/api/src/server.ts
const adminCreditAccountMatch = pathname.match(/^\/api\/v1\/admin\/billing\/accounts\/([^/]+)$/);
if (adminCreditAccountMatch && req.method === 'GET') {
  const result = await handleGetAdminCreditAccount(
    creditAccountService,
    decodeURIComponent(adminCreditAccountMatch[1]),
    requestHeaders,
  );
  writeJson(res, result.statusCode, result.body);
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "tests/unit/admin-credit-lookup-contract.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/dto/billing.ts packages/contracts/src/client/kk-api-client.ts apps/api/src/modules/billing/application/credit-account-service.ts apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts apps/api/src/modules/billing/infrastructure/file-backed-credit-account-repository.ts apps/api/src/modules/billing/infrastructure/supabase-credit-account-repository.ts apps/api/src/modules/billing/presentation/http-billing-routes.ts apps/api/src/server.ts tests/unit/admin-credit-lookup-contract.test.ts
git commit -m "feat: add admin credit account lookup api"
```

### Task 7: Build the admin user-credits page on top of the new lookup route and existing recharge route

**Files:**
- Create: `apps/admin/src/features/user-credits/userCreditLookupModel.ts`
- Create: `apps/admin/src/pages/UserCreditsPage.tsx`
- Modify: `apps/admin/src/routes/AdminRouter.tsx`
- Test: `tests/unit/admin-user-credits-page.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildAdminRechargeRequest,
  getLatestCreditBalance,
} from '../../apps/admin/src/features/user-credits/userCreditLookupModel.ts';

test('getLatestCreditBalance returns the canonical account balance from the lookup payload', () => {
  assert.equal(
    getLatestCreditBalance({
      identity: 'admin@example.com',
      subjectId: 'user-1',
      balance: 42,
      frozenBalance: 0,
      transactions: [],
    }),
    42,
  );
});

test('buildAdminRechargeRequest returns the existing admin recharge payload shape', () => {
  assert.deepEqual(
    buildAdminRechargeRequest({
      identity: 'admin@example.com',
      creditAmount: 15,
      description: 'Manual adjustment',
    }),
    {
      identity: 'admin@example.com',
      creditAmount: 15,
      description: 'Manual adjustment',
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/admin-user-credits-page.test.ts"`
Expected: FAIL because the user-credit helper does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// apps/admin/src/features/user-credits/userCreditLookupModel.ts
import type {
  AdminCreditAccountLookupDto,
  AdminRechargeCreditsRequestDto,
} from '../../../../packages/contracts/src/index.ts';

export function getLatestCreditBalance(payload: AdminCreditAccountLookupDto): number {
  return Number(payload.balance || 0);
}

export function buildAdminRechargeRequest(
  input: AdminRechargeCreditsRequestDto,
): AdminRechargeCreditsRequestDto {
  return {
    identity: input.identity.trim(),
    creditAmount: Number(input.creditAmount),
    description: input.description?.trim() || undefined,
  };
}
```

```tsx
// apps/admin/src/pages/UserCreditsPage.tsx
import { useState } from 'react';

import type { AdminCreditAccountLookupDto } from '../../../../packages/contracts/src/index.ts';
import { createAdminApiClient } from '../services/adminApiClient';
import { buildAdminRechargeRequest, getLatestCreditBalance } from '../features/user-credits/userCreditLookupModel';

const client = createAdminApiClient();

export default function UserCreditsPage() {
  const [identity, setIdentity] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState(10);
  const [account, setAccount] = useState<AdminCreditAccountLookupDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setError(null);
    const response = await client.getAdminCreditAccount(identity.trim());
    if (!response.success) {
      setError(response.error?.message || 'Failed to look up user credit account.');
      return;
    }

    setAccount(response.data);
  }

  async function handleRecharge() {
    setError(null);
    const response = await client.adminRechargeCredits(buildAdminRechargeRequest({
      identity,
      creditAmount: rechargeAmount,
      description: 'Admin manual recharge',
    }));
    if (!response.success) {
      setError(response.error?.message || 'Failed to recharge user credits.');
      return;
    }

    await handleLookup();
  }

  return (
    <section>
      <h1>User Credits</h1>
      <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="Email or user id" />
      <button type="button" onClick={() => void handleLookup()}>Lookup</button>
      {error ? <p>{error}</p> : null}
      {account ? (
        <div>
          <p>Balance: {getLatestCreditBalance(account)}</p>
          <button type="button" onClick={() => void handleRecharge()}>Recharge</button>
          {account.transactions.map((item) => (
            <article key={item.id}>
              <strong>{item.transactionType}</strong>
              <span>{item.amount}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
```

```tsx
// apps/admin/src/routes/AdminRouter.tsx
import UserCreditsPage from '../pages/UserCreditsPage';

// inside the protected AdminShell route block
<Route path="/users/credits" element={<UserCreditsPage />} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "tests/unit/admin-user-credits-page.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/user-credits/userCreditLookupModel.ts apps/admin/src/pages/UserCreditsPage.tsx apps/admin/src/routes/AdminRouter.tsx tests/unit/admin-user-credits-page.test.ts
git commit -m "feat: add admin user credit management page"
```

### Task 8: Add the main-frontend admin-login redirect and VPS deployment assets

**Files:**
- Create: `src/services/admin/adminEntry.ts`
- Create: `apps/admin/.env.example`
- Create: `deploy/nginx/kk-admin.conf`
- Create: `docs/deployment/admin-vps.md`
- Modify: `src/components/auth/LoginScreen.tsx`
- Test: `tests/unit/login-screen-admin-entry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildAdminLoginUrl } from '../../src/services/admin/adminEntry.ts';

test('buildAdminLoginUrl keeps the admin app external and lands on /login', () => {
  assert.equal(
    buildAdminLoginUrl({
      configuredBaseUrl: 'https://admin.example.com/',
      currentUrl: 'https://kk.example.com/login',
    }),
    'https://admin.example.com/login?from=https%3A%2F%2Fkk.example.com%2Flogin',
  );
});

test('LoginScreen source contains a dedicated administrator redirect button', () => {
  const source = readFileSync('src/components/auth/LoginScreen.tsx', 'utf8');

  assert.match(source, /buildAdminLoginUrl/);
  assert.match(source, /window\\.location\\.assign/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/unit/login-screen-admin-entry.test.ts"`
Expected: FAIL because the admin entry helper and LoginScreen redirect do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/services/admin/adminEntry.ts
export function buildAdminLoginUrl(input: {
  configuredBaseUrl?: string;
  currentUrl?: string;
}): string {
  const configuredBaseUrl = String(input.configuredBaseUrl || '').trim().replace(/\/+$/, '');
  if (!configuredBaseUrl) {
    throw new Error('VITE_KK_ADMIN_URL must be configured for the admin redirect.');
  }

  const target = new URL(`${configuredBaseUrl}/login`);
  if (input.currentUrl) {
    target.searchParams.set('from', input.currentUrl);
  }

  return target.toString();
}
```

```tsx
// src/components/auth/LoginScreen.tsx
import { buildAdminLoginUrl } from '../../services/admin/adminEntry';

// inside the component
function handleAdminRedirect() {
  const nextUrl = buildAdminLoginUrl({
    configuredBaseUrl: import.meta.env.VITE_KK_ADMIN_URL,
    currentUrl: window.location.href,
  });
  window.location.assign(nextUrl);
}

// inside the rendered actions
<button type="button" onClick={handleAdminRedirect}>
  Admin Login
</button>
```

```env
# apps/admin/.env.example
VITE_KK_ADMIN_URL=http://172.245.156.16
VITE_KK_ADMIN_API_BASE_URL=http://172.245.156.16
```

```nginx
# deploy/nginx/kk-admin.conf
server {
  listen 80;
  server_name _;

  root /var/www/kk-admin/dist;
  index index.html;

  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "same-origin" always;
  add_header Content-Security-Policy "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```md
<!-- docs/deployment/admin-vps.md -->
# KK Admin VPS Deployment

1. Create a non-root deployment user on the VPS and install Node 24 plus Nginx.
2. Build the admin app with `cmd /c npm run admin:build`.
3. Copy `apps/admin/dist` to `/var/www/kk-admin/dist`.
4. Run the API with `cmd /c npm run api:start`.
5. Install `deploy/nginx/kk-admin.conf` as the site config and reload Nginx.
6. Set `VITE_KK_ADMIN_URL` in the main frontend so the login page redirects to the VPS-hosted admin site.
7. After the site is reachable, add HTTPS and disable password-based root SSH login.
```

- [ ] **Step 4: Run the focused verification**

Run: `node --test "tests/unit/login-screen-admin-entry.test.ts"`
Expected: PASS

Run: `cmd /c npm run governance:agent-docs`
Expected: PASS because the new deployment doc does not desynchronize agent-doc rules.

Run: `cmd /c npm run check:encoding`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/admin/adminEntry.ts src/components/auth/LoginScreen.tsx apps/admin/.env.example deploy/nginx/kk-admin.conf docs/deployment/admin-vps.md tests/unit/login-screen-admin-entry.test.ts
git commit -m "feat: wire admin entry and vps deployment assets"
```

## Final Verification Bundle

After Task 8, run the full implementation verification before declaring the feature ready:

Run: `node --test "tests/unit/admin-app-workspace.test.ts" "tests/unit/admin-runtime-config.test.ts" "tests/unit/admin-browser-session.test.ts" "tests/unit/admin-auth-flow.test.ts" "tests/unit/admin-exchange-rates.test.ts" "tests/unit/admin-providers-page.test.ts" "tests/unit/admin-credit-lookup-contract.test.ts" "tests/unit/admin-user-credits-page.test.ts" "tests/unit/login-screen-admin-entry.test.ts"`
Expected: PASS

Run: `cmd /c npm run typecheck`
Expected: PASS

Run: `cmd /c npm run build`
Expected: PASS for the existing frontend

Run: `cmd /c npm run admin:build`
Expected: PASS for the new `apps/admin` frontend

Run: `cmd /c npm run architecture:check`
Expected: PASS

Run: `cmd /c npm run check:encoding`
Expected: PASS

## Self-Review

- Spec coverage:
  - Separate `apps/admin` project: Tasks 1 through 5.
  - Admin login split from the normal frontend: Tasks 3 and 8.
  - Exchange-rate management: Task 4.
  - System API / provider management: Task 5.
  - User credit lookup and adjustment: Tasks 6 and 7.
  - VPS deployment assets and security headers: Task 8.
  - No-ads and no remote-script shell: Task 1 plus the Nginx CSP in Task 8.
- Placeholder scan:
  - No placeholder markers remain in the plan.
- Type consistency:
  - The admin app consistently uses `AdminBrowserSession`, `AdminCreditAccountLookupDto`, and the existing `AdminRechargeCreditsRequestDto`.
