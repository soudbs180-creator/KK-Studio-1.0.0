# VPS PostgreSQL Self-Hosted Runtime Design

**Goal**

Replace the current Supabase-centered hosted runtime with a fully self-hosted VPS runtime where:

- the frontend is served from the user's VPS
- `apps/api` becomes the canonical authentication, workspace, billing, and admin API
- `apps/payment-sidecar` remains the payment protocol adapter, but persists through PostgreSQL instead of Supabase
- PostgreSQL becomes the single production system of record
- password login, admin login, social login, canvas persistence, billing, and payment callbacks no longer depend on Supabase
- browser login persistence is upgraded to a 30-day server-managed session model

**Scope**

- Replace Supabase production persistence in:
  - `apps/api`
  - `apps/payment-sidecar`
  - the live frontend under `src/`
- Introduce a standard PostgreSQL schema for:
  - user identity
  - password credentials
  - user sessions
  - admin password/session state
  - user credits and credit ledger
  - workspace layouts and cloud-image metadata
  - payment orders and payment callbacks
  - temporary users
- Keep Google and WeChat login, but route both through `apps/api` instead of Supabase Auth
- Deploy the frontend, API, payment sidecar, and PostgreSQL to the user's VPS behind `nginx`

**Non-Goals**

- Rebuilding the product IA or the canvas UX
- Changing the payment provider product surface itself
- Replacing the current admin-password elevation model with a new permissions system
- Introducing a distributed or multi-node deployment topology
- Building a generic auth platform beyond the needs of KK Studio

**Current Problems**

- The VPS is online but effectively empty. It currently runs SSH only, so there is no deployed login backend at all.
- The current hosted and local release guidance assumes Supabase persistence and public Supabase configuration.
- The live frontend still contains Supabase startup assumptions in `src/main.tsx` and a public Supabase client in `src/lib/supabase.ts`.
- The current password login surface already prefers `apps/api`, but the broader runtime still treats Supabase as a normal hosted dependency.
- The current login persistence does not satisfy the required 30-day behavior:
  - backend login issues 1-hour access tokens
  - frontend stores only `accessToken`
  - refresh session persistence is not implemented as a durable server-managed browser session
- The existing `supabase/infrastructure/database/migrations/*.sql` files cannot be used as-is on a normal VPS PostgreSQL instance because they rely on Supabase-specific features such as `auth.users`, RLS, and `auth.uid()`.

**Approved Product Decisions**

1. The target deployment model is full VPS self-hosting.
2. PostgreSQL on the VPS is the single production database.
3. The desired migration path is the full replacement path, not a partial bridge.
4. The production runtime should eventually include:
   - password login
   - Google login
   - WeChat login
   - admin access
   - billing and payments
   - workspace persistence
5. The first validation environment may use `IP + HTTP` before a domain and HTTPS are added.

## Chosen Architecture

### Runtime ownership map

- `src/`: live frontend runtime until the `apps/web/` migration is completed separately
- `apps/api/`: canonical self-hosted business API and authentication runtime
- `apps/payment-sidecar/`: canonical payment protocol and callback runtime
- PostgreSQL: single production persistence layer
- `nginx`: public entrypoint for static frontend assets, API reverse proxying, and payment callback routing

### Public topology

- `nginx`
  - `/` -> built frontend static files
  - `/api/v1/*` -> `127.0.0.1:3001`
  - payment callback routes -> `127.0.0.1:8080`
- `apps/api`
  - listen on `127.0.0.1:3001`
- `apps/payment-sidecar`
  - listen on `127.0.0.1:8080`
- PostgreSQL
  - local service, not directly exposed publicly

### Service model

- `kk-api.service`
- `kk-payment-sidecar.service`
- `nginx.service`
- `postgresql.service`

This keeps the public edge small and avoids exposing raw Node or database ports to the internet.

## Data Model

### Identity and authentication tables

The new production identity system should no longer assume `auth.users`.

#### `profiles`

Primary application user identity table.

Required fields:

- `id uuid primary key`
- `email text unique not null`
- `nickname text null`
- `avatar_url text null`
- `role text not null default 'user'`
- `status text not null default 'active'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

This table remains the canonical source for user-facing account identity and delegated admin role.

#### `password_identities`

Dedicated password credential table.

Required fields:

- `user_id uuid primary key references profiles(id)`
- `password_hash text not null`
- `password_salt text not null`
- `password_changed_at timestamptz not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Password material is intentionally separated from `profiles`.

#### `user_sessions`

Durable refresh-session table that backs the required 30-day login persistence.

Required fields:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `refresh_token_hash text not null`
- `expires_at timestamptz not null`
- `rotated_from uuid null references user_sessions(id)`
- `revoked_at timestamptz null`
- `created_at timestamptz not null`
- `last_seen_at timestamptz null`
- `user_agent text null`
- `ip_address text null`

This table is the authoritative browser session store.

### Admin tables

#### `admin_auth`

Keep the existing concept, but store it in PostgreSQL as a standard table.

Purpose:

