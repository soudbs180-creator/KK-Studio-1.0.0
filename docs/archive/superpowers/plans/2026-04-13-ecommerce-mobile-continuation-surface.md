# Ecommerce Mobile Continuation Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the mobile result detail screen into a real ecommerce continuation surface that shows module intent and stage state, and lets operators edit a single module task, confirm desktop output, or trigger mobile output without leaving the current flow blind.

**Architecture:** Keep the current mobile navigation model intact and extend the existing `App -> MobileWorkspaceSurface -> MobileResultDetailScreen` chain. Reuse the existing ecommerce handlers and editable task state already owned by `App.tsx`, and enrich `MobileResultEntry` plus the mobile selectors so the detail screen can render module metadata and route the correct continuation action back into the existing desktop-capable logic.

**Tech Stack:** React 19, TypeScript, node:test, existing mobile shell components, ecommerce task state in `src/types.ts`

---

### Task 1: Lock the mobile continuation contract with failing tests

**Files:**
- Create: `tests/unit/mobile-ecommerce-continuation-surface.test.ts`
- Modify: `tests/unit/mobile-result-feed-detail-contract.test.ts`

- [ ] Write a failing source-contract test for the dedicated mobile continuation surface.
- [ ] Assert that `MobileResultDetailScreen.tsx` contains an ecommerce-specific stage/module region.
- [ ] Assert that the detail screen exposes semantic continuation entry points for:
  - edit task
  - confirm desktop
  - generate mobile
  - module selection / confirmation
- [ ] Assert that `MobileWorkspaceSurface.tsx` and `App.tsx` thread the needed continuation props into the detail screen.
- [ ] Run:

```bash
node --test tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts
```

Expected: FAIL because the mobile ecommerce continuation surface is not fully wired yet.

### Task 2: Carry ecommerce continuation metadata into mobile result entries

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/mobile/mobileFeedSelectors.ts`
- Modify: `tests/unit/mobile-feed-selectors.test.ts`

- [ ] Extend `MobileResultEntry` with the minimum ecommerce continuation metadata needed for the mobile detail screen.
- [ ] Source that metadata from the parent prompt node or inherited partial-redraw task state instead of inventing a second state model.
- [ ] Preserve current generic mobile result behavior for non-ecommerce entries.
- [ ] Add focused selector assertions for:
  - display label / module label
  - stage data
  - editable task availability
  - single-module continuation affordances
- [ ] Run:

```bash
node --test tests/unit/mobile-feed-selectors.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts
```

Expected: PASS.

### Task 3: Thread continuation handlers from App into the mobile surface

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/mobile/MobileWorkspaceSurface.tsx`
- Modify: `tests/unit/mobile-workspace-surface-contract.test.ts`

- [ ] Reuse existing App-owned ecommerce handlers instead of inventing a mobile-only task controller.
- [ ] Add the minimum mobile prop chain for:
  - edit task
  - confirm desktop
  - generate mobile
  - per-module selection toggle / confirm intent
- [ ] Make “edit task” return the operator to the composer with the correct active ecommerce task, rather than embedding a second full editor in the detail screen.
- [ ] Keep existing generic result-detail actions intact.
- [ ] Run:

```bash
node --test tests/unit/mobile-workspace-surface-contract.test.ts tests/unit/mobile-ecommerce-continuation-surface.test.ts
```

Expected: PASS.

### Task 4: Implement the mobile ecommerce continuation surface

**Files:**
- Modify: `src/components/mobile/MobileResultDetailScreen.tsx`
- Modify: `src/components/mobile/MobileWorkspaceSurface.tsx`
- Modify: `tests/unit/mobile-result-feed-detail-contract.test.ts`

- [ ] Add an ecommerce-only module card that makes the operator’s current unit explicit:
  - module label such as main image / A+ / platform-specific size
  - current stage / review status
  - actionable next step
- [ ] Add continuation controls for:
  - edit task
  - confirm desktop
  - generate mobile
  - module selection / confirmation semantics
- [ ] Ensure non-ecommerce entries still render as the current generic detail screen.
- [ ] Keep the UI as a continuation surface, not a full duplicate workbench.
- [ ] Run:

```bash
node --test tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/mobile-workspace-surface-contract.test.ts
```

Expected: PASS.

### Task 5: Verify the integrated ecommerce mobile follow-up flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/mobile/MobileResultDetailScreen.tsx`
- Modify: `src/components/mobile/MobileWorkspaceSurface.tsx`
- Modify: `src/components/mobile/mobileFeedSelectors.ts`

- [ ] Re-check that the selected module / task state remains tied to the existing ecommerce workflow state in `App.tsx`.
- [ ] Re-check that mobile continuation actions do not regress generic image continuation behavior.
- [ ] Run required verification:

```bash
node --test tests/unit/mobile-ecommerce-continuation-surface.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/mobile-feed-selectors.test.ts tests/unit/mobile-workspace-surface-contract.test.ts tests/unit/ecommerce-stage-status-surface.test.ts
cmd /c npm run typecheck
cmd /c npm run check:encoding
```

Expected: PASS.
