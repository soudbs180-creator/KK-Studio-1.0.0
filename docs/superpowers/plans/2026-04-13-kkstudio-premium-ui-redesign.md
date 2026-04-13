# KK Studio Premium Dual-Theme Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge KK Studio settings onto one route-driven workbench shell, explicit API management stages, and a dual-theme token contract that keeps light and dark modes structurally identical.

**Architecture:** Keep `SettingsPanel.tsx` as the compatibility entry, but move all navigation and stage ownership into one localized router shell backed by a richer registry and API view-state contract. Add focused tests for settings entry, registry, API stage semantics, and theme tokens before updating the shell, API workbench, and CSS token layers.

**Tech Stack:** React 19, React Router, TypeScript, node:test, Vite, project CSS tokens in `src/index.css`

---

### Task 1: Lock the redesign contract with failing tests

**Files:**
- Modify: `tests/unit/settings-canonical-entry-regression.test.ts`
- Modify: `tests/unit/settings-registry-contract.test.ts`
- Modify: `tests/unit/settings-theme-contract.test.ts`
- Modify: `tests/unit/user-api-view-state.test.ts`
- Modify: `tests/unit/api-settings-workbench-structure.test.ts`
- Create: `tests/unit/settings-mobile-shell-premium-contract.test.ts`

- [ ] Add failing assertions for:
  - single settings entry ownership
  - registry-owned primary action and status metadata
  - shared theme token names for display and semantic status surfaces
  - explicit API workbench stage resolution
  - workbench-level status banner and primary action structure

- [ ] Run:

```bash
node --test "tests/unit/settings-canonical-entry-regression.test.ts" "tests/unit/settings-registry-contract.test.ts" "tests/unit/settings-theme-contract.test.ts" "tests/unit/user-api-view-state.test.ts" "tests/unit/api-settings-workbench-structure.test.ts" "tests/unit/settings-mobile-shell-premium-contract.test.ts"
```

Expected: FAIL before implementation.

### Task 2: Expand registry and shell contracts

**Files:**
- Modify: `src/components/settings/settingsRegistry.ts`
- Modify: `src/routes/settingsRoutes.tsx`
- Modify: `src/components/settings/SettingsPanel.localized.tsx`
- Modify: `src/App.tsx`

- [ ] Add registry metadata for primary actions, status summaries, and legacy aliases so shell and routes read one contract.
- [ ] Remove redundant mobile settings branching in `App.tsx` where the shell should own route decisions.
- [ ] Keep `SettingsPanel.tsx` as the compatibility export only.
- [ ] Update desktop and mobile shell behavior so the route model fully controls:
  - active view
  - back behavior
  - overview/home state
  - cross-entry initial routing

- [ ] Re-run the relevant node tests until green.

### Task 3: Promote API management from boolean flags to explicit stages

**Files:**
- Modify: `src/services/api/userApiViewState.ts`
- Modify: `src/components/settings/ApiSettingsView.tsx`
- Create: `src/components/settings/apiWorkbenchState.ts` if needed

- [ ] Replace the current boolean-only view-state contract with an explicit stage model that covers:
  - unauthenticated
  - local-api-unavailable
  - readonly-fallback
  - syncing
  - editable
  - diagnostics
- [ ] Surface stage-specific:
  - icon
  - headline
  - explanation
  - primary action
  - editor interactivity policy
- [ ] Ensure list, editor, and diagnostics responsibilities are visually separated instead of blended into one mixed page.

- [ ] Re-run:

```bash
node --test "tests/unit/user-api-view-state.test.ts" "tests/unit/api-settings-workbench-structure.test.ts"
```

Expected: PASS.

### Task 4: Tighten the premium dual-theme token contract

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/settings/SettingsScaffold.tsx`
- Modify: `src/components/settings/ui/index.tsx`
- Modify: `src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx`
- Modify: `src/components/settings/views/DashboardView.localized.tsx`

- [ ] Keep one typography, radius, and motion scale for both themes.
- [ ] Add or normalize semantic tokens for info, success, warning, and danger surfaces under the settings shell.
- [ ] Remove remaining literal component sizing that breaks parity or bypasses shared tokens.
- [ ] Reserve glass-heavy treatment for shell/navigation surfaces and keep dense content surfaces crisp.

- [ ] Re-run:

```bash
node --test "tests/unit/settings-theme-contract.test.ts" "tests/unit/dashboard-settings-overview-regression.test.ts" "tests/unit/settings-desktop-workbench-regression.test.ts"
```

Expected: PASS.

### Task 5: Record and verify the redesign baseline

**Files:**
- Modify: `docs/superpowers/specs/2026-04-13-kkstudio-premium-ui-redesign-design.md`
- Modify: `docs/superpowers/plans/2026-04-13-kkstudio-premium-ui-redesign.md`

- [ ] Run required verification:

```bash
npm run governance:agent-docs
npm run typecheck
npm run check:encoding
```

- [ ] If any verification fails, stop, fix, and rerun before claiming completion.