- elevated admin password hash
- requires-password-change flag

#### `admin_sessions`

Keep the existing elevated admin session concept.

Purpose:

- admin password verification session
- separate from ordinary user browser sessions

### Product data tables

Production PostgreSQL schema must cover the tables currently required by the application repositories:

- `temp_users`
- `user_credits`
- `credit_transactions`
- `admin_credit_models`
- `provider_pricing_cache`
- `workspace_layouts`
- `workspace_cloud_images`
- `payment_orders`
- `payment_callbacks`

Where the current code already has PostgreSQL repositories, the schema should match those repository expectations directly instead of cloning Supabase SQL mechanically.

## Authentication Design

### Password login

Password login remains centered in `apps/api`, not in the frontend and not in a third-party auth provider.

Flow:

1. Browser submits email/password to `POST /api/v1/auth/login`
2. `apps/api` verifies credentials against:
   - `profiles`
   - `password_identities`
3. API returns:
   - short-lived access token
   - refresh-session cookie
   - profile payload
4. Frontend hydrates runtime auth state from the API response

### Access token and session model

#### Access token

- 1 hour lifetime
- bearer token for API access
- verified by the existing KK session token mechanism

#### Refresh session

- 30 day lifetime
- stored server-side in `user_sessions`
- represented in the browser as an `HttpOnly` cookie
- rotated on refresh
- revoked on logout

This replaces the current incomplete model where only `accessToken` is stored durably.

### Session refresh flow

Add a server-managed refresh route:

- `POST /api/v1/auth/refresh`

Behavior:

- read refresh-session cookie
- verify matching active row in `user_sessions`
- rotate refresh token/session record
- issue a new access token
- re-set the refresh cookie

Frontend startup behavior:

- if no usable access token exists, attempt refresh automatically
- if refresh succeeds, restore the signed-in session
- if refresh fails, transition to signed-out state cleanly

### Logout flow

Add a server-managed logout route:

- `POST /api/v1/auth/logout`

Behavior:

- revoke matching `user_sessions` row
- clear refresh cookie
- clear in-browser runtime auth state

### Request authentication

The current `apps/api/src/lib/request-authenticator.ts` already proves that self-hosted KK access tokens are viable without Supabase JWT validation.

Chosen direction:

- keep KK access-token validation as the API bearer-token contract
- remove Supabase as a normal hosted prerequisite for request authentication
- preserve the fail-closed behavior for revoked or unknown sessions where a stateful lookup is available

## Admin Access Design

### Role model

Keep the existing admin identity semantics:

1. one primary admin identity
2. delegated admins through `profiles.role = 'admin'`
3. elevated admin password verification for dangerous actions

### Primary admin configuration

Keep:

- `KK_PRIMARY_ADMIN_USER_ID`

But resolve it against PostgreSQL-backed `profiles`, not Supabase-hosted identity assumptions.

### Elevated admin session model

Keep:

- `admin_auth`
- `admin_sessions`
- admin password verification flow

Reason:

- it already expresses the desired product boundary
- it is orthogonal to replacing Supabase

## Social Login Design

### High-level rule

Google and WeChat remain login providers, but they are no longer session providers.

`apps/api` owns:

- state generation
- provider redirect
- callback handling
- account creation or binding
- access-token issuance
- 30-day refresh-session issuance

### Google

Frontend entry stays on the login screen through the existing `kkWebApiClient` contract.

Backend flow:

1. `GET /api/v1/auth/google/start`
2. redirect to Google
3. `GET /api/v1/auth/google/callback`
4. resolve or create `profiles`
5. set refresh-session cookie
6. return to `/auth/callback`

### WeChat

Same pattern:

1. `GET /api/v1/auth/wechat/start`
2. redirect or QR auth flow
3. `GET /api/v1/auth/wechat/callback`
4. resolve or create `profiles`
5. set refresh-session cookie
6. return to `/auth/callback`

### Identity binding rule

The self-hosted auth system should treat Google/WeChat as linked identity providers for a canonical `profiles.id`, not as separate app users.

This keeps admin access, credits, workspaces, and payment history anchored to one internal user ID.

## Billing And Payment Design

### Main principle

`apps/api` owns business truth.
`apps/payment-sidecar` owns payment-provider protocol handling.
PostgreSQL owns persistence.

### Order and callback flow

1. Browser creates payment intent through `apps/api`
2. API validates user and credit configuration
3. API persists payment order in PostgreSQL
4. Payment sidecar generates provider-specific payment payload or URL
5. Provider callback hits `apps/payment-sidecar`
6. Sidecar verifies callback and stores callback data in PostgreSQL
7. Sidecar calls back into `apps/api` with internal auth
8. API writes final credit mutation into PostgreSQL

### Repository direction

`apps/payment-sidecar` should default to PostgreSQL-backed repositories and resolvers in production.

Supabase payment repositories and resolvers become legacy compatibility code paths instead of the normal hosted path.

## Workspace Persistence Design

### Layouts and cloud-image metadata

Workspace persistence should use PostgreSQL-backed repositories where available:

