# KK-Studio v1.4.2 Single-Line Validation Matrix

Last updated: 2026-05-07

Use `npm.cmd` for npm scripts on Windows.

Current code baseline before M130 after the M129 keyManager update diagnostic redaction at `740042c1`: `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false` exits 0. The M130 OpenAI-compatible diagnostics prompt redaction keeps this probe clean. Historical per-slice notes that mention an expected noUnused failure describe older cleanup milestones; new cleanup/refactor/UI slices should keep this probe clean unless `status.md` records a fresh, unrelated blocker.

## M130 OpenAI-Compatible Diagnostics Prompt Redaction Gate

Use this gate when touching OpenAI-compatible diagnostics previews, request-body preview redaction, or diagnostic python snippets:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-diagnostics-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-sizing-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleDiagnostics.ts" `
  "tests/unit/openai-compatible-diagnostics-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it changes only service diagnostics metadata and no JSX, CSS, route rendering, browser-visible UI, or release metadata. Record the skip reason in `status.md`.

## User-Reported UI Regression Gate

Use this gate when touching the PromptBar shadows/mobile footer, settings shell/card chrome, ecommerce confirmed-build handoff, ecommerce canvas framework card, or ecommerce main-image ratio selector:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-footer-controls.test.ts" `
  "tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/app/useEcommerceBuildRuntime.ts" `
  "src/components/canvas/PromptNodeComponent.tsx" `
  "src/components/ecommerce/EcommerceCanvasWorkbenchCard.tsx" `
  "src/components/image/ImageOptionsPanel.tsx" `
  "src/components/layout/PromptBar.tsx" `
  "src/components/layout/prompt-bar/DesktopComposerModePanel.tsx" `
  "src/index.css" `
  "src/types.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-footer-controls.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/ecommerce-sheet-settings-runtime-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA is required for this gate. Use the Codex in-app Browser on the current local app and record URL, theme, desktop/mobile viewport or surface, PromptBar footer behavior, settings chrome/corner behavior, ecommerce framework card behavior when available, `.theme-transitioning`, stale chunk text count, and console error count in `status.md`.

## M129 KeyManager Update Diagnostic Redaction Gate

Use this gate when touching `keyManager.updateKey` diagnostics or key-manager secret redaction contracts:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/key-manager-channel-config-secrets-contract.test.ts" `
  "tests/unit/key-manager-credential-sanitizer-contract.test.ts" `
  "tests/unit/frontend-key-boundary-hardening.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/auth/keyManager.ts" `
  "src/services/auth/keyManagerUpdateDiagnostics.ts" `
  "tests/unit/key-manager-channel-config-secrets-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it changes only a key-manager console diagnostic payload and a focused helper, with no JSX, CSS, route rendering, browser-visible UI, or release metadata change. Record the skip reason in `status.md`.

## M128 Dead Gemini Cache And Prompt Logging Cleanup Gate

Use this gate when touching the dead Gemini response cache module, prompt-content diagnostics, or the storage unused-cleanup source contract:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/storage-service-unused-cleanup-contract.test.ts"
rg -n "geminiCache|GeminiCache|kk_studio_gemini_cache|services/storage/cache|storage/cache" src tests apps packages
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/storage/cache.ts" `
  "src/context/CanvasContext.tsx" `
  "tests/unit/storage-service-unused-cleanup-contract.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it removes a dead storage helper and redacts a console diagnostic without changing JSX, CSS, route rendering, browser-visible UI, or release metadata. Record the skip reason in `status.md`.

## M127 OpenAI-Compatible Image Reference Helper Gate

Use this gate when touching OpenAI-compatible reference-image formatting or chat image content-part helper ownership:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-image-references-contract.test.ts" `
  "tests/unit/openai-compatible-unused-cleanup-contract.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-sizing-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/openai-compatible-chat-payload-contract.test.ts" `
  "tests/unit/openai-compatible-google-extra-body-contract.test.ts" `
  "tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts" `
  "tests/unit/openai-compatible-acedata-route-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleImageReferences.ts" `
  "tests/unit/openai-compatible-image-references-contract.test.ts" `
  "tests/unit/openai-compatible-unused-cleanup-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper extraction and dead-comment cleanup with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change. Record the skip reason in `status.md`.

## M126 OpenAI-Compatible Image Payload Security Gate

Use this gate when touching image payload URL/MIME allowlisting:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-sizing-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/provider-surface-router.test.ts" `
  "tests/unit/provider-strategy.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/openAICompatibleImagePayload.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper hardening with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change. Record the skip reason in `status.md`.

