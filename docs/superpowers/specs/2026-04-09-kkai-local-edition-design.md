# KKAI Local Edition Design

**Goal**

Create a standalone local-only edition of the current product as `KKAI`, preserving the existing core workspace experience while removing login, credits, admin workflows, and cloud-backed user data. The resulting app should open directly into the working surface, save user API/provider/model settings locally, and use only local frontend plus local backend runtime paths.

**Scope**

- Build `KKAI` as a separate runnable software line rooted at `C:\Users\Administrator\Downloads\KKAI`.
- Preserve the current core frontend interaction model:
  - workspace shell
  - canvas
  - prompt flow
  - image generation flow
  - settings panel
  - local storage behavior
- Remove account-first and cloud-state behavior:
  - login screen
  - auth callback
  - temp-user flow
  - billing and credits
  - recharge and consumption records
  - admin console
  - cloud-backed user API fallback
  - cloud-backed workspace sync
- Make local API plus local file persistence the only source of truth for user API/provider/model settings.
- Do not keep any runtime fallback that reads or writes cloud-backed user, profile, or workspace state.

**Non-Goals**

- Rebuild the application from scratch.
- Redesign the UI or replace the current interaction model.
- Reintroduce browser-local plain-text API secret persistence.
- Keep feature parity with cloud/account/admin workflows that only exist to support hosted operation.

**Current Problems**

- The current startup chain is account-gated. `src/main.tsx` mounts `AuthProvider`, and `src/App.tsx` renders `LoginScreen` or `AuthCallback` before the main application shell.
- The current product mixes local and cloud truth for settings:
  - `src/components/settings/ApiSettingsView.tsx` switches to cloud-backed reads/writes when local API health is degraded.
  - `src/services/auth/keyManager.ts` still hydrates and syncs login-user state through cloud-oriented helpers.
  - `src/services/api/userApiProfileStorage.ts` and `src/services/api/userApiCloudRecordStorage.ts` still reconcile local API data with Supabase-backed profile records.
- The current local backend is not purely local for user settings:
  - `apps/api/src/modules/auth/infrastructure/file-auth-data-repository.ts` already supports local file persistence.
  - `apps/api/src/modules/auth/application/auth-data-service.ts` still reconciles and mirrors that data through `cloudMirror`.
  - `apps/api/src/server.ts` still wires `SupabaseUserScopedAuthDataMirror` when service-role config is absent but Supabase auth config exists.
- Health semantics still bias the frontend toward cloud branches. `src/services/api/kkApiServerHealth.ts` and `apps/api/src/server.ts` treat Supabase as the only fully healthy canonical persistence mode for user API state.
- The requested target path already exists as a separate project directory. Migration into `C:\Users\Administrator\Downloads\KKAI` must be treated as a controlled handoff, not a blind overwrite.
- The first deliverable must be a runnable standalone project in that directory, not only a staged branch inside the current repo.

**Approved Design**

1. `KKAI` is a separate local-only edition, not a runtime mode flag inside the existing product.
2. `KKAI` keeps the current workspace-centric UX and visual language wherever possible.
3. `KKAI` opens directly into the working application shell:
   - no login gate
   - no auth callback gate
   - no guest/temp-user gate
   - land on the normal workspace surface immediately
   - restore the most recent local workspace if present
   - otherwise create or open the default blank local workspace
4. `KKAI` uses a single fixed local profile model instead of cloud identities.
   - Existing profile-shaped settings flows may remain profile-based internally.
   - The effective runtime user becomes a local-only fixed user such as `local-user`.
   - This avoids a full rewrite of settings and routing contracts while removing remote identity dependencies.
   - This fixed local profile is an internal compatibility detail only and must not surface as login, account, or remote-user identity in the UI.
5. User API/provider/model settings use one canonical persistence path only:
   - frontend -> local API
   - local API -> local file repository
   - no frontend direct cloud writes
   - no backend cloud mirror
6. Browser storage may still hold non-secret UI state and short-lived UI-only display caches, but it must not become the secret-bearing source of truth or a second canonical settings store.
7. Local file persistence remains encrypted through `USER_API_ENCRYPTION_SECRET` when available, using the existing `FileBackedAuthDataRepository` path and payload structure.
8. Generation should use local API configuration, not credits or account entitlements.
9. Billing, admin, and hosted-only features are removed or fully hidden from `KKAI`.
10. Cloud workspace sync is removed from `KKAI`; canvas and related working data remain local-only.

**Architecture Decisions**

**1. Local Runtime Model**

- Frontend continues to run as a Vite app.
- Local backend continues to run as the local API server on port `3001`.
- The core runtime stays split as:
  - frontend on `3000`
  - local API on `3001`
- This preserves the current local development and packaging shape instead of inventing a new runtime model.

**2. Fixed Local Profile**

- Replace the current account identity dependency with a fixed local user identity.
- Keep profile-like API routes for compatibility:
  - `/api/v1/profile/user-apis`
  - `/api/v1/profile/user-apis/payload`
  - `/api/v1/profile/key-manager-state`
- Internally, these routes operate on one local profile record only.
- This preserves existing payload contracts across:
  - settings UI
  - key manager
  - secure API key helpers
  - local model routing
- The UI must not present this internal profile compatibility layer as a sign-in, session, account, or user owned by a remote service.

**3. Local Settings Source Of Truth**

- Canonical source: local API-backed file store.
- Required frontend behavior:
  - `ApiSettingsView` must stop using cloud-backed fallback and cloud-backed write mode.
  - `keyManager` must stop loading from and syncing to Supabase-backed user records.
  - `userApiProfileStorage` must stop reconciling local API entries with cloud records.
  - `userApiCloudRecordStorage` must either be removed from `KKAI` or converted into a local API-only shim so callers do not reach Supabase.
