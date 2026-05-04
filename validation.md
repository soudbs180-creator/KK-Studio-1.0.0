# KK-Studio v1.4.2 Single-Line Validation Matrix

Last updated: 2026-05-04

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

## Ecommerce Task Merger Cleanup Gate

Use this gate for the ecommerce task merger unused-parameter cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/ecommerce-task-services.test.ts" "tests/unit/ecommerce-node-generation-runtime-contract.test.ts" "tests/unit/ecommerce-structured-task-source-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/ecommerce/taskMerger.ts" "tests/unit/ecommerce-task-services.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/ecommerce/taskMerger.ts` matches. Do not change sparse intent parsing, copy resolution, style/layout/inherit precedence, render task generation, or ecommerce runtime wiring in this cleanup slice.

## Model Display Name Cleanup Gate

Use this gate for the model display-name provider-parameter cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/model-display-name-regression.test.ts" "tests/unit/model-library-bootstrap-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/model/modelCapabilities.ts" "tests/unit/model-display-name-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/model/modelCapabilities.ts` matches. Do not change model/provider routing, admin model lookup, model-list bootstrapping, custom-label precedence, keyManager behavior, or API/settings surfaces in this cleanup slice.

## Video Service Unused Cleanup Gate

Use this gate for the video-service unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/video-service-unused-cleanup-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/video/OpenAIVideoService.ts" "src/services/video/VeoVideoService.ts" "src/services/video/videoService.ts" "tests/unit/video-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/video` matches. Do not change browser fail-closed behavior, Veo request construction, API base normalization, progress labels, polling, download/auth headers, returned result shape, or provider routing in this cleanup slice.

## Image Service Unused Cleanup Gate

Use this gate for the image priority/LOD unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/image-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/image/imagePriorityLoader.ts" "src/services/image/lodService.ts" "tests/unit/image-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/image/imagePriorityLoader.ts` and zero `src/services/image/lodService.ts` matches. Do not change queue ordering, task execution, lazy-image import behavior, LOD thresholds, storage lookup order, cache mutation, memory-manager calls, fallback URL behavior, or browser-visible image rendering in this cleanup slice.

## Small LLM Adapter Unused Cleanup Gate

Use this gate for small audio/Volcengine adapter unused cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/llm-adapter-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/AudioCompatibleAdapter.ts" "src/services/llm/VolcengineAdapter.ts" "tests/unit/llm-adapter-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/llm/AudioCompatibleAdapter.ts` and zero `src/services/llm/VolcengineAdapter.ts` matches. Do not change audio request body construction, duration limiting, lyrics/style/continuation/TTS fields, polling, Volcengine endpoint selection, auth headers, or provider routing in this cleanup slice.

## Chat Service Unused Cleanup Gate

Use this gate for the chat-service unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/chat-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/chat/chatService.ts" "tests/unit/chat-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/chat/chatService.ts` matches. Do not change chat storage, saved-message/session behavior, request body construction, URL/header construction, keyManager success/failure reporting, provider/model routing, API/settings surfaces, endpoint/auth behavior, or browser-visible UI in this cleanup slice.

## Generation Runtime Contract Test Cleanup Gate

Use this gate for the test-only generation-runtime contract cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/generation-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true -p tsconfig.tests.json
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "tests/unit/generation-runtime-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true -p tsconfig.tests.json` probe is still expected to fail while broader test-config/type debt remains outside this slice; for this gate, filter the output and require zero `tests/unit/generation-runtime-contract.test.ts` matches. Do not change production generation runtime code, App wiring, retry generation behavior, billing behavior, provider routing, endpoint/auth behavior, release metadata, or browser-visible UI in this cleanup slice.

## Prompt Optimizer Duplicate Tab Cleanup Gate

