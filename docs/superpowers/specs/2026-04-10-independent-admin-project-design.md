# Independent Admin Project Design

Date: 2026-04-10
Status: Draft for review
Owner: Codex

## Summary

This design introduces a separate administrator project for KK-Studio so operational controls no longer live inside the normal user-facing application. The current frontend remains the normal experience for regular users. A new `apps/admin` project will provide an administrator-only login, dashboard, credit pricing management, system API and provider management, and user credit management. The administrator project will be deployed to the user's VPS and will treat the server as the only source of truth for administrator settings and system secrets.

The new flow keeps regular user behavior stable: normal users continue to sign in and enter the existing frontend, while administrators use a dedicated login path that leads into the separate admin project. System-level API keys, provider settings, recharge exchange rates, and manual credit adjustments remain server-owned. The admin project must be ad-free, avoid unnecessary third-party scripts, and prioritize secure defaults at the authentication, session, deployment, and secret-handling layers.

## Problem Statement

The current KK-Studio repo already contains administrator, billing, API-management, and supplier-management capabilities, but they are not isolated enough for the desired operating model:

- Regular users and administrator controls still share too much frontend surface area.
- Sensitive system API settings need to remain server-only and inaccessible to standard users.
- The user wants a dedicated admin experience that lives on a separately deployed server project.
- Login needs an explicit split: regular login keeps going to the normal frontend, while administrator login must route into the dedicated admin project.
- The admin experience must not include ads, promotional widgets, or unrelated third-party integrations.

The goal is not to redesign the main app. The goal is to carve out a clear, secure operational boundary around administrator-only functions.

## Goals

- Create a separate `apps/admin` project inside the current repo.
- Keep the normal user-facing frontend behavior unchanged for standard users.
- Add an administrator login path that leads into the separate admin project.
- Deploy the admin project and its management API surface to the user's VPS.
- Treat server-side storage and server-side configuration as the source of truth for admin-managed data.
- Restrict admin-only pages and admin-only write actions to verified administrator sessions.
- Keep system API keys, admin-managed provider settings, and sensitive runtime secrets on the server only.
- Ship an admin UI with no ads, no external promotional content, and no unnecessary third-party scripts.
- Start with a focused first release: recharge exchange rates, system API/provider management, and user credit management.

## Non-Goals

- Replacing the normal user authentication flow in the main app.
- Migrating the entire frontend into a new framework or separate repository.
- Building a full enterprise back office with analytics, role hierarchies, or multi-tenant org management in the first wave.
- Allowing the admin frontend to write directly to the database without going through server-side API enforcement.
- Exposing system-level API secrets to the browser or to normal users.

## Current Context

The existing repo already has the pieces needed to support this design:

- Billing data and write paths already flow through `apps/api`.
- Recharge exchange rates already exist as canonical server-managed data.
- User credit balances and credit transactions already exist as canonical server-managed data.
- Provider pricing and admin credit model data already have server-side storage and route surfaces.
- The repo already distinguishes between user-editable API metadata and server-owned system routing and system-secret boundaries.

This design reuses those contracts instead of creating a second, disconnected admin stack.

## Chosen Approach

Use a separate admin frontend project inside the same monorepo, backed by the existing API server and existing canonical data models.

### Product shape

- Normal users continue using the current frontend.
- Administrators enter a dedicated admin login flow.
- The admin login leads to a standalone admin application deployed on the VPS.
- The standalone admin application exposes only administrator functions.

### Technical shape

- Add `apps/admin` for the new admin UI.
- Keep `apps/api` as the server-side authority for admin writes and privileged reads.
- Continue using existing shared DTO and utility packages.
- Keep canonical persistence in Supabase-backed server repositories.
- Deploy the admin frontend and admin-serving API runtime on the VPS.

This keeps the UX separate without duplicating the data model or authorization contracts.

## Architecture

The system is divided into three clear boundaries.

### 1. Main frontend

Responsibility:

- Normal user login and app access.
- Existing user workflows such as generation, chat, canvas, and normal account usage.
- Display of server-provided values where needed, such as current balance or active pricing results.

Constraints:

- No admin-only settings pages.
- No server-owned system secrets in the browser.
- No direct access to privileged admin write operations.

### 2. Admin frontend

Responsibility:

- Administrator login screen.
- Admin dashboard.
- Credit exchange-rate management.
- System API and provider management.
- User credit lookup and adjustment workflows.

Constraints:

- Must reject non-admin access.
- Must be ad-free and free of unnecessary third-party scripts.
- Must not hold server-only secrets directly in client code or browser storage.

### 3. Admin server layer

Responsibility:

- Authenticate and validate administrator sessions.
- Authorize admin-only routes and write actions.
- Read and update canonical billing, provider, and user-credit data.
- Keep system-owned secrets and runtime configuration on the server.

Constraints:

- Frontend is never trusted as the source of role truth.
- All privileged writes must require validated administrator context.
- Failure states must prefer rejection over accidental allow.

## Login And Routing Design

The main login page keeps the existing normal-user behavior and adds a separate administrator entry point.

### Normal user flow

1. User opens the current login page.
2. User uses the normal login action.
3. Existing user authentication completes.
4. User enters the normal frontend application.

### Administrator flow

1. Administrator opens the current login page.
2. Administrator clicks `管理员登录`.
3. Browser navigates to the admin project's login page.
4. Admin login is completed in the admin project.
5. Server validates the admin identity and session.
6. Administrator enters the admin dashboard.

### Important boundary rule

The main frontend login page only decides which experience to enter. It does not become the place where the admin UI actually runs. The admin project owns admin session state and admin route guarding.

### Guard behavior

- Unauthenticated admin requests redirect to the admin login page.
- Expired admin sessions redirect to the admin login page.
- Normal user sessions never count as admin authorization.
- Knowing the admin URL is not enough; the server must still validate the admin session.

## First-Release Admin Pages

The first release should stay focused on the smallest useful admin surface.

### Admin login

Purpose:

- Authenticate administrators.
- Establish a dedicated admin session.
- Deny all non-admin entry.

### Dashboard

Purpose:

- Surface the current operational state at a glance.

Initial content:

- Current recharge exchange rates.
- Current system provider configuration status.
- Recent user credit adjustments.
- Quick links to the three management sections.

### Exchange-rate management

Purpose:

- Manage recharge conversion rates such as `1 CNY = N credits` and `1 USD = N credits`.

Data source:

- Canonical server-managed recharge exchange-rate storage.

Capabilities:

- View active rates.
- Update `creditsPerUnit`.
- Update min and max recharge amounts.
- Enable or disable rates.

### System API / provider management

Purpose:

- Manage admin-owned provider and supplier configuration for system routes and managed credit-model operations.

Data source:

- Canonical server-managed provider and pricing data.

Capabilities:

- View provider status.
- Update provider base URLs and configuration metadata.
- Sync models.
- Sync pricing.
- Save admin-managed routing configuration.

Scope rule:

- This page manages system-owned configuration only.
- It does not become a place for ordinary users to edit their own API credentials.

### User credit management

Purpose:

- Inspect user credit state and perform controlled adjustments.

Data source:

- Canonical user credit balance and transaction ledgers.

Capabilities:

- Search by email or user identifier.
- View current balance.
- View recent credit transactions.
- Apply administrator recharge or credit grant with a reason.

The first release should support positive balance adjustments first. More advanced debit, freeze, or dispute workflows can follow later if needed.

## Data Ownership And Source Of Truth

This design depends on a strict source-of-truth model.

### Server-owned data

The following data must be treated as server-owned and admin-managed:

- Recharge exchange rates.
- System-owned provider configuration.
- System-managed API and supplier settings.
- Admin credit-model pricing and related system routing configuration.
- User credit balances.
- User credit transaction ledgers.

### User-owned data

User-editable API metadata can remain user-owned, but it must stay separate from admin-owned system configuration. User-facing editing does not grant access to system-level secrets or server-owned provider settings.

### Browser boundary

- Browsers may display server results.
- Browsers may submit admin intents.
- Browsers must not become the storage location for server-only secrets.
- Browsers must not directly own privileged billing or provider state.

## Security Requirements

Security is a first-class requirement for this project.

### Identity and session

- Every admin write requires a validated administrator session.
- Normal user authentication is not sufficient for admin routes.
- Admin sessions must be isolated from normal user frontend sessions.
- Expired sessions must fail closed and redirect to admin login.

### Secret handling

- System API keys remain on the server only.
- Admin frontend never receives Supabase service-role credentials.
- No browser local storage or frontend config file may persist server-owned secrets.
- Server-side routes remain the enforcement layer for privileged writes.

### Deployment hardening

- The VPS must not depend on long-term root password deployment as the operating model.
- A dedicated deployment user and hardened SSH posture are required before production rollout.
- HTTPS should be enabled once the first reachable admin deployment is stable.
- Reverse proxy configuration must expose only the intended admin surfaces.

### Failure handling

All failures must default toward denial or rollback rather than silent partial success:

- Failed admin auth leaves the operator at the admin login page.
- Failed admin writes do not show fake success states.
- Failed balance changes do not optimistically become authoritative without server confirmation.
- Failed provider or pricing sync does not overwrite last known server truth with guessed client state.

