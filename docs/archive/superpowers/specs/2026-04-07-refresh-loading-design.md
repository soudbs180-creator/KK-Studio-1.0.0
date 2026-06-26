# Refresh And Loading Coordination Design

Date: 2026-04-07
Status: Draft for review
Owner: Codex

## Summary

This design aligns frontend refresh behavior with backend data synchronization so KK Studio stops showing noisy loading states during routine sync work. The main goal is to keep the UI stable after first paint: background refreshes must be silent, user-triggered refreshes must stay local to the control that initiated them, and repeated refresh triggers must deduplicate instead of creating overlapping requests.

The first implementation wave will focus on billing state, admin model catalog refresh, and user API settings management because these areas currently mix initial loading, background sync, and manual refresh into the same visible `loading` behavior.

## Problem Statement

The current app has several independent refresh loops and request entry points:

- Billing refreshes on startup, focus, visibility changes, and polling.
- Admin model catalog refreshes on startup, focus, visibility changes, timers, and broadcast updates.
- API settings refreshes from local runtime state, cloud snapshot fallback, health checks, connectivity checks, and pricing sync.
- Third-party provider management uses one broad loading state for unrelated actions.

These flows currently cause three user-facing problems:

1. Background synchronization can look like foreground work.
2. Repeated refresh triggers can fire close together with little or no user benefit.
3. Existing visible data is sometimes hidden or treated as unavailable while a newer copy is being fetched.

This creates the feeling that frontend and backend are disconnected: the frontend appears busy, but the extra activity does not produce a better or faster user result.

## Goals

- Keep first-load behavior explicit, but make subsequent refreshes silent by default.
- Preserve the last known good data during background refreshes.
- Deduplicate in-flight refreshes per resource so repeated triggers reuse work.
- Limit visible loading indicators to the control or region the user explicitly interacted with.
- Stop balance, settings, and model catalog views from flashing placeholder values during background sync.
- Make refresh semantics consistent across contexts and services.

## Non-Goals

- Full migration to a new client data framework.
- Replacing all contexts with a query library in this iteration.
- Large-scale visual redesign of settings or account surfaces.
- Reworking unrelated network behavior outside the targeted refresh paths.

## Root Cause Analysis

### Mixed refresh intent

Current code often treats initial bootstrap, manual refresh, and background sync as the same operation. The same `loading` state is used for actions with different UX expectations.

### Too many trigger points

Focus, visibility, interval timers, startup callbacks, and manual actions can all refresh the same resource. Some flows already reuse a promise, but the visible state still behaves as if each trigger is a separate foreground load.

### No strict stale-data policy

The app already has useful cached data in several places, especially billing and user API settings snapshots. Even so, some UI surfaces still degrade to placeholders or blocking states while new data is fetched.

### Overly broad loading scope

Some pages use a single global loading flag for multiple unrelated actions. This makes one local operation look like a page-wide lock.

## Chosen Approach

Adopt a unified refresh contract for targeted resources, with three refresh modes and stable stale-data handling.

### Refresh modes

- `bootstrap`: first load for a resource when no usable data exists yet. This may block part of the UI.
- `manual`: user explicitly requested refresh. This may show loading, but only in the initiating control or card.
- `background`: timer, focus, visibility, broadcast, or deferred sync. This must not trigger global loading or replace existing values with placeholders.

### Shared rules

- Every refreshable resource keeps the last known good data until a new result is ready.
- Each resource exposes whether it has ever resolved usable data in the current scope.
- Each resource deduplicates in-flight refreshes by mode-compatible key.
- Background refreshes never clear visible values.
- Manual refreshes may show a spinner only in the initiating surface.
- Bootstrap loading is allowed only while there is no usable data to render.

## Data State Model

The implementation will separate resource state into the following concepts:

- `initialLoading`: true only when the current resource scope has no usable data yet and bootstrap is in progress.
- `backgroundRefreshing`: true while a silent refresh is happening. This is not allowed to create blocking UI.
- `manualRefreshing`: keyed to the specific action or resource card that the user triggered.
- `stale`: true when currently displayed data is older than the latest desired fetch point, but still usable.
- `lastUpdatedAt`: timestamp of the last successful resolution.
- `hasResolvedData`: whether the current scope has already produced a usable snapshot.

Not every component needs to expose all fields publicly, but these concepts must drive implementation decisions.

## UX Rules

### Global UI

- Full-screen loading is only acceptable before the app has enough data to render the current surface safely.
- Background synchronization must not show modal loaders, blocking overlays, or global progress bars.

### Balance and billing

- If a balance has already been resolved or restored from snapshot, continue showing it during background refresh.
- Do not replace balance with `...` during silent refresh.
- Generation flows should only block on billing when the current user scope has never resolved a usable balance.

### Settings and provider management

- Manual refresh buttons may animate locally.
- Editing forms should stay visible and interactive when background sync is running.
- Silent sync should not emit repeated progress toasts.
- A local card or action button may show refresh state, but the whole page should not shift into a generic loading mode.

### Snapshot fallback

- If a cloud-backed or local snapshot is available, render it immediately.
- While snapshot hydration is being reconciled with newer runtime data, prefer soft helper text instead of hard blocking.