Use this gate for the prompt optimizer duplicate-tab cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/prompt-optimizer-service-source-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/promptOptimizerService.ts" "tests/unit/prompt-optimizer-service-source-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/llm/promptOptimizerService.ts` matches. Do not change prompt optimization behavior, automatic route selection, provider routing, API/settings surfaces, endpoint/auth behavior, billing/payment behavior, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## KK API Client Unused DTO Cleanup Gate

Use this gate for the contract-client unused DTO cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/kk-api-client.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "packages/contracts/src/client/kk-api-client.ts" "tests/unit/kk-api-client.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `packages/contracts/src/client/kk-api-client.ts` matches. Do not change public DTO shapes, contract package exports, client endpoint paths, auth/header behavior, billing/payment business logic, provider routing, API/settings surfaces, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## User API Payload Secret-Constant Cleanup Gate

Use this gate for the user API payload unused secret-constant cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/billing-remaining-balance-contract.test.ts" "tests/unit/user-api-cloud-storage.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/api/userApiPayload.ts" "tests/unit/billing-remaining-balance-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/api/userApiPayload.ts` matches. Do not change secret redaction behavior, cloud record storage persistence behavior, API/settings surfaces, endpoint/auth behavior, billing/payment business logic, provider routing, storage migration, release metadata, or browser-visible UI in this cleanup slice.

## Cost Service Import-Only Cleanup Gate

Use this gate for the cost service import-only cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/import-only-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/billing/costService.ts" "tests/unit/import-only-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/billing/costService.ts` matches. Do not change pricing tables, cost calculation formulas, key-slot pricing snapshot lookup, cost recording/sync behavior, provider routing, API/settings surfaces, endpoint/auth behavior, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## Stage Two CanvasContext Split Gate

Use this gate for `src/context/CanvasContext.tsx` splits. Add or narrow targeted tests after the responsibility map identifies the exact boundary; do not use one broad commit for state model, mutations, drag/selection, and persistence at the same time. Stage Two M1 used this gate for the state/default/context boundary plus the separated canvas compatibility helper. Stage Two M2 used the selection reducer contract below. Stage Two M3 used the prompt child image resolver contract below. Stage Two M4 used the workflow source node ID resolver contract below. Stage Two M5 used the media recovery contract below. Stage Two M10 used the placement contract below. Stage Two M11 used the layering contract below. Stage Two M12 used the group management contract below. Stage Two M13 used the movement contract below. Stage Two M14 used the tags contract below. Stage Two M15 used the node updates contract below. Stage Two M16 used the position updates contract below. Stage Two M17 used the prompt-image links contract below. Stage Two M18 used the workflow updates contract below. Stage Two M19 reused the prompt-image links contract below with the image deletion transform added. Stage Two M20 used the merge-into contract below. Stage Two M21 used the unused-code cleanup contract below. Stage Two M22 used the arrange-selection contract below. Stage Two M23 reused the unused-code cleanup contract below with the duplicate selected-arrange fallback guard added. Stage Two M24 used the arrange-selection contract below with selected-root cases added. Stage Two M25 used the arrange-selection contract below with selected grouped arrange and fallthrough cases added. Stage Two M26 used the auto-arrange contract below and is committed in `7cbd7346`. Stage Two M27 used the node updates contract below with prompt add/update reducers and is committed in `b16843ee`. Stage Two M79 reused the unused-code cleanup contract below with a type-import-only guard for `CanvasContextType` and `SubCardLayout`.

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
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-context-unused-cleanup.test.ts"
```

Canvas auto-arrange targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-auto-arrange-contract.test.ts" `
  "tests/unit/canvas-arrange-selection-contract.test.ts" `
  "tests/unit/prompt-group-regroup-layout.test.ts" `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/prompt-group-drag-layout.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-context-unused-cleanup.test.ts"
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

## Stage Two keyManager Split Gate

Use this gate for `src/services/auth/keyManager.ts` splits. Start with pure helpers that can be contract-tested without touching storage, permissions, encryption, provider credential state, UI, or release metadata.

Model parsing/normalization targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/model-id-normalization-parity-contract.test.ts" `
  "tests/unit/key-manager-model-helpers-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/model-display-name-regression.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts"
```

Model-list normalization targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-model-list-contract.test.ts" `
  "tests/unit/key-manager-model-helpers-contract.test.ts" `
  "tests/unit/key-manager-default-models-contract.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/model-id-normalization-parity-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/model-display-name-regression.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts"
```

