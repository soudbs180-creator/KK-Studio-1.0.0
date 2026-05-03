# KK-Studio v1.4.2 Single-Line Validation Matrix

Last updated: 2026-05-03

Use `npm.cmd` for npm scripts on Windows.

## Active Stage One M6 Closeout Gate

Use this gate while scanning or extending the remaining ecommerce runtime extraction. The partial redraw slice is already committed in `d12731ce`; rerun this set when the touched area overlaps redraw, source selection, or mobile result feed boundaries:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts" `
  "tests/unit/ecommerce-structured-task-source-contract.test.ts" `
  "tests/unit/partial-redraw-pipeline-contract.test.ts" `
  "tests/unit/mobile-result-feed-app-contract.test.ts"
```

Runtime commits also require `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check` unless `status.md` records a specific blocker.

Ledger-only closeout commits require:

```powershell
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "plans.md" "implement.md" "status.md" "validation.md"
```

## Completed Clay UI Gate

Use this gate if the completed Clay UI audit lane is touched again:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/clay-global-ui-refit-contract.test.ts" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/theme-contrast-contract.test.ts" `
  "tests/unit/responsive-surface.test.ts" `
  "tests/unit/theme-system-adaptation.test.ts" `
  "tests/unit/settings-entry-surface-style-regression.test.ts"
```

Clay UI commits also require browser QA plus `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, and `npm.cmd run check:encoding` unless `status.md` records a specific blocker.

## Clay UI Contract Suite

Run the Clay UI contract suite for every UI-lane change in this active UI thread:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/clay-global-ui-refit-contract.test.ts" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/theme-contrast-contract.test.ts" `
  "tests/unit/responsive-surface.test.ts" `
  "tests/unit/theme-system-adaptation.test.ts" `
  "tests/unit/settings-entry-surface-style-regression.test.ts"
```

Run the additional surface regressions when the touched area overlaps them:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-frosted-surface-contract.test.ts" `
  "tests/unit/mobile-workspace-surface-contract.test.ts"
```

## Clay UI Browser Requirement

Browser QA is mandatory for Clay UI changes. The browser check must use the Codex in-app Browser and cover desktop and mobile viewports for the touched surfaces.

Preferred flow:
1. `npm.cmd run dev:restart`
2. If Vite is unhealthy, run `npm.cmd run build` and serve `dist/` through a stable local static server.
3. Open the app in the Codex in-app Browser and verify both desktop and mobile viewports.

Required browser checks:
- Light theme uses warm cream surfaces with readable dark text.
- Dark theme uses neutral black/gray surfaces, not blue, teal, or indigo canvas.
- Inputs, main cards, sub cards, and framework cards render as controlled frosted material with readable contrast and no heavy shadow.
- SearchPalette, settings/API workbench, prompt/composer, and any touched modal or chrome surface are checked.
- `.theme-transitioning === 0` and no stale chunk text are confirmed.
- Record the URL, route or surface, viewport, theme, and any visual issues or pass result in `status.md`.

## Stage One Backfill Runtime / PPT / Ecommerce Gate

Use this broader gate for runtime/PPT/ecommerce follow-up slices when their touched area overlaps generation or PPT runtime. Keep those commits separate from Clay UI commits.

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ppt-runtime-contract.test.ts" `
  "tests/unit/ppt-runtime-helper-contract.test.ts" `
  "tests/unit/ppt-deck-single-container-contract.test.ts" `
  "tests/unit/generation-runtime-contract.test.ts" `
  "tests/unit/generation-billing-runtime-contract.test.ts"
```

PPT boundary slices also require `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check`.

## Stage Two CanvasContext Split Gate

Use this gate for `src/context/CanvasContext.tsx` splits. Add or narrow targeted tests after the responsibility map identifies the exact boundary; do not use one broad commit for state model, mutations, drag/selection, and persistence at the same time. Stage Two M1 used this gate for the state/default/context boundary plus the separated canvas compatibility helper. Stage Two M2 used the selection reducer contract below. Stage Two M3 used the prompt child image resolver contract below. Stage Two M4 used the workflow source node ID resolver contract below. Stage Two M5 used the media recovery contract below. Stage Two M10 used the placement contract below. Stage Two M11 used the layering contract below. Stage Two M12 used the group management contract below. Stage Two M13 used the movement contract below. Stage Two M14 used the tags contract below. Stage Two M15 used the node updates contract below. Stage Two M16 used the position updates contract below. Stage Two M17 used the prompt-image links contract below. Stage Two M18 used the workflow updates contract below. Stage Two M19 reused the prompt-image links contract below with the image deletion transform added. Stage Two M20 used the merge-into contract below. Stage Two M21 used the unused-code cleanup contract below. Stage Two M22 used the arrange-selection contract below. Stage Two M23 reuses the unused-code cleanup contract below with the duplicate selected-arrange fallback guard added.