## M125 OpenAI-Compatible 12AI Async And Chat Image Helper Gate

Use this gate when touching 12AI async route helper ownership or chat-image response extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-sizing-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/provider-surface-router.test.ts" `
  "tests/unit/provider-strategy.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatible12AIAsyncRoute.ts" `
  "src/services/llm/openAICompatibleImagePayload.ts" `
  "tests/unit/openai-compatible-twelve-ai-async-route-contract.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper extraction with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change. Record the skip reason in `status.md`.

## M124 OpenAI-Compatible AceData Route Helper Gate

Use this gate when touching AceData route/base-url/reference-image/image-size helper ownership:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-acedata-route-contract.test.ts" `
  "tests/unit/openai-compatible-wuyin-route-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/provider-surface-router.test.ts" `
  "tests/unit/provider-strategy.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleAceDataRoute.ts" `
  "tests/unit/openai-compatible-acedata-route-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper extraction with no JSX, CSS, route rendering, browser-visible behavior, or release metadata change. Record the skip reason in `status.md`.

## Post-M123 Settings UI Closure Gate

Use this gate when touching the already-dirty settings workbench shell/search/card flattening and M123 trace-contract follow-up:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts" `
  "tests/unit/settings-shell-scroll-regression.test.ts" `
  "tests/unit/settings-ui-density-regression.test.ts" `
  "tests/unit/settings-workbench-ui-refit.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/local-model-proxy-trace-contract.test.ts" `
  "tests/unit/secure-model-proxy-trace-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run spec:check
npm.cmd run governance:security
npm.cmd run audit:dependencies
npm.cmd run governance:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run verify:desktop-settings-smoke
npm.cmd run verify:mobile-settings-smoke
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/components/settings/views/DashboardView.localized.tsx" `
  "src/components/settings/views/SystemLogsView.localized.tsx" `
  "src/index.css" `
  "tests/unit/clay-frosted-surface-contract.test.ts" `
  "tests/unit/local-model-proxy-trace-contract.test.ts" `
  "tests/unit/secure-model-proxy-trace-contract.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts" `
  "tests/unit/settings-shell-scroll-regression.test.ts" `
  "tests/unit/settings-ui-density-regression.test.ts" `
  "tests/unit/settings-workbench-ui-refit.test.ts" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA is required because this slice touches visible settings UI. Record the Codex in-app Browser route, theme/surface, rendered controls, console error count, and any smoke-script fallback reason in `status.md`.

## M123 Local User-Route Task Token Helper Gate

Use this gate when touching local user-route task token helper ownership:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/local-user-route-task-token-contract.test.ts" `
  "tests/unit/local-user-route-task-signing-secret.test.ts" `
  "tests/unit/local-user-route-auth-contract.test.ts" `
  "tests/unit/local-user-route-endpoint-contract.test.ts" `
  "tests/unit/provider-auth-proxy-regression.test.ts" `
  "tests/unit/system-gemini-auth-regression.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts" `
  "tests/unit/async-image-proxy-regression.test.ts" `
  "tests/unit/user-route-proxy-routing.test.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts" `
  "apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run governance:security
npm.cmd run typecheck
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts" `
  "tests/unit/local-user-route-task-token-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI API helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change. Record the skip reason in `status.md`. If unrelated UI WIP is present, keep the M123 commit path-limited and record any full-unit blocker separately.

## M122 Local User-Route Task Signing Security Gate

Use this gate when touching local user-route task token signing or verification:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/local-user-route-task-signing-secret.test.ts" `
  "tests/unit/local-user-route-auth-contract.test.ts" `
  "tests/unit/local-user-route-endpoint-contract.test.ts" `
  "tests/unit/provider-auth-proxy-regression.test.ts" `
  "tests/unit/system-gemini-auth-regression.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts" `
  "tests/unit/async-image-proxy-regression.test.ts" `
  "tests/unit/user-route-proxy-routing.test.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts" `
  "apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run governance:security
npm.cmd run architecture:check
npm.cmd run audit:dependencies
npm.cmd run spec:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "apps/api/src/lib/server-runtime-config.ts" `
  "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts" `
  "tests/unit/local-user-route-task-signing-secret.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI API security hardening slice with no JSX, CSS, route rendering, or browser-visible behavior change. Record the skip reason in `status.md`.

