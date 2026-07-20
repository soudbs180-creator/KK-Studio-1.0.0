Status: historical

# API Client Boundary Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Wuyin catalog traffic through the typed KK API client and remove the unreferenced auth shim that targets a nonexistent endpoint.

**Architecture:** Add Wuyin DTOs to the shared model catalog, normalize the legacy server payload inside `KkApiClient`, and let `ApiSettingsView` consume only typed results. Delete only unreferenced local auth files; keep the active virtual session module unchanged.

**Tech Stack:** TypeScript, React, shared DTOs, `node:test`, Express runtime contracts.

## Global Constraints

- Follow `packages/shared -> packages/api-client -> apps/web -> tests -> docs`.
- Do not change server route behavior or authentication session behavior.
- Do not add a second API service or a parallel auth implementation.
- Use failing tests before runtime changes.
- Finish with Handoff, `agents:commit`, push, and a clean `main...origin/main` state.

---

### Task 1: Typed Wuyin catalog client

**Files:**
- Create: `tests/unit/wuyin-catalog-api-client-boundary.test.ts`
- Modify: `packages/shared/src/contracts/dto/model-catalog.ts`
- Modify: `packages/shared/src/contracts/client/kk-api-client.ts`
- Modify: `apps/web/src/services/llm/wuyinCatalog.ts`

**Interfaces:**
- Produces: `WuyinCatalogItemDto`, `WuyinCatalogResponseDto`, `KkApiClient.getWuyinCatalog`, and `KkApiClient.refreshWuyinCatalog`.

- [x] **Step 1: Write failing client behavior tests**

Use an injected fetch implementation to return the real legacy Wuyin payload. Assert GET/POST paths and normalized `{ items, source }` data.

- [x] **Step 2: Verify red**

Run the focused Node test. Expected: FAIL because the two client methods do not exist.

- [x] **Step 3: Add shared DTOs and client methods**

Define the catalog item and normalized response types, then implement both methods with strict payload validation and the standard client error envelope.

- [x] **Step 4: Verify green**

Run the focused test and shared typecheck. Expected: PASS.

### Task 2: Component boundary migration

**Files:**
- Modify: `apps/web/src/components/settings/ApiSettingsView.tsx`

**Interfaces:**
- Consumes: `kkWebApiClient.getWuyinCatalog()` and `kkWebApiClient.refreshWuyinCatalog()`.

- [x] **Step 1: Add a failing source-boundary assertion**

Assert the settings component invokes both typed methods and contains no direct Wuyin catalog `fetch`.

- [x] **Step 2: Replace direct HTTP parsing**

Use normalized client results for refresh, cache population, and initial fallback loading while preserving existing notifications and local cache behavior.

- [x] **Step 3: Verify component and type contracts**

Run the focused test, API settings contract tests, and root typecheck.

### Task 3: Invalid auth endpoint cleanup

**Files:**
- Delete: `apps/web/src/shims/authCreateReact.tsx`
- Delete: `apps/web/src/utils/useAuth.js`
- Modify: `tests/unit/wuyin-catalog-api-client-boundary.test.ts`

**Interfaces:**
- Preserves: the virtual `@auth/create/react` module used by legacy root/session files.
- Removes: the unreferenced local implementation of `/api/auth/signin/:provider`.

- [x] **Step 1: Add a failing active-source assertion**

Assert no active Web source file contains `/api/auth/signin` and both unreferenced local files are absent.

- [x] **Step 2: Verify red**

Run the focused test. Expected: FAIL on the existing shim and hook.

- [x] **Step 3: Delete only the dead local files**

Do not modify root virtual-module imports, `global.d.ts`, or current `AuthContext` behavior.

- [x] **Step 4: Verify green**

Run the focused test, root typecheck, and production build.

### Task 4: Documentation and synchronization

**Files:**
- Modify: `docs/api/typescript-client.md`
- Verify without expected edit: `docs/architecture/COMPATIBILITY_LAYER_REGISTRY.json`
- Modify: `docs/development/session-handoff.md`

- [x] **Step 1: Update the SDK method inventory**

Document the two new typed Wuyin methods and update the public method count from 73 to 75.

- [x] **Step 2: Verify compatibility registry state**

Confirm no deleted file is registered and the remaining compatibility surface passes governance.

- [x] **Step 3: Run full validation**

Run architecture, governance, typecheck, build, full tests, encoding, and diff checks.

- [x] **Step 4: Append Handoff, commit, and push**

Record fresh evidence, run `agents:commit`, push `main`, and confirm a clean synchronized worktree.

## Self-review

- The plan preserves server response behavior and active session behavior.
- Wuyin types have one shared owner.
- No placeholders or ambiguous deletion scope remain.
