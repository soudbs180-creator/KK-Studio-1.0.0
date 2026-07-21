# Stability Strangler Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize KK Studio before deeper refactoring, then reduce high-risk large modules through small behavior-preserving extraction phases.

**Architecture:** Keep the current runtime chain (`apps/web/`, `services/api/`, `packages/*`) intact. Each phase starts with a failing structural or behavioral contract, extracts one focused boundary, then proves the phase with targeted tests, `npm run typecheck`, and finally `npm run verify:changes` before moving to the next phase.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, Express backend, npm workspaces.

---

## Current Hard Gate

- Final acceptance command: `npm run verify:changes`
- Do not advance from one refactor phase to the next unless the phase-specific tests and `npm run typecheck` pass.
- Do not declare the full refactor complete unless a fresh `npm run verify:changes` exits with code `0`.

## Phase Order

1. Settings API workbench source reduction.
2. App root and settings/admin shell routing reduction.
3. Prompt composer and generation runtime boundary reduction.
4. Key manager storage/transport boundary reduction.
5. Chat sidebar assistant/runtime boundary reduction.
6. Final governance, documentation, and full verification.

---

### Task 1: Settings Snapshot Boundary

**Files:**
- Create: `apps/web/src/components/settings/apiUserApiViewSnapshot.ts`
- Modify: `apps/web/src/components/settings/ApiSettingsView.tsx`
- Modify: `tests/unit/api-settings-workbench-structure.test.ts`
- Modify: `tests/unit/api-settings-view-source-guard.test.ts`

- [x] **Step 1: Write the failing structure contract**

Add a source contract that requires `ApiSettingsView.tsx` to import `./apiUserApiViewSnapshot`, removes inline `USER_API_VIEW_SNAPSHOT_PREFIX` and snapshot function definitions from the view, and verifies the new module exports `UserApiViewSnapshot`, `readUserApiViewSnapshot`, `writeUserApiViewSnapshot`, and `clearUserApiViewSnapshot`.

Run: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-workbench-structure.test.ts`

Expected before implementation: FAIL because `apps/web/src/components/settings/apiUserApiViewSnapshot.ts` does not exist.

- [x] **Step 2: Extract snapshot persistence**

Move readonly user API snapshot persistence and readonly record normalization into `apiUserApiViewSnapshot.ts`. Keep existing `ApiSettingsView.tsx` call sites unchanged by importing `readUserApiViewSnapshot`, `writeUserApiViewSnapshot`, `clearUserApiViewSnapshot`, `toReadonlyOfficialSlot`, and `toReadonlyProvider`.

- [x] **Step 3: Update source guards**

Move localStorage assertions from `ApiSettingsView.tsx` to `apiUserApiViewSnapshot.ts` in `tests/unit/api-settings-view-source-guard.test.ts`, while keeping cloud-save effective-model assertions in `ApiSettingsView.tsx`.

- [x] **Step 4: Verify the phase slice**

Run: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-workbench-structure.test.ts tests/unit/api-settings-view-source-guard.test.ts`

Expected after implementation: PASS.

- [x] **Step 5: Verify type safety**

Run: `npm run typecheck`

Expected after implementation: PASS.

---

### Task 2: Settings Provider Preset Boundary

**Files:**
- Create: `apps/web/src/components/settings/apiProviderPresets.ts`
- Modify: `apps/web/src/components/settings/ApiSettingsView.tsx`
- Modify: `tests/unit/api-settings-workbench-structure.test.ts`
- Modify: `tests/unit/api-settings-view-source-guard.test.ts`

- [x] **Step 1: Write the failing structure contract**

Add a source contract requiring `ApiSettingsView.tsx` to import `PROVIDER_PRESETS`, `findProviderPresetForDraft`, `getProviderPresetLinks`, and `toProviderFormFromPreset` from `./apiProviderPresets`, and requiring `ApiSettingsView.tsx` not to define `interface ProviderPreset` or `const PROVIDER_PRESETS`.

Run: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-workbench-structure.test.ts`

Expected before implementation: FAIL because the module does not exist and provider preset definitions are still inline.

- [x] **Step 2: Extract preset definitions and helpers**

Move `ProviderPreset`, `PROVIDER_PRESETS`, `findProviderPresetForDraft`, `getProviderPresetLinks`, and `toProviderFormFromPreset` into `apiProviderPresets.ts`. Export the `ProviderPreset` type and keep the same object literals, URL values, labels, provider kinds, and default draft behavior.

- [x] **Step 3: Keep form construction stable**

Keep `ProviderForm` in `ApiSettingsView.tsx` unless the extraction can import it type-only without circular runtime imports. `apiProviderPresets.ts` should expose a typed draft factory that returns the same shape used by current provider editor state.

- [x] **Step 4: Verify the phase slice**

Run: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-workbench-structure.test.ts tests/unit/api-settings-view-source-guard.test.ts tests/unit/api-settings-simple-mode-contract.test.ts tests/unit/api-settings-provider-compact-ui-contract.test.ts`