## M121 OpenAI-Compatible Wuyin Route Helper Gate

Use this gate when touching the Wuyin route/base-url/reference-image/task-status helper boundary:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/openai-compatible-wuyin-route-contract.test.ts" `
  "tests/unit/openai-compatible-image-dispatch-contract.test.ts" `
  "tests/unit/provider-image-routing-regression.test.ts" `
  "tests/unit/openai-compatible-image-payload-contract.test.ts" `
  "tests/unit/openai-compatible-task-payload-contract.test.ts" `
  "tests/unit/provider-surface-router.test.ts" `
  "tests/unit/provider-strategy.test.ts" `
  "tests/unit/twelve-ai-doc-alignment.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/llm/OpenAICompatibleAdapter.ts" `
  "src/services/llm/openAICompatibleWuyinRoute.ts" `
  "tests/unit/openai-compatible-wuyin-route-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Browser QA may be skipped for this gate because it is a non-UI service/helper extraction with no JSX, CSS, route rendering, or browser-visible behavior change. Record the skip reason in `status.md`.

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

## Post-M120 UI Split Gate

Use this gate for the completed ecommerce canvas workbench, PromptBar mobile action, and settings workbench chrome split:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-build-visibility-localization-regression.test.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-group-shell-app-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-group-workbench.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/App.tsx" `
  "src/app/useEcommerceBuildRuntime.ts" `
  "src/components/canvas/PromptNodeComponent.tsx" `
  "src/components/ecommerce/EcommerceCanvasWorkbenchCard.tsx" `
  "src/components/layout/PromptBar.tsx" `
  "src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx" `
  "src/components/layout/prompt-bar/DesktopComposerModePanel.tsx" `
  "src/components/layout/prompt-bar/PromptBarFooterMobile.tsx" `
  "src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx" `
  "src/index.css" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-build-visibility-localization-regression.test.ts" `
  "tests/unit/ecommerce-group-shell-app-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-group-workbench.test.ts" `
  "tests/unit/prompt-bar-layout-regression.test.ts" `
  "tests/unit/settings-desktop-workbench-regression.test.ts"
```

Browser QA is required for this UI split. Record the Codex in-app Browser route, theme, `.theme-transitioning` count, stale chunk count, and console error count in `status.md`. If no seeded post-build ecommerce canvas fixture is available, record that limitation and keep the post-build canvas handoff covered by targeted source contracts.

## Ecommerce Requirement Analysis Fallback Gate

Use this gate when touching the ecommerce requirement-file analyzer client, especially static preview fallback, `.xlsx` local parsing, or upload endpoint response handling:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-analysis-client-fallback.test.ts" `
  "tests/unit/ecommerce-requirement-analysis-runtime-contract.test.ts" `
  "tests/unit/ecommerce-analysis-dev-proxy-contract.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/services/ecommerce/ecommerceAnalysisClient.ts" `
  "tests/unit/ecommerce-analysis-client-fallback.test.ts" `
  "validation.md" `
  "status.md"
```

Browser QA for this gate should verify the active app route loads without stale chunks or console errors. If the route is served from a static preview, record whether `/api/ecommerce-analysis` resolves to `200 text/html`; the automated fallback test covers that exact response shape for spreadsheet uploads.

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

## Secure Model Proxy Unused-Helper Cleanup Gate

Use this gate for the secure model proxy unused-helper cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/user-route-proxy-routing.test.ts" "tests/unit/secure-model-proxy-credit-contract.test.ts" "tests/unit/secure-model-proxy-trace-contract.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/local-model-proxy-trace-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/model/secureModelProxy.ts" "tests/unit/user-route-proxy-routing.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require that `src/services/model/secureModelProxy.ts` has no `buildInvocationError` diagnostic and only the two source-contracted local route gate diagnostics remain. Do not change local/system proxy endpoints, route-gate helper bodies, session/auth invalidation, retry behavior, provider routing, API/settings surfaces, billing/payment behavior, keyManager secret storage, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## User API Profile Import-Only Cleanup Gate

Use this gate for the user API profile import-only cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/runtime-legacy-fallback-guards.test.ts" "tests/unit/user-api-runtime-fallback.test.ts" "tests/unit/user-api-profile-storage-runtime-fallback.test.ts" "tests/unit/user-api-profile-storage-local-only.test.ts" "tests/unit/user-api-profile-storage-local-priority.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/api/userApiProfileStorage.ts" "tests/unit/runtime-legacy-fallback-guards.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/api/userApiProfileStorage.ts` diagnostics. Do not change typed auth API payload loading, local bridge reads/writes, cloud merge behavior, secret redaction behavior, provider routing, API/settings surfaces, billing/payment behavior, keyManager secret storage, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## UserProfileModal Billing Alias Cleanup Gate