## Targeted Implementation Plan

### 1. Billing context

File: `src/context/BillingContext.tsx`

Changes:

- Narrow the exported `loading` meaning so it only represents unresolved bootstrap for the active billing scope.
- Keep silent refresh behavior for focus, visibility, and interval sync, but stop surfacing those refreshes as user-blocking state.
- Continue rendering cached snapshot data while background refresh runs.
- Add or derive a stronger `hasResolvedBalance` style signal so callers can distinguish first unresolved load from silent refresh.
- Ensure `refreshBilling({ silent: true })` never causes visible balance placeholders.

Expected result:

- Billing remains accurate without making the app appear blocked.
- Existing balance display remains stable during silent updates.

### 2. App integration

File: `src/App.tsx`

Changes:

- Adjust balance- and auth-dependent guard logic to distinguish bootstrap-unresolved state from background refresh.
- Avoid treating silent billing refresh as a hard stop for credit-based actions once a usable balance exists.
- Keep global loading screens only for true app bootstrap stages.

Expected result:

- Credit checks stop failing just because a silent sync is in progress.
- Mobile and workspace balance displays remain stable.

### 3. Mobile account chrome

File: `src/components/mobile/MobileHeader.tsx`

Changes:

- Show the last resolved balance during background refresh.
- Reserve loading placeholder behavior for true unresolved bootstrap only.

Expected result:

- The balance chip no longer flashes to `...` during silent refresh.

### 4. Admin model service

File: `src/services/model/adminModelService.ts`

Changes:

- Keep single-flight promise reuse.
- Add stricter refresh throttling so focus, visibility, timer, and broadcast triggers do not cascade into near-duplicate work.
- Treat startup-deferred refreshes as background work once the model catalog has already resolved.

Expected result:

- Model catalog updates still stay fresh, but refresh traffic becomes more deliberate.

### 5. API settings

File: `src/components/settings/ApiSettingsView.tsx`

Changes:

- Preserve button-scoped `busy` behavior for explicit actions such as connectivity checks and pricing sync.
- Keep initial cloud sync silent whenever a snapshot or fallback data is already available.
- Reduce hard editor lockouts caused by snapshot hydration when the current view already has usable data.
- Continue preferring account-backed cloud records when runtime persistence is degraded, but avoid making the screen feel blocked during reconciliation.

Expected result:

- The settings page can stay usable while syncing.
- Refresh remains explicit only where the user clicked it.

### 6. Third-party provider manager

File: `src/components/api/ThirdPartyProviderManager.tsx`

Changes:

- Replace the broad `isLoading` state with action-scoped loading keys.
- Separate provider creation, provider management refresh, balance update, and refresh-all workflows.
- Suppress repeated "refreshing" toast chatter during silent or bulk refresh paths.
- Keep silent refresh behavior when pricing modal opens and cached pricing is missing, but do not turn the whole management experience into one page-wide loading state.

Expected result:

- One provider operation no longer makes the entire manager appear blocked.
- Refresh feedback becomes precise and easier to trust.

## Request Coordination Rules

These rules apply across the targeted resources:

1. If a refresh for the same resource and scope is already in flight, reuse it.
2. A manual refresh may reuse an in-flight background refresh when the data target is the same.
3. Background refresh should obey a cooldown window where appropriate, especially for model catalog and focus-based refresh triggers.
4. Manual refresh bypasses cooldown only when explicitly needed by user intent.
5. A failed background refresh must not clear good visible data.
6. A failed bootstrap refresh may surface an error state because the user otherwise has nothing to work with.

## Testing Strategy

### Behavioral verification

- First app entry with no cached billing data still shows an explicit bootstrap state.
- Returning to the tab or window does not trigger a visible full-surface loading state if usable data already exists.
- Mobile balance display stays stable during silent refresh.
- Manual refresh buttons show localized loading only on the clicked action.
- Settings and provider management remain editable while background sync is running.

### Technical verification

- Repeated refresh triggers for the same resource do not produce duplicate overlapping requests.
- Silent refresh does not regress visible value continuity.
- Promise reuse continues to work after the state split.

### Required project checks

- `npm run governance:agent-docs`
- `npm run check:encoding`

Implementation work in the follow-up phase will also require:

- `npm run typecheck`

## Risks And Mitigations

### Risk: stale data remains visible slightly longer

Mitigation:

- This is intentional as long as the data is still usable.
- The UI will favor continuity over aggressive placeholder resets.

### Risk: manual actions accidentally become silent

Mitigation:

- Manual refresh states will remain explicitly keyed and local to the initiating control.

### Risk: multiple resources adopt inconsistent semantics

Mitigation:

- This design defines the same bootstrap, manual, and background contract for all targeted resources.
- Follow-up implementation must normalize terminology instead of inventing new refresh meanings per file.

## Rollout Order

1. Billing state and app-level balance gating.
2. Mobile balance display stabilization.
3. Admin model service refresh throttling.
4. API settings silent cloud sync refinement.
5. Third-party provider manager loading-scope cleanup.

This order prioritizes the most visible user-facing stability improvements first while keeping the later settings work aligned to the same refresh contract.