Model-list normalization slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerModelList.ts" "tests/unit/key-manager-model-list-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Effective provider model fallback targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-effective-provider-models-contract.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/api-settings-view-source-guard.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/key-manager-model-list-contract.test.ts"
```

Effective provider model fallback slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerEffectiveProviderModels.ts" "tests/unit/key-manager-effective-provider-models-contract.test.ts" "tests/unit/official-route-default-models.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Default model constants targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-default-models-contract.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts"
```

Default model constants slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerDefaultModels.ts" "tests/unit/key-manager-default-models-contract.test.ts" "tests/unit/official-route-default-models.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider presets targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-provider-presets-contract.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts" `
  "tests/unit/flow2api-provider-support.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/official-route-default-models.test.ts"
```

Provider presets slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviderPresets.ts" "tests/unit/key-manager-provider-presets-contract.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/flow2api-provider-support.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Documented static provider model helper slices reuse the provider presets gate above and this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviderPresets.ts" "tests/unit/key-manager-provider-presets-contract.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Silent pricing URL helper targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-pricing-url-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/user-route-pricing-endpoint-override.test.ts" `
  "tests/unit/kk-api-client.test.ts"
```

Key type/cycle-break targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-key-type-contract.test.ts" `
  "tests/unit/key-manager-model-helpers-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/provider-strategy.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts"
```

Provider runtime-state merge targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-provider-persistence-contract.test.ts" `
  "tests/unit/key-manager-cloud-sync.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/user-api-cloud-storage.test.ts" `
  "tests/unit/frontend-key-boundary-hardening.test.ts" `
  "tests/unit/auth-data-routes.test.ts"
```

Provider linked-slot matching targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-provider-links-contract.test.ts" `
  "tests/unit/key-manager-provider-persistence-contract.test.ts" `
  "tests/unit/key-manager-runtime-fallback.test.ts" `
  "tests/unit/provider-strategy.test.ts" `
  "tests/unit/official-route-default-models.test.ts" `
  "tests/unit/model-library-bootstrap-regression.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/user-api-cloud-storage.test.ts"
```

keyManager architecture slices also require:

```powershell
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerModelHelpers.ts" "src/services/auth/keyManagerKeyType.ts" "src/services/auth/keyManagerEffectiveSlot.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/key-manager-key-type-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Silent pricing URL helper slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerPricingUrl.ts" "tests/unit/key-manager-pricing-url-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider runtime-state merge slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviders.ts" "src/services/auth/keyManagerStorage.ts" "tests/unit/key-manager-provider-persistence-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider linked-slot matching slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviderLinks.ts" "tests/unit/key-manager-provider-links-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/key-manager-provider-persistence-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider usage helper slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-provider-usage-contract.test.ts" "tests/unit/key-manager-provider-links-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/key-manager-provider-persistence-contract.test.ts"
```

Provider usage delegator-pruning slices may use this narrower targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-provider-usage-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts"
```

Provider usage delegator-pruning slices may use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "tests/unit/key-manager-provider-usage-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Provider usage helper slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerProviderUsage.ts" "tests/unit/key-manager-provider-usage-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Route ID helper slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-route-ids-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/official-route-default-models.test.ts" "tests/unit/key-manager-provider-links-contract.test.ts"
```

Route ID helper slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerRouteIds.ts" "tests/unit/key-manager-route-ids-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Credential sanitizer slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-credential-sanitizer-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/official-route-default-models.test.ts" "tests/unit/key-manager-key-type-contract.test.ts"
```

Credential sanitizer slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerCredentialSanitizer.ts" "tests/unit/key-manager-credential-sanitizer-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Channel config secret-boundary slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-channel-config-secrets-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/official-route-default-models.test.ts"
```

Channel config secret-boundary slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerChannelConfigSecrets.ts" "tests/unit/key-manager-channel-config-secrets-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Dead-code pruning slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-dead-code-pruning-contract.test.ts" "tests/unit/model-library-bootstrap-regression.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts"
```