Use this gate for the UserProfileModal stale billing alias cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/local-runtime-consistency-contract.test.ts" "tests/unit/kkai-billing-ui-surface.test.ts" "tests/unit/billing-remaining-balance-contract.test.ts" "tests/unit/user-profile-modal-auth-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/modals/UserProfileModal.tsx" "tests/unit/local-runtime-consistency-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/components/modals/UserProfileModal.tsx` diagnostics and no `billingFeatureEnabled` source matches. Because a UI component file is touched, run local browser QA before commit when the browser target is available. Do not change `BillingContext`, recharge services, balance/refund behavior, `KKAI_FEATURE_FLAGS.billing` semantics, provider routing, API/settings surfaces, keyManager secret storage, storage persistence, release metadata, or JSX/CSS in this cleanup slice.

## User API Cloud Helper Cleanup Gate

Use this gate for the user API cloud helper cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/runtime-legacy-fallback-guards.test.ts" "tests/unit/user-api-cloud-storage.test.ts" "tests/unit/user-api-profile-storage-runtime-fallback.test.ts" "tests/unit/user-api-profile-storage-local-only.test.ts" "tests/unit/user-api-profile-storage-local-priority.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/api/userApiCloudRecordStorage.ts" "tests/unit/runtime-legacy-fallback-guards.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/api/userApiCloudRecordStorage.ts` diagnostics and no `function getErrorMessage(` source match in that file. Do not change typed auth payload loading, local API fallback, cache behavior, payload compaction, secret redaction, provider routing, API/settings surfaces, billing/payment behavior, keyManager secret storage, storage persistence, release metadata, or browser-visible UI in this cleanup slice.

## NewAPI Management Service Unused Cleanup Gate

Use this gate for the NewAPI management service unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/billing-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/billing/newApiManagementService.ts" "tests/unit/billing-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/billing/newApiManagementService.ts` diagnostics, no stale `notify` import, and no unread `const channels = await this.getAllChannels();` binding. Preserve the `getAllChannels()` preflight side effect, `/api/channel/balance` request, `channels` cache key update, returned `updatedChannels` shape, NewAPI auth/header behavior, provider routing, API/settings surfaces, billing/payment behavior, storage persistence, release metadata, and browser-visible UI.

## Recharge Submission Service Unused Cleanup Gate

Use this gate for the recharge submission service unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/billing-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/billing/rechargeSubmissionService.ts" "tests/unit/billing-service-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/billing/rechargeSubmissionService.ts` diagnostics and no `function normalizeRechargePaymentChannelConfig(` source match. Preserve recharge bill/request construction, proof submission, route client behavior, default payment-channel config builder, `qrDisplay` mapping, channel list fallback behavior, billing/payment business logic, provider routing, API/settings surfaces, storage persistence, release metadata, and browser-visible UI.

## Storage Adapter Unused Cleanup Gate

Use this gate for the storage adapter unused cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/storage-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/storage/storageAdapter.ts" "tests/unit/storage-service-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/storage/storageAdapter.ts` diagnostics and no `compressIfNeeded` source match. Preserve OPFS/native/indexeddb import behavior, `getImageDimensionsFromFile` fallback semantics, `importImages` mode branching, `deleteImage` cleanup, and browser-visible storage behavior.

## Storage Preference Unused Cleanup Gate

Use this gate for the storage preference unused parameter cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/storage-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/storage/storagePreference.ts" "tests/unit/storage-service-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/storage/storagePreference.ts` diagnostics and require `saveOriginalToLocalFolder` to keep the third argument slot as `_prompt?: string`. Preserve local-folder write behavior, existing timestamp filename generation, `mergeStorages()` call shape, storage mode behavior, provider routing, API/settings surfaces, keyManager secret storage, release metadata, and browser-visible UI.

## Image Storage Unused Cleanup Gate