Expected after implementation: PASS.

- [x] **Step 5: Verify type safety**

Run: `npm run typecheck`

Expected after implementation: PASS.

---

### Task 3: Settings Formatting Boundary

**Files:**
- Create: `apps/web/src/components/settings/apiSettingsFormatters.ts`
- Modify: `apps/web/src/components/settings/ApiSettingsView.tsx`
- Modify: `tests/unit/api-settings-workbench-structure.test.ts`

- [x] **Step 1: Write the failing structure contract**

Add a source contract requiring `ApiSettingsView.tsx` to import `formatUsd`, `formatTokens`, `formatDateTime`, `formatLatency`, `extractDomain`, `maskSecretDisplay`, `getModeLabel`, `getModeOption`, `parseModeOption`, `getProtocolLabel`, and `getOfficialProviderLabel` from `./apiSettingsFormatters`, and requiring those functions not to be declared inline in `ApiSettingsView.tsx`.

Run: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-workbench-structure.test.ts`

Expected before implementation: FAIL because formatting helpers are inline.

- [x] **Step 2: Extract pure formatting helpers**

Move only pure formatting helpers into `apiSettingsFormatters.ts`. Keep React state, service calls, editor save logic, and side effects inside `ApiSettingsView.tsx`.

- [x] **Step 3: Verify formatting contracts**

Run: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/api-settings-workbench-structure.test.ts tests/unit/api-settings-view-source-guard.test.ts tests/unit/api-settings-encoding-guard.test.ts`

Expected after implementation: PASS.

- [x] **Step 4: Verify type safety**

Run: `npm run typecheck`

Expected after implementation: PASS.

---

### Task 4: Phase 1 Full Gate

**Files:**
- Modify: `docs/development/session-handoff.md`
- Modify: `docs/superpowers/plans/2026-06-09-stability-strangler-refactor.md`

- [x] **Step 1: Run complete verification**

Run: `npm run verify:changes`

Expected: PASS with exit code `0`.

- [x] **Step 2: Record handoff**

Append a dated handoff entry with modified files, design decision, exact verification commands, remaining risks, and next phase.

- [x] **Step 3: Commit phase 1**

Run:

```bash
git add apps/web/src/components/settings tests/unit docs/superpowers/plans/2026-06-09-stability-strangler-refactor.md docs/development/session-handoff.md
git commit -m "refactor(settings): split API workbench boundaries"
```

Expected: commit succeeds on `codex/stability-strangler-refactor`.

---

### Task 5: App Root Routing Boundary

**Files:**
- Create: `apps/web/src/app/AppRootContentSwitch.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `tests/unit/app-startup-coordinator.test.ts`
- Modify: `tests/unit/settings-canonical-entry-regression.test.ts`
- Modify: `tests/unit/kkai-app-root.test.ts`

- [x] **Step 1: Write the failing structure contract**
 
Add a source contract requiring `App.tsx` to import `AppRootContentSwitch` and requiring `AppRootContentSwitch.tsx` to own `rootMode === 'admin'`, `<AdminLayout`, `rootMode === 'settings'`, and `<SettingsPageRoot`.
 
Run: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/app-startup-coordinator.test.ts tests/unit/settings-canonical-entry-regression.test.ts tests/unit/kkai-app-root.test.ts`
 
Expected before implementation: FAIL because the switch is inline in `App.tsx`.
 
- [x] **Step 2: Extract the switch**
 
Move only the root content selection into `AppRootContentSwitch.tsx`. Keep startup orchestration, providers, canvas runtime, and side effects in existing owner modules.
 
- [x] **Step 3: Verify app root contracts**
 
Run: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/app-startup-coordinator.test.ts tests/unit/settings-canonical-entry-regression.test.ts tests/unit/kkai-app-root.test.ts`
 
Expected after implementation: PASS.
 
- [x] **Step 4: Verify phase gate**
 
Run: `npm run typecheck`
 
Expected: PASS.
 
---
 
### Task 6: Final Verification and Handoff
 
**Files:**
- Modify: `docs/development/session-handoff.md`
- Modify: `docs/superpowers/plans/2026-06-09-stability-strangler-refactor.md`
 
- [x] **Step 1: Run complete verification**
 
Run: `npm run verify:changes`
 
Expected: PASS with exit code `0`.
 
- [x] **Step 2: Record final state**
 
Append a final handoff entry listing all touched files, all verification commands, residual risks, and next recommended phase.
 
- [x] **Step 3: Present branch finish options**
 
Use `superpowers:finishing-a-development-branch` before merge, PR, or cleanup decisions.
