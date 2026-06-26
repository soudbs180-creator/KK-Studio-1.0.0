# Settings API Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Settings API management use dedicated child pages for create/edit, keep back navigation inside API management, and restore list context after returning from nested API routes.

**Architecture:** Add a focused route-state helper shared by the settings shell and `ApiSettingsView`, then convert API editor visibility to route-driven rendering. Use React Router location state to carry the active tab and highlighted item back to the API list, and make the mobile shell back action API-route-aware.

**Tech Stack:** React 19, React Router, TypeScript, node:test, Tailwind utility classes plus project CSS in `src/index.css`

---

### Task 1: Lock the route-state contract with failing tests

**Files:**
- Create: `tests/unit/api-management-route-state.test.ts`
- Create: `tests/unit/api-settings-routing-regression.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildApiManagementListState,
  deriveApiManagementListStateFromPath,
  readApiManagementListState,
} from '../../src/components/settings/apiManagementRouteState.ts';

test('deriveApiManagementListStateFromPath maps nested editor routes back to the correct API list tab', () => {
  assert.deepEqual(
    deriveApiManagementListStateFromPath('/settings/api-management/official/google-main'),
    { source: 'api-management', activeTab: 'official', highlightOfficialId: 'google-main' },
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test "tests/unit/api-management-route-state.test.ts" "tests/unit/api-settings-routing-regression.test.ts"`
Expected: FAIL because the route-state helper module and route-driven source patterns do not exist yet.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/api-management-route-state.test.ts tests/unit/api-settings-routing-regression.test.ts
git commit -m "test: lock settings api routing contract"
```

### Task 2: Implement shared API-management route-state helpers

**Files:**
- Create: `src/components/settings/apiManagementRouteState.ts`
- Test: `tests/unit/api-management-route-state.test.ts`

- [ ] **Step 1: Write the minimal helper implementation**

```ts
export type ApiManagementTab = 'official' | 'third-party';

export interface ApiManagementListState {
  source: 'api-management';
  activeTab: ApiManagementTab;
  highlightOfficialId?: string;
  highlightProviderId?: string;
}
```

- [ ] **Step 2: Run tests to verify the helper passes**

Run: `node --test "tests/unit/api-management-route-state.test.ts"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/apiManagementRouteState.ts tests/unit/api-management-route-state.test.ts
git commit -m "feat: add api management route state helpers"
```

### Task 3: Make API editor/list rendering route-driven

**Files:**
- Modify: `src/components/settings/ApiSettingsView.tsx`
- Modify: `src/index.css`
- Test: `tests/unit/api-settings-routing-regression.test.ts`

- [ ] **Step 1: Refactor API editor visibility to follow nested routes only**

```tsx
const showOfficialEditor = isOfficialEditorRoute;
const showProviderEditor = isProviderEditorRoute;
```

- [ ] **Step 2: Route save/cancel/delete actions back through a shared API list return helper**

```tsx
const returnToApiManagement = (state: ApiManagementListState) => {
  navigate(API_MANAGEMENT_HOME_PATH, { state });
};
```

- [ ] **Step 3: Restore active tab and briefly highlight the related card on the API list**

```tsx
useEffect(() => {
  const nextState = readApiManagementListState(location.state);
  if (!nextState || isOfficialEditorRoute || isProviderEditorRoute) {
    return;
  }

  setActiveTab(nextState.activeTab);
}, [isOfficialEditorRoute, isProviderEditorRoute, location.state]);
```

- [ ] **Step 4: Add subtle API list/editor enter animations and card return highlight styles**

```css
.settings-panel .settings-api-view--editor {
  animation: settings-api-editor-enter 200ms ease-out;
}
```

- [ ] **Step 5: Run regression tests**

Run: `node --test "tests/unit/api-settings-routing-regression.test.ts"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/ApiSettingsView.tsx src/index.css tests/unit/api-settings-routing-regression.test.ts
git commit -m "feat: route api editor flow through settings api management"
```

### Task 4: Make mobile settings back behavior API-route-aware

**Files:**
- Modify: `src/components/settings/SettingsPanel.localized.tsx`
- Modify: `src/components/settings/apiManagementRouteState.ts`
- Test: `tests/unit/api-settings-routing-regression.test.ts`

- [ ] **Step 1: Add route parsing helpers for mobile back handling**

```ts
const derivedState = deriveApiManagementListStateFromPath(location.pathname);
```

- [ ] **Step 2: Route the mobile top-left back button to the API list when inside nested API editor routes**

```tsx
if (isApiManagementEditorRoute) {
  onBackToApiManagement();
  return;
}
```

- [ ] **Step 3: Run regression tests**

Run: `node --test "tests/unit/api-settings-routing-regression.test.ts"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/SettingsPanel.localized.tsx src/components/settings/apiManagementRouteState.ts tests/unit/api-settings-routing-regression.test.ts
git commit -m "fix: keep mobile settings back flow inside api management"
```

### Task 5: Full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-07-settings-api-routing-design.md`
- Modify: `docs/superpowers/plans/2026-04-07-settings-api-routing.md`

- [ ] **Step 1: Run targeted tests**

Run: `node --test "tests/unit/api-management-route-state.test.ts" "tests/unit/api-settings-routing-regression.test.ts"`
Expected: PASS

- [ ] **Step 2: Run required project verification**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run governance:agent-docs`
Expected: PASS

Run: `npm run check:encoding`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-04-07-settings-api-routing-design.md docs/superpowers/plans/2026-04-07-settings-api-routing.md
git commit -m "docs: record settings api routing design and plan"
```