Use this gate for the image storage unused local cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/storage-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/storage/imageStorage.ts" "tests/unit/storage-service-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/storage/imageStorage.ts` diagnostics and require `cleanupOriginals()` to avoid reacquiring an unread IndexedDB handle. Preserve batch image pagination, compression, `saveImage` updates, saved-byte accounting, storage mode behavior, provider routing, API/settings surfaces, keyManager secret storage, release metadata, and browser-visible UI.

## Google Adapter Import Cleanup Gate

Use this gate for the Google adapter import-only cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/llm-adapter-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/GoogleAdapter.ts" "tests/unit/llm-adapter-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/llm/GoogleAdapter.ts` diagnostics and require `generateVideo()` to keep its inline `import('./LLMAdapter').VideoGenerationOptions` / `VideoGenerationResult` type references. Preserve Google/Gemini chat, image, audio, video request behavior, 12AI gateway handling, provider routing, API/settings surfaces, keyManager secret storage, release metadata, and browser-visible UI.

## Gemini Service Unused Cleanup Gate

Use this gate for the Gemini service import/helper cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/llm-service-unused-cleanup-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/geminiService.ts" "tests/unit/llm-service-unused-cleanup-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/services/llm/geminiService.ts` diagnostics and preserve `calculateCost(...)`, `classifyApiFailure`, `logError`, `getImage`, `llmService.generateImage(llmOptions)`, and the secure-proxy error helpers. Browser QA may be skipped for this slice because it is a non-UI service cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.

## Image Generation Hook Unused Cleanup Gate

Use this gate for the `useImageGeneration` unused-code cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/image-generation-unused-cleanup-contract.test.ts" "tests/unit/generation-billing-runtime-contract.test.ts" "tests/unit/generation-runtime-contract.test.ts" "tests/unit/ecommerce-structured-task-source-contract.test.ts" "tests/unit/partial-redraw-pipeline-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/hooks/useImageGeneration.ts" "tests/unit/image-generation-unused-cleanup-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/hooks/useImageGeneration.ts` diagnostics and preserve `saveOriginalImage`, `getImage`, `normalizePersistableMediaSource`, generation billing coordinator calls, sync bridge recovery, generated-media persistence, and pending-task state transitions. Browser QA may be skipped because this slice removes dead hook bindings only and does not change JSX, CSS, route rendering, or browser-visible UI behavior.

## API Settings Unused Cleanup Gate

Use this gate for the `ApiSettingsView` unused-code cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/api-settings*.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/settings-workbench-ui-refit.test.ts" "tests/unit/settings-canonical-entry-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/components/settings/ApiSettingsView.tsx" "tests/unit/api-settings-unused-cleanup-contract.test.ts" "tests/unit/api-settings-view-source-guard.test.ts" "tests/unit/api-settings-encoding-guard.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while broader TS6133/TS619x debt remains outside this slice; for this gate, require zero `src/components/settings/ApiSettingsView.tsx` diagnostics and preserve API settings route visibility, readonly snapshot behavior, BYOK persistence, source encoding guards, and settings workbench contracts. Because this touches a visible settings view, run browser smoke after build when a local browser target is available.

## keyManager Unused Cleanup Gate

Use this gate for the `keyManager.ts` compiler-proven unused binding cleanup slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/google-official-gemini-protocol-guards.test.ts tests/unit/key-manager-dead-code-pruning-contract.test.ts tests/unit/key-manager-model-helpers-contract.test.ts
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager*.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts" "tests/unit/runtime-legacy-fallback-guards.test.ts" "tests/unit/route-aware-credit-billing.test.ts" "tests/unit/generation-runtime-contract.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "tests/unit/key-manager-dead-code-pruning-contract.test.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/google-official-gemini-protocol-guards.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe is still expected to fail while the two source-contracted `src/services/model/secureModelProxy.ts` route-gate helper diagnostics remain outside this slice; for this gate, require zero `src/services/auth/keyManager.ts` diagnostics. Preserve `keyManagerModelHelpers.ts` compatibility re-exports, key storage, provider credential values, provider persistence, cloud payload shape, storage persistence, route selection behavior, release metadata, UI surfaces, and generation/PPT runtime behavior. Browser QA may be skipped because this is a non-UI service/source-contract cleanup with no JSX, CSS, route rendering, or browser-visible behavior change.

## secureModelProxy Route Gate Wiring Gate

Use this gate for the `secureModelProxy.ts` route-gate helper wiring slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/user-route-proxy-routing.test.ts tests/unit/secure-model-proxy-credit-contract.test.ts tests/unit/frontend-key-boundary-hardening.test.ts
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/model/secureModelProxy.ts" "tests/unit/user-route-proxy-routing.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