State-boundary targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Selection-reducer targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-selection-runtime-contract.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts"
```

Prompt-child-image resolver targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-prompt-child-images-runtime-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Workflow-source-node-ID resolver targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" `
  "tests/unit/canvas-prompt-child-images-runtime-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Media recovery targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-media-recovery-contract.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Startup prompt recovery targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-prompt-recovery-contract.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Persisted image recovery targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-persisted-image-recovery-contract.test.ts" `
  "tests/unit/canvas-persisted-image-hydration-guard.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Canvas merge targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-merge-contract.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts"
```

Canvas merge-into targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-merge-into-contract.test.ts" `
  "tests/unit/canvas-merge-contract.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts"
```

Canvas unused-code cleanup targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-context-unused-cleanup.test.ts" `
  "tests/unit/canvas-merge-into-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts"
```

Canvas arrange-selection targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-arrange-selection-contract.test.ts" `
  "tests/unit/prompt-group-regroup-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts"
```

Canvas cleanup targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-cleanup-contract.test.ts" `
  "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts"
```

Canvas placement targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-placement-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts"
```

Canvas layering targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-layering-contract.test.ts" `
  "tests/unit/canvas-placement-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cloud-sync-signature.test.ts" `
  "tests/unit/canvas-startup-local-restore.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-connector-throttling-contract.test.ts"
```

Canvas group management targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-groups-contract.test.ts" `
  "tests/unit/canvas-layering-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts"
```

Canvas movement targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-movement-contract.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-connector-throttling-contract.test.ts"
```

Canvas tags targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-tags-contract.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts"
```

Canvas node updates targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-node-updates-contract.test.ts" `
  "tests/unit/canvas-persisted-image-hydration-guard.test.ts" `
  "tests/unit/canvas-context-state-boundary.test.ts"
```

Canvas position updates targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-position-updates-contract.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts"
```

Canvas prompt-image links targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-prompt-image-links-contract.test.ts" `
  "tests/unit/canvas-prompt-child-images-runtime-contract.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts"
```

Canvas workflow updates targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-workflow-updates-contract.test.ts" `
  "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" `
  "tests/unit/workflow-document-domain.test.ts" `
  "tests/unit/canvas-cleanup-contract.test.ts"
```

Minimum architecture split gate:

```powershell
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/context/CanvasContext.tsx" "src/context/canvasContextState.ts" "src/context/canvasCompatibility.ts" "src/context/canvasGroups.ts" "src/context/canvasMovement.ts" "src/context/canvasTags.ts" "src/context/canvasNodeUpdates.ts" "src/context/canvasPositionUpdates.ts" "src/context/canvasPromptImageLinks.ts" "src/context/canvasWorkflowUpdates.ts" "src/workflow/adapters/canvasToWorkflow.ts" "src/workflow/persistence/workflowSerializer.ts" "tests/unit" "plans.md" "implement.md" "validation.md" "status.md"
```

If the touched CanvasContext slice affects persistence or workspace layout, include:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/workspace-layout-contract.test.ts"
```

If the touched CanvasContext slice affects live scene, connector positions, or prompt grouping, include:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-connector-throttling-contract.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts"
```

## Stage One Backfill Generation Gate

Use this gate for the completed `useGenerationRuntime` boundary-hardening slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/generation-runtime-contract.test.ts" `
  "tests/unit/generation-billing-runtime-contract.test.ts"
```

This slice also requires `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check`.

Generation billing follow-ups use the same generation gate and must keep stale App-side generation billing imports out of `src/App.tsx`.

## Stage One Backfill Prompt Group Gate

Use this gate for the active `usePromptGroupLayout` boundary-hardening slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-local-performance-trace-contract.test.ts"
```

This slice also requires `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and a path-limited alternate-git `diff --check`.

## Release Gate

Run these before final sign-off:

```powershell
npm.cmd run governance:check
npm.cmd run spec:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

## Security Cleanup Gate

Use this gate for narrow endpoint or secret-boundary cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/governance-contract.test.ts"
npm.cmd run governance:security
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run governance:check
```

Current release status: the former `governance:version` portable metadata mismatch was cleared by `567f85aa`, and `npm.cmd run governance:check` passed in the latest full gate. Rerun this gate after any future packaging or publish metadata change.

## Finalization Audit Gate

Use this after the active Stage Two slice is closed and before claiming full project completion:

```powershell
npm.cmd run architecture:check
npm.cmd run spec:check
npm.cmd run governance:security
npm.cmd audit --audit-level=moderate
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd run governance:agent-docs
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

If UI files were touched since the last browser evidence, rerun the Clay UI contract suite and Codex in-app Browser QA before final sign-off. If only runtime/docs files were touched, record the browser skip reason in `status.md`.