## No-Ads And Minimal-Dependency Rule

The admin project must remain a pure first-party control surface.

Required rules:

- No ad SDKs.
- No embedded promotions or recommendation widgets.
- No unnecessary third-party scripts.
- No third-party chat popups.
- No hidden affiliate or analytics injections outside explicitly approved operational tooling.
- No dependency added solely for decorative or growth-driven embedding.

Visual design may still be polished, but the admin product must remain operational, quiet, and distraction-free.

## Recommended Project Structure

Keep everything in the current monorepo and add the admin project as a new application:

- `apps/admin`
- `apps/api`
- `packages/contracts`
- `packages/shared`
- `supabase`

### Why this structure

- Shared DTOs and request contracts stay consistent.
- The admin app can reuse existing server APIs and shared auth semantics.
- The repo avoids drifting into duplicated billing or provider definitions.
- Deployment can still be independent even if development remains monorepo-based.

## Recommended Routes

The initial admin project should use a small, explicit route set:

- `/login`
- `/`
- `/exchange-rates`
- `/providers`
- `/users/credits`

Every route except `/login` requires a valid administrator session.

## Deployment Design

The admin project will be deployed to the user's VPS in two phases.

### Phase 1: bring-up on the VPS

Initial runtime:

- Admin frontend served from the VPS.
- Admin API runtime served from the VPS.
- Nginx reverse-proxies both surfaces.

Initial access can use either:

- server IP plus path, or
- server IP plus dedicated ports

The design should not embed passwords or machine credentials in repo docs or code.

### Phase 2: production-style access

After bring-up is stable:

- Move the admin site to a dedicated subdomain such as `admin.<domain>`.
- Enable HTTPS.
- Keep session, proxy, and route policies scoped cleanly to the admin surface.

## Implementation Phases

### Phase 1: admin app skeleton

- Create `apps/admin`.
- Add routing and admin route guard.
- Add admin login screen and placeholder dashboard.

### Phase 2: admin authentication integration

- Connect admin login to server validation.
- Establish dedicated admin session handling.
- Enforce redirect-on-expiry behavior.

### Phase 3: first-release management surfaces

- Exchange-rate management page.
- System API / provider management page.
- User credit management page.

### Phase 4: VPS deployment

- Deploy the admin app and required API runtime to the VPS.
- Add reverse proxy configuration.
- Confirm reachability and admin-only access behavior.

### Phase 5: main frontend entry-point update

- Add `管理员登录` on the main login page.
- Route administrators into the separate admin project.
- Leave normal user login unchanged.

## Risks And Mitigations

### Risk: user-facing frontend accidentally keeps admin capability

Mitigation:

- Remove admin-only management from the normal frontend path.
- Treat the admin project as the sole admin UI.

### Risk: server secrets leak into browser code

Mitigation:

- Keep all privileged keys and system secrets server-side only.
- Audit browser storage and client config boundaries before rollout.

### Risk: admin route appears reachable without real admin authority

Mitigation:

- Require validated administrator session server-side on every privileged route.
- Fail closed on missing or expired auth state.

### Risk: bring-up on the VPS uses unsafe operational defaults

Mitigation:

- Harden SSH posture before production rollout.
- Use dedicated deployment users and process managers.
- Move to HTTPS after the first stable admin deployment.

## Acceptance Criteria

The first release is complete when all of the following are true:

- The main login page includes an explicit `管理员登录` entry point.
- Normal users still log in and enter the current frontend as before.
- Administrators can enter the separate admin project.
- Non-admin users cannot access admin pages or admin write endpoints.
- The admin project contains login, dashboard, exchange-rate management, provider management, and user credit management.
- Recharge exchange-rate edits update server-managed values and become visible to consumers through canonical reads.
- User credit adjustments update both current balance and transaction history correctly.
- System API and provider settings are managed through server-owned admin flows rather than user-facing frontend storage.
- The admin frontend contains no ads, promotions, or unapproved third-party embeds.
- The admin project runs successfully from the VPS deployment target.

## Open Follow-Up Work After First Release

These are intentionally deferred until the isolated admin foundation is working:

- Richer audit log browsing.
- Advanced admin model management surfaces.
- Expanded recharge and payment operations.
- Multi-admin role segmentation.
- Subdomain and hardened HTTPS production polish if first release starts on raw VPS access.

## Self-Review

This spec intentionally stays focused on one implementation track: a separate admin project in the current repo, deployed to the VPS, with a dedicated admin login path and a narrow first-release surface. It does not leave placeholders for authentication ownership, data boundaries, ad policy, or deployment stance. The design assumes reuse of existing admin and billing server contracts rather than inventing a second backend.