The `npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true` probe should now pass cleanly for this slice because the only two secure proxy route-gate helpers are read from the live entrypoints. Preserve the current local user-route and local system proxy behavior, the no-browser-direct / no-stale-fallback contracts, billing metadata propagation, session invalidation behavior, provider routing, release metadata, and browser-visible UI.

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

## OpenAI-Compatible Gemini Image Sizing Helper Gate

Use this gate when touching Gemini image-size or requested aspect-ratio normalization for OpenAI-compatible image routes:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-image-payload-contract.test.ts" "tests/unit/openai-compatible-image-dispatch-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/provider-channel-surface-view.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleImageSizing.ts" "tests/unit/openai-compatible-image-sizing-contract.test.ts" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser QA may be skipped for this slice because it moves pure service normalization helpers with no JSX, CSS, route rendering, or browser-visible behavior change.

## OpenAI-Compatible Google Extra Body Helper Gate

Use this gate when touching New API Google `extra_body` construction or merge behavior for OpenAI-compatible routes:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-google-extra-body-contract.test.ts" "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-image-payload-contract.test.ts" "tests/unit/openai-compatible-image-dispatch-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/provider-channel-surface-view.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleGoogleExtraBody.ts" "tests/unit/openai-compatible-google-extra-body-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser QA may be skipped for this slice because it moves pure service helper logic with no JSX, CSS, route rendering, or browser-visible behavior change.

## OpenAI-Compatible Chat Payload Helper Gate

Use this gate when touching OpenAI-compatible chat message construction or chat-completions request body construction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-chat-payload-contract.test.ts" "tests/unit/openai-compatible-google-extra-body-contract.test.ts" "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-task-payload-contract.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleChatPayload.ts" "tests/unit/openai-compatible-chat-payload-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser QA may be skipped for this slice because it moves pure service helper logic with no JSX, CSS, route rendering, or browser-visible behavior change.

Use this gate for OpenAI-compatible adapter structural slices, including diagnostics preview helper extraction, image-routing error classifier extraction, unreachable image fallback cleanup, the M107 image-dispatch helper extraction, the M108 image-payload helper extraction, and the M109 image-sizing helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-image-payload-contract.test.ts" "tests/unit/openai-compatible-image-dispatch-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/openai-compatible-diagnostics-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tests/unit/provider-surface-router.test.ts" "tests/unit/provider-strategy.test.ts" "tests/unit/provider-channel-surface-view.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
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
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/llm/OpenAICompatibleAdapter.ts" "src/services/llm/openAICompatibleDiagnostics.ts" "src/services/llm/openAICompatibleImageDispatch.ts" "src/services/llm/openAICompatibleImagePayload.ts" "src/services/llm/openAICompatibleImageSizing.ts" "src/services/llm/openAICompatibleImageRoutingErrors.ts" "tests/unit/openai-compatible-diagnostics-contract.test.ts" "tests/unit/openai-compatible-image-dispatch-contract.test.ts" "tests/unit/openai-compatible-image-payload-contract.test.ts" "tests/unit/openai-compatible-image-sizing-contract.test.ts" "tests/unit/openai-compatible-image-routing-errors-contract.test.ts" "tests/unit/provider-image-routing-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

## Local User-Route Auth Helper Gate

Use this gate for the M112 server-side local user-route auth/header/query-key helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/local-user-route-auth-contract.test.ts" "tests/unit/provider-auth-proxy-regression.test.ts" "tests/unit/system-gemini-auth-regression.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/user-route-proxy-routing.test.ts" "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts" "apps/api/src/modules/model-proxy/application/local-user-route-auth.ts" "tests/unit/local-user-route-auth-contract.test.ts" "tests/unit/provider-auth-proxy-regression.test.ts" "tests/unit/system-gemini-auth-regression.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Do not change endpoint selection, fetch execution, task operation routing, credential retrieval/storage, keyManager/cloud sync, provider branch execution, fallback ordering, billing metadata, release metadata, or UI behavior in this slice. Browser QA may be skipped for this non-UI server/helper extraction after recording the skip reason in `status.md`.

## Local User-Route Endpoint Helper Gate