Dead-code pruning slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "tests/unit/key-manager-dead-code-pruning-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser-direct diagnostics guard slices should use this targeted gate:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/key-manager-dead-code-pruning-contract.test.ts" "tests/unit/key-manager-channel-config-secrets-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/official-route-default-models.test.ts"
```

Browser-direct diagnostics guard slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Model ID compatibility facade slices should use this narrower path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/utils/modelIdNormalization.ts" "src/services/auth/keyManagerModelHelpers.ts" "tests/unit/model-id-normalization-parity-contract.test.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/model-display-name-regression.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
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

## OpenAI-Compatible Adapter Gates

Use this gate for the completed diagnostics preview helper extraction, image-routing error classifier extraction, and unreachable image fallback cleanup in `OpenAICompatibleAdapter`:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/openai-compatible-diagnostics-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/governance-contract.test.ts"
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run audit:dependencies
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

This slice also requires this path-limited diff check:

```powershell
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleDiagnostics.ts" "src/services/llm/openAICompatibleImageRoutingErrors.ts" "tests/unit/openai-compatible-diagnostics-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

## UI Unused Cleanup Gate

Use this gate for PromptBar/ImageCard and legacy dashboard compiler-source cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/prompt-bar-*.test.ts" "tests/unit/canvas-live-scene-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts" "tests/unit/ui-unused-cleanup-contract.test.ts" "tests/unit/dashboard-settings-overview-regression.test.ts" "tests/unit/dashboard-settings-legacy-pruning.test.ts" "tests/unit/billing-remaining-balance-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run audit:dependencies
npm.cmd run spec:check
npm.cmd run governance:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/layout/PromptBar.tsx" "src/components/image/ImageCard2.tsx" "src/components/settings/views/DashboardView.tsx" "tests/unit/ui-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133 debt remains outside this slice; for this gate, filter the output and require zero `PromptBar.tsx`, `ImageCard2.tsx`, and `src/components/settings/views/DashboardView.tsx` matches for the touched file set.

## File-System Compatibility Stub Cleanup Gate

Use this gate for `fileSystemService.ts` tag/settings compatibility stub parameter cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/filesystem-tag-shortcut-compat-contract.test.ts" "tests/unit/canvas-filesystem-persistence-scope.test.ts" "tests/unit/filesystem-startup-consolidation-deferral.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/storage/fileSystemService.ts" "tests/unit/filesystem-tag-shortcut-compat-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133 debt remains outside this slice; for this gate, filter the output and require zero `src/services/storage/fileSystemService.ts` matches. Do not remove or implement the compatibility stubs in this cleanup slice.

## Import-Only Unused Cleanup Gate

Use this gate for import/type-list-only cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/import-only-unused-cleanup-contract.test.ts" "tests/unit/partial-redraw-lightbox-contract.test.ts" "tests/unit/responsive-surface.test.ts" "tests/unit/google-official-gemini-protocol-guards.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/image/GlobalLightbox.tsx" "src/hooks/useImageQuality.ts" "src/services/model/modelRegistry.ts" "tests/unit/import-only-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133 debt remains outside this slice; for this gate, filter the output and require zero matches for the touched import-only file set.

## Live Canvas Residual Cleanup Gate

Use this gate for live `InfiniteCanvas.tsx` residual noUnused cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/canvas-live-unused-cleanup-contract.test.ts" "tests/unit/canvas-live-scene-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts" "tests/unit/ecommerce-wheel-scroll-guard.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/canvas/InfiniteCanvas.tsx" "tests/unit/canvas-live-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133 debt remains outside this slice; for this gate, filter the output and require zero `src/components/canvas/InfiniteCanvas.tsx` matches. Do not narrow `InfiniteCanvasProps` or change JSX/interaction behavior in this cleanup slice.

## Workflow Actions Import Cleanup Gate