- Required backend behavior:
  - `AuthDataService` must not reconcile or push settings through `cloudMirror`.
  - `apps/api/src/server.ts` must not construct `SupabaseUserScopedAuthDataMirror` in `KKAI`.
  - local-file persistence must be reported as healthy and writable for user API state.

**4. Secret Handling**

- Do not regress to browser-local plain-text key storage.
- Preserve the current server-side-like behavior for local secrets:
  - secrets saved through local API
  - persisted in local file storage
  - encrypted when local encryption secret is configured
  - placeholder semantics still preserved for edit/toggle flows
- Existing placeholder reuse semantics must survive migration so edit/save operations do not accidentally wipe stored secrets.

**5. Feature Visibility In `KKAI`**

Remove from launch flow and runtime state paths:

- `LoginScreen`
- `AuthCallback`
- Supabase session handling UI
- temp-user flows
- balance display
- recharge modal
- consumption records
- admin console
- admin credit-provider management
- credit-based generation gating
- cloud sync status copy and cloud record read-only fallback copy
- workspace cloud layout sync and cloud image cleanup controls

If temporary UI hiding is used in an intermediate migration phase, that is not sufficient by itself. The final `KKAI` runtime must not execute cloud or account code paths for these features.

Preserve:

- workspace shell
- canvas rendering and editing
- prompt nodes and image nodes
- prompt bar
- local image/reference persistence
- API settings and provider management
- local model calling paths
- storage settings
- system logs only if they are reduced to local-runtime diagnostics and no longer report cloud or Supabase fallback state

**6. Compatibility Rules**

- Keep the existing slots/providers/entries payload model.
- Continue using provider/model normalization through `resolveEffectiveProviderModels()`.
- Continue using the current local-file auth-data payload format so migration cost stays low.
- Keep public method names stable where practical, even if implementations become local-only, to minimize blast radius in the first migration pass.

**Migration Strategy**

1. Stage `KKAI` as a separate software line instead of mutating the original repo in place.
2. The intended final output is a runnable standalone project rooted at `C:\Users\Administrator\Downloads\KKAI`.
3. Treat `C:\Users\Administrator\Downloads\KKAI` as an existing user-owned path.
   - Do not overwrite it blindly.
   - The implementation phase must either:
     - back it up first, or
     - stage into a safe sibling location and then swap after review.
4. Start from a copy of the current application structure rather than a fresh blank app.
5. Use phased subtraction:
   - Phase 1: runnable local skeleton
   - Phase 2: local settings truth
   - Phase 3: remove hosted-only UI and backend modules
   - Phase 4: finalize naming, startup, and packaging polish
6. Phase 1 does not rely on cloud migration. If legacy cloud-held settings ever need to be brought over, that must happen through an explicit offline import step rather than a runtime cloud dependency.

**Phase 1 Acceptance Criteria**

- `KKAI` starts without showing login, register, callback, or guest-entry screens.
- The app opens directly into the working surface.
- The launch target matches the normal local workspace experience:
  - restore the last local workspace when available
  - otherwise open a blank default local workspace
- API settings still allow add/edit/delete of official endpoints and third-party providers.
- Saved API/provider/model settings survive restart through local persistence.
- Generation can run through locally configured provider routes without requiring account state or credits.
- No direct frontend Supabase reads/writes remain in the settings path.
- Billing/admin/consumption entry points are absent or unreachable in `KKAI`.
- Local frontend and local backend can both start successfully in development.

**Primary File Boundaries To Address**

Startup and shell:

- `src/main.tsx`
- `src/App.tsx`
- `src/context/AuthContext.tsx`
- auth-only UI entry files and callbacks

Local settings truth:

- `src/components/settings/ApiSettingsView.tsx`
- `src/services/auth/keyManager.ts`
- `src/services/api/userApiProfileStorage.ts`
- `src/services/api/userApiCloudRecordStorage.ts`
- `src/services/api/kkApiServerHealth.ts`

Backend local persistence:

- `apps/api/src/server.ts`
- `apps/api/src/modules/auth/application/auth-data-service.ts`
- `apps/api/src/modules/auth/infrastructure/file-auth-data-repository.ts`

Hosted-only removals:

- billing-related frontend and backend modules
- admin-console frontend and backend modules
- wechat auth modules
- workspace cloud sync modules

**Risks**

- Existing logged-in user API data may only exist in Supabase-backed records today. If `KKAI` is cut over without an import path, those users will see empty local configuration.
- For the first local-only version, this is accepted unless an explicit offline import task is added later. `KKAI` must not depend on runtime cloud reads just to preserve old settings.
- Placeholder-secret flows must be preserved so toggling/saving providers does not overwrite stored secrets with blanks.
- The current data model is split across slots, providers, and entries. Partial migration of only one layer will create inconsistent behavior across settings, secure key helpers, and runtime routing.
- The existing `C:\Users\Administrator\Downloads\KKAI` directory means implementation must include a safe staging and handoff step.

**Verification**

- Write and review an implementation plan before code changes.
- During implementation, require at least:
  - `npm run typecheck`
  - `npm run check:encoding`
- If docs or agent guidance are updated, also run:
  - `npm run governance:agent-docs`
- Before declaring the first runnable `KKAI` phase complete, verify:
  - startup opens straight into workspace
  - settings save locally and restore after restart
  - generation works through local API configuration
  - login, credits, and admin entry points are gone