Use this gate for the M113 server-side local user-route direct endpoint URL normalization helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/local-user-route-endpoint-contract.test.ts" "tests/unit/local-user-route-auth-contract.test.ts" "tests/unit/provider-auth-proxy-regression.test.ts" "tests/unit/system-gemini-auth-regression.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tests/unit/user-route-proxy-routing.test.ts" "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts" "apps/api/src/modules/model-proxy/application/local-user-route-auth.ts" "apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts" "tests/unit/local-user-route-endpoint-contract.test.ts" "tests/unit/local-user-route-auth-contract.test.ts" "tests/unit/provider-auth-proxy-regression.test.ts" "tests/unit/system-gemini-auth-regression.test.ts" "tests/unit/twelve-ai-doc-alignment.test.ts" "tests/unit/async-image-proxy-regression.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Do not change auth/header/query-key behavior, endpoint call-site behavior, fetch behavior, task operation routing, credential retrieval/storage, keyManager/cloud sync, provider branch execution, fallback ordering, logging, billing metadata, release metadata, or UI behavior in this slice. Browser QA may be skipped for this non-UI server/helper extraction after recording the skip reason in `status.md`.

## Post-M113 Review Fix Gate

Use this gate for the review-fix/gate-repair closeout that touches auth signing, system proxy task signing, Postgres session rotation, release guardrails, OCR defaults, and canvas id forwarding:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/workspace-auth-gate.test.ts" "tests/unit/ocr-service-settings-contract.test.ts" "tests/unit/local-env-contract.test.ts" "tests/unit/portable-payment-package-contract.test.ts" "tests/unit/portable-app-server-document-proxy-contract.test.ts" "tests/unit/hosted-release-guardrails.test.ts" "tests/unit/vps-postgres-audit-contract.test.ts" "tests/unit/postgres-user-session-repository.test.ts" "tests/unit/kk-session-token.test.ts" "tests/unit/request-authenticator.test.ts" "apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts" "tests/unit/canvas-live-unused-cleanup-contract.test.ts" "tests/unit/ecommerce-wheel-scroll-guard.test.ts" "tests/unit/governance-contract.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run spec:check
npm.cmd run governance:check
npm.cmd run audit:dependencies
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- ".env.example" "apps/api/sql/bootstrap-self-hosted-postgres.sql" "apps/api/src/modules/auth/infrastructure/kk-session-token.ts" "apps/api/src/modules/auth/infrastructure/postgres-user-session-repository.ts" "apps/api/src/modules/model-proxy/application/local-system-proxy-service.ts" "apps/api/src/modules/model-proxy/application/local-system-proxy-service.test.ts" "scripts/postgres/bootstrap-kk-vps.sql" "scripts/release-hosted.mjs" "scripts/release/create-portable-release.mjs" "scripts/release/portable-app-server.cjs" "scripts/test/set-log-level.mjs" "src/app/authGate.ts" "src/app/AuthenticatedAppShell.tsx" "src/components/canvas/InfiniteCanvas.tsx" "src/services/document/nutrientDocumentService.ts" "tests/unit" "plans.md" "implement.md" "validation.md" "status.md"
```

Because this gate touches `src/components/canvas/InfiniteCanvas.tsx`, browser QA is mandatory. Record the in-app Browser URL, title, visible `#canvas-container`, root count, and console error count in `status.md`.

## Legacy Payment-Server Security Gate

Use this gate when touching legacy `payment-server` callback configuration, WeChat Pay webhook validation, or legacy payment return/notify URL defaults:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/payment-server-legacy-security-contract.test.ts" "tests/unit/payment-webhook-wechat-raw-body.test.ts" "tests/unit/payment-webhook-fail-closed.test.ts" "tests/unit/payment-runtime-hardening.test.ts"
npm.cmd run typecheck:payment-server
node scripts/ci/check-tests-types.mjs tsconfig.tests.json
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
npm.cmd run governance:security
npm.cmd run audit:dependencies
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "payment-server/index.js" "payment-server/webhook.js" "tests/unit/payment-server-legacy-security-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Browser QA may be skipped for this slice because it hardens the legacy payment server and tests request/server behavior without JSX, CSS, route rendering, or browser-visible UI changes.

## keyManager Shared Pricing Helper Gate

Use this gate for the M114 shared pricing catalog/snapshot helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-shared-pricing-contract.test.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/key-manager-pricing-url-contract.test.ts" "tests/unit/key-manager-provider-persistence-contract.test.ts" "tests/unit/key-manager-provider-usage-contract.test.ts" "tests/unit/key-manager-runtime-fallback.test.ts" "tests/unit/user-api-cloud-storage.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerSharedPricing.ts" "tests/unit/key-manager-shared-pricing-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Do not change provider fetches, provider persistence, cloud sync, key storage, route selection, runtime model resolution, localStorage policy, release metadata, or UI behavior in this slice. Browser QA may be skipped for this non-UI service/helper extraction after recording the skip reason in `status.md`.