Use this gate for `src/app/useWorkflowActions.ts` import-only cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/workflow-actions-unused-cleanup-contract.test.ts" "tests/unit/canvas-workflow-updates-contract.test.ts" "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" "tests/unit/workflow-document-domain.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/app/useWorkflowActions.ts" "tests/unit/workflow-actions-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/app/useWorkflowActions.ts` matches. Do not change template definitions, `App.tsx` template-list wiring, workflow card factories, or workflow UI behavior in this cleanup slice.

## Common ErrorBoundary Unused Cleanup Gate

Use this gate for `src/components/common/ErrorBoundary.tsx` unused-parameter cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/startup-error-localization.test.ts" "tests/unit/app-startup-screen-localization.test.ts" "tests/unit/clay-frosted-surface-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/common/ErrorBoundary.tsx" "tests/unit/startup-error-localization.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/common/ErrorBoundary.tsx` matches. Do not change captured-error localization, frosted error UI, reload behavior, startup error rendering, or global error handling in this cleanup slice.

## Generation Runtime Import Cleanup Gate

Use this gate for `src/app/useGenerationRuntime.ts` import-only cleanup:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/generation-runtime-contract.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/generation-billing-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/app/useGenerationRuntime.ts" "tests/unit/generation-runtime-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/app/useGenerationRuntime.ts` matches. Do not change generation execution, retry billing, model-label behavior, App runtime wiring, provider routing, or UI behavior in this cleanup slice.

## App Unused Cleanup Gate

Use this gate for the App compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/app-unused-cleanup-contract.test.ts" "tests/unit/ui-unused-cleanup-contract.test.ts" "tests/unit/canvas-live-scene-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts" "tests/unit/canvas-connector-throttling-contract.test.ts" "tests/unit/generation-runtime-contract.test.ts" "tests/unit/prompt-group-regroup-behavior.test.ts" "tests/unit/prompt-group-drag-layout.test.ts" "tests/unit/canvas-workflow-source-node-ids-contract.test.ts" "tests/unit/canvas-workflow-updates-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/App.tsx" "tests/unit/app-unused-cleanup-contract.test.ts" "tests/unit/ecommerce-framework-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/App.tsx` matches.

## OpenAI-Compatible Unused Cleanup Gate

Use this gate for the OpenAI-compatible compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-unused-cleanup-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/openai-compatible-diagnostics-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "tests/unit/openai-compatible-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/llm/OpenAICompatibleAdapter.ts` matches.

## LLMService Unused Cleanup Gate

Use this gate for the LLMService compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/llm-service-unused-cleanup-contract.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/user-route-proxy-routing.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/secure-model-proxy-credit-contract.test.ts" "tests/unit/secure-model-proxy-trace-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/LLMService.ts" "tests/unit/llm-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/services/llm/LLMService.ts` matches.

## Pure Utility Unused Cleanup Gate

Use this gate for the pure utility compiler-source cleanup and pure image orphan cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/pure-utility-unused-cleanup-contract.test.ts" "tests/unit/prompt-group-regroup-behavior.test.ts" "tests/unit/prompt-group-drag-layout.test.ts" "tests/unit/ui-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
if ((rg -n "imageCompression" src -S) -ne $null) { throw "imageCompression source reference remains" }
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/App.tsx" "src/app/promptGroupRenderLayout.ts" "src/utils/modelSorting.ts" "src/services/image/imageCompression.ts" "tests/unit/pure-utility-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/app/promptGroupRenderLayout.ts`, `src/utils/modelSorting.ts`, `src/App.tsx`, and `src/services/image/imageCompression.ts` matches. For the pure image orphan cleanup, the `rg` guard must find no `imageCompression` source references.

## ChatSidebar Unused Cleanup Gate