- `workspace_layouts`
- `workspace_cloud_images`

### Temporary users

`temp_users` should move to PostgreSQL for production durability.

Temporary-user login remains a secondary flow and never grants admin access.

## Frontend De-Supabase Design

### Required frontend behavior changes

The live frontend under `src/` must stop treating Supabase public config as a normal startup dependency.

Required changes:

- remove fatal or strongly-hosted startup assumptions tied to:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- convert auth bootstrap to VPS API session bootstrap
- preserve existing login UI, but route all real sign-in flows through `apps/api`

### Runtime auth source of truth

Frontend runtime auth should become:

1. in-memory runtime user state
2. short-lived access token
3. server-managed refresh-session cookie

Not:

1. Supabase browser session
2. Supabase startup env assumptions

### `src/lib/supabase.ts`

This module should stop being a required runtime dependency for normal production auth.

Target end-state:

- either fully remove it from the production auth path
- or reduce it to a compatibility shim that is not needed for the self-hosted VPS runtime

## Deployment Design

### VPS packages

Required:

- Node.js 24.x
- PostgreSQL
- nginx
- git

### Service directories

Suggested:

- `/opt/kk-studio/app`
- `/opt/kk-studio/config`
- `/opt/kk-studio/logs`

### Reverse proxy policy

- public traffic terminates at `nginx`
- Node services bind to loopback only
- PostgreSQL binds locally only unless remote admin access is explicitly needed

### Release sequence

1. provision VPS packages
2. initialize PostgreSQL schema
3. deploy backend code and environment
4. deploy frontend build
5. wire `nginx`
6. start systemd services
7. validate password login
8. validate admin flow
9. validate workspace persistence
10. validate payment flow
11. validate Google/WeChat callbacks after domain and HTTPS are available

## Phased Delivery Plan

### Phase 1: Core self-hosted runtime

Must deliver:

- PostgreSQL on VPS
- `apps/api` production boot without Supabase production persistence
- password login through PostgreSQL
- admin login through PostgreSQL
- 30-day refresh-session model
- workspace access behind real login
- frontend startup without Supabase public-config dependency

### Phase 2: Billing and payment production cutover

Must deliver:

- PostgreSQL-backed payment repositories
- callback persistence
- settlement writeback through main API
- credit account and ledger verification

### Phase 3: Social login production cutover

Must deliver:

- Google self-hosted OAuth callback flow
- WeChat self-hosted callback flow
- canonical account linking into `profiles`

### Phase 4: Hardening

Must deliver:

- domain cutover
- HTTPS
- secure cookies
- final CORS rules
- backup strategy
- operational runbook

## Risks And Constraints

### 1. Existing Supabase SQL is not portable as-is

Risk:

- the repository already contains Supabase-specific migrations and assumptions

Mitigation:

- create a new standard PostgreSQL bootstrap path tailored to the repository contracts
- do not attempt a raw migration replay against plain PostgreSQL

### 2. Social login is easier to validate with domain plus HTTPS

Risk:

- provider callback configuration may be awkward or partially blocked on bare IP

Mitigation:

- accept `IP + HTTP` only for early internal validation
- defer final Google/WeChat production acceptance until domain and HTTPS are present

### 3. Current repo still contains live Supabase-facing code

Risk:

- partial removal can leave the frontend or sidecar in a mixed runtime state

Mitigation:

- explicitly make PostgreSQL and VPS auth the default production path
- downgrade Supabase paths to compatibility-only status

### 4. User identity migration may require preserving existing local auth data

Risk:

- existing local password users currently live in file-backed identity storage such as `.kk-local/auth-identities.json`

Mitigation:

- add a controlled import/bootstrap step for existing password users where needed

## Verification Strategy

### Design-time acceptance

The self-hosted migration is considered correctly designed when:

- Supabase is no longer required for production login or persistence
- PostgreSQL is the single production database
- API bearer auth is backed by KK tokens plus PostgreSQL session state
- 30-day browser persistence is server-managed
- payment and workspace persistence both have a PostgreSQL production path

### Implementation-time acceptance

The first production-ready self-hosted cut is accepted when:

- a user must log in before reaching the workspace
- password login works against the VPS
- browser login survives reloads and restarts for up to 30 days unless revoked
- admin verification still works
- workspace data persists through PostgreSQL
- payment orders and callbacks persist through PostgreSQL
- the frontend no longer requires Supabase public env to boot

### Operational acceptance

The VPS deployment is accepted when:

- the frontend is reachable through `nginx`
- `/healthz` is healthy through the public entrypoint
- API and payment services survive reboot through systemd
- PostgreSQL is not publicly exposed

## Recommendation

Proceed with the full replacement plan, but sequence execution as:

1. production PostgreSQL foundation
2. password/admin/session cutover
3. frontend de-Supabase bootstrap
4. payment cutover
5. social-login cutover
6. domain and HTTPS hardening

This order gets the product onto the VPS fastest without forcing payment or OAuth complexity to block the core login-and-workspace recovery path.