## keyManager Remote Model Discovery Helper Gate

Use this gate for the M115 remote model discovery response parsing helper extraction:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-remote-model-discovery-contract.test.ts"
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/key-manager-remote-model-discovery-contract.test.ts" "tests/unit/key-manager-model-helpers-contract.test.ts" "tests/unit/key-manager-model-list-contract.test.ts" "tests/unit/key-manager-shared-pricing-contract.test.ts" "tests/unit/key-manager-pricing-url-contract.test.ts" "tests/unit/key-manager-api-type-contract.test.ts" "tests/unit/google-official-gemini-protocol-guards.test.ts" "tests/unit/frontend-key-boundary-hardening.test.ts"
npx.cmd tsc --noEmit --noUnusedLocals true --noUnusedParameters true --pretty false
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- "src/services/auth/keyManager.ts" "src/services/auth/keyManagerRemoteModelDiscovery.ts" "tests/unit/key-manager-remote-model-discovery-contract.test.ts" "tsconfig.tests.json" "plans.md" "implement.md" "validation.md" "status.md"
```

Do not change provider fetch execution, endpoint selection, auth/header/query-key behavior, provider persistence, cloud sync, key storage, route selection, runtime model resolution, localStorage policy, release metadata, or UI behavior in this slice. Browser QA may be skipped for this non-UI service/helper extraction after recording the skip reason in `status.md`.

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

## M116 Ecommerce Visibility Localization Gate

Use this gate for the active ecommerce visibility/localization UI closure slice:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-node-updates-contract.test.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-build-visibility-localization-regression.test.ts" `
  "tests/unit/ecommerce-button-guards.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts" `
  "tests/unit/ecommerce-canvas-flow-contract.test.ts" `
  "tests/unit/ecommerce-framework-contract.test.ts" `
  "tests/unit/ecommerce-framework-runtime-state-contract.test.ts" `
  "tests/unit/ecommerce-group-shell-app-contract.test.ts" `
  "tests/unit/ecommerce-runtime-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-group-workbench.test.ts" `
  "tests/unit/mobile-ecommerce-continuation-surface.test.ts" `
  "tests/unit/mobile-result-feed-detail-contract.test.ts" `
  "tests/unit/mobile-workspace-surface-contract.test.ts"
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
git --git-dir=node_modules/.codex-git-full --work-tree=. diff --check -- `
  "src/App.tsx" `
  "src/app/useEcommerceBuildRuntime.ts" `
  "src/app/useEcommerceRuntime.ts" `
  "src/app/usePromptGroupLayout.ts" `
  "src/components/ecommerce/EcommerceCardActions.tsx" `
  "src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx" `
  "src/components/mobile/MobileResultDetailScreen.tsx" `
  "src/components/mobile/MobileResultFeed.tsx" `
  "src/context/CanvasContext.tsx" `
  "tests/unit/canvas-node-updates-contract.test.ts" `
  "tests/unit/ecommerce-build-runtime-contract.test.ts" `
  "tests/unit/ecommerce-build-visibility-localization-regression.test.ts" `
  "tests/unit/ecommerce-button-guards.test.ts" `
  "tests/unit/ecommerce-canvas-contract.test.ts" `
  "tests/unit/ecommerce-canvas-flow-contract.test.ts" `
  "tests/unit/ecommerce-framework-contract.test.ts" `
  "tests/unit/ecommerce-framework-runtime-state-contract.test.ts" `
  "tests/unit/ecommerce-group-shell-app-contract.test.ts" `
  "tests/unit/ecommerce-runtime-contract.test.ts" `
  "tests/unit/prompt-bar-ecommerce-framework-companion.test.ts" `
  "tests/unit/prompt-bar-ecommerce-group-workbench.test.ts" `
  "tests/unit/mobile-ecommerce-continuation-surface.test.ts" `
  "tests/unit/mobile-result-feed-detail-contract.test.ts" `
  "tests/unit/mobile-workspace-surface-contract.test.ts" `
  "tsconfig.tests.json" `
  "plans.md" `
  "implement.md" `
  "validation.md" `
  "status.md"
```

Because this slice touches visible UI, record Codex in-app Browser evidence in `status.md`: URL, viewport, theme, ecommerce/mobile surface checked, `.theme-transitioning`, stale chunk text count, and console error count.

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