Use this gate for the ChatSidebar compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/chat-sidebar-unused-cleanup-contract.test.ts" "tests/unit/billing-remaining-balance-contract.test.ts" "tests/unit/capability-route-runtime-preference-contract.test.ts" "tests/unit/kkai-billing-ui-surface.test.ts" "tests/unit/model-library-public-admin-browse.test.ts" "tests/unit/model-library-open-guards.test.ts" "tests/unit/prompt-bar-model-library-loading.test.ts" "tests/unit/clay-frosted-surface-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/layout/ChatSidebar.tsx" "tests/unit/chat-sidebar-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/layout/ChatSidebar.tsx` matches.

## Dormant Canvas Unused Cleanup Gate

Use this gate for source-proven dormant canvas support cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/canvas-dormant-unused-cleanup-contract.test.ts" "tests/unit/clay-frosted-surface-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
if ((rg -n "PixiCanvas|preloadPixi|isPixiAvailable" src -S) -ne $null) { throw "Pixi canvas source reference remains" }
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/canvas/PixiCanvas.tsx" "src/components/canvas/Canvas.tsx" "src/components/canvas/PendingNode.tsx" "tests/unit/canvas-dormant-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/canvas/PixiCanvas`, `src/components/canvas/Canvas`, and `src/components/canvas/PendingNode` matches. Browser QA may be skipped when the slice deletes or cleans only dormant canvas support code with no live production imports; record the skip reason in `status.md`.

## PromptNode Unused Cleanup Gate

Use this gate for the PromptNode compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/prompt-node-unused-cleanup-contract.test.ts" "tests/unit/prompt-node-optimizer-display-contract.test.ts" "tests/unit/prompt-optimizer-service-source-contract.test.ts" "tests/unit/canvas-live-scene-contract.test.ts" "tests/unit/canvas-visual-regression.test.ts" "tests/unit/ppt-deck-single-container-contract.test.ts" "tests/unit/ecommerce-card-thumbnail-labels.test.ts" "tests/unit/ecommerce-canvas-contract.test.ts" "tests/unit/ecommerce-display-label-surface.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/canvas/PromptNodeComponent.tsx" "tests/unit/prompt-node-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/canvas/PromptNodeComponent.tsx` matches. Because this is a visible component file, record browser smoke evidence after build even when the source cleanup is intended to be visual-no-op.

## SystemLogs Unused Cleanup Gate

Use this gate for the SystemLogs compiler-source cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/system-logs-unused-cleanup-contract.test.ts" "tests/unit/settings-workbench-ui-refit.test.ts" "tests/unit/settings-canonical-entry-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/settings/views/SystemLogsView.tsx" "src/components/settings/views/SystemLogsView.localized.tsx" "tests/unit/system-logs-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/settings/views/SystemLogsView` matches. Because this touches visible settings views, record browser smoke evidence after build even when the cleanup is intended to be visual-no-op.

## ProjectManager Unused Cleanup Gate

Use this gate for the ProjectManager prop-destructure cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/project-manager-unused-cleanup-contract.test.ts" "tests/unit/clay-frosted-surface-contract.test.ts" "tests/unit/theme-system-adaptation.test.ts" "tests/unit/workspace-layout-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/settings/ProjectManager.tsx" "tests/unit/project-manager-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/settings/ProjectManager.tsx` matches. Keep `ProjectManagerProps` compatibility declarations and do not change JSX, controls, visual styling, dropdown behavior, workflow UI, or canvas operations in this cleanup slice.

## Onboarding Unused Cleanup Gate

Use this gate for the AchievementToast and Onboarding residual compiler-source cleanup slices:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/onboarding-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/Onboarding/AchievementToast.tsx" "src/components/Onboarding/OnboardingManager.tsx" "src/components/Onboarding/OnboardingOverlay.tsx" "src/components/Onboarding/useOnboardingProgress.ts" "tests/unit/onboarding-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, filter the output and require zero `src/components/Onboarding` matches. Because this touches visible onboarding components, record browser smoke evidence after build even when the cleanup is intended to be visual-no-op.

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
npm.cmd run audit:dependencies
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
npm.cmd run audit:dependencies
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
npm.cmd run audit:dependencies
npm.cmd run governance:agent-docs
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

If UI files were touched since the last browser evidence, rerun the Clay UI contract suite and Codex in-app Browser QA before final sign-off. If only runtime/docs files were touched, record the browser skip reason in `status.md`.
