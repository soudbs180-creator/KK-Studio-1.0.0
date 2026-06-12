# Session Handoff - UI System Optimization and Runtime Governance

**Last Updated:** 2026-06-12
**Version:** KK Studio v1.5.6

## 2026-06-12 - AI Management Skill Modal Layer Pass

### AI Management Modal Change Scope
- Migrated the `AiManagementView` Skill configuration modal from private `z-[3000]`, `bg-black/60`, `backdrop-blur-md`, and `shadow-2xl` shell styling to `KK_LAYER.modalBackdrop` plus the shared settings modal primitives.
- Added dialog semantics for the Skill modal through `role="dialog"`, `aria-modal="true"`, and a stable `settings-ai-skill-modal-title` label.
- Preserved Skill create, edit, save, delete, notification, and `KnowledgeStore` behavior. This pass only changes the modal shell and layer system.

### AI Management Modal Files Changed
- `apps/web/src/components/settings/views/AiManagementView.tsx`
- `tests/unit/settings-modal-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### AI Management Modal Current Design Decisions
- Settings-adjacent feature modals should use `SETTINGS_MODAL_BACKDROP_CLASSNAME`, `SETTINGS_MODAL_PANEL_CLASSNAME`, and `KK_LAYER.modalBackdrop`, even when the view lives under a nested `settings/views/` route.
- Settings modal material belongs to the global primitive in `kk-ui-tokens.css` and scoped settings compatibility rules in `settings.css`; feature views should not carry private backdrop, blur, or large shadow utilities.
- The Skill editor remains a local modal component because its state and validation are specific to `AiManagementView`; only the outer shell is shared.

### AI Management Modal Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-modal-ui-system-contract.test.ts`: red first for missing `KK_LAYER` import in `AiManagementView`, then 6 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-modal-ui-system-contract.test.ts tests/unit/settings-ui-system-contract.test.ts tests/unit/settings-entry-surface-style-regression.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts`: 26 tests passed.
- `rg -n "z-\[3000\]|bg-black/60|backdrop-blur-md|shadow-2xl|SETTINGS_ELEVATED_STYLE" apps/web/src/components/settings/views/AiManagementView.tsx`: no matches.
- `Select-String -Path apps/web/src/components/settings/views/AiManagementView.tsx -Pattern 'KK_LAYER','SETTINGS_MODAL_BACKDROP_CLASSNAME','SETTINGS_MODAL_PANEL_CLASSNAME','settings-ai-skill-modal-title','role="dialog"','aria-modal="true"'`: found the migrated layer, primitive, and dialog semantics.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 426 test files typechecked.
- `npm.cmd run architecture:check`: passed; `AiManagementView.tsx` is no longer listed in the raw z-index warnings.
- `npm.cmd run build`: passed.
- Build artifact check: `rg -n "settings-system-modal-backdrop|settings-system-modal-panel|settings-ai-skill-modal-title|modalBackdrop" apps/web/dist/assets -g "AiManagementView-*.js" -g "*.css"` found the shared settings modal class and labelled dialog output in generated assets.
- Runtime smoke: short-lived Vite job on `http://127.0.0.1:5197/settings` returned `status=200`, `length=4989`, and `root=True`, then was stopped.

### AI Management Modal Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still progressing through scoped system passes.
- Browser screenshot QA remains blocked/unavailable in this local session; HTTP smoke, build artifact inspection, contract tests, architecture, typecheck, and build were used as fallback evidence.

### AI Management Modal Risks And Next Steps
- `apps/web/src/components/settings/ui/index.tsx` still has a raw `z-[100]` dropdown layer and should become a reusable settings control menu layer.
- Mobile shell surfaces (`MobileMoreMenu`, `MobileTabBar`, `MobileWorkspaceQuickBar`, `MobileEcommercePanel`) still own raw layer values and should be grouped into a mobile chrome layer pass.
- `AdminRechargeFloatingPanel`, `PromptBar`, `DesktopComposerModePanel`, and `ui/sign-up.tsx` still appear in raw layer warnings and need separate scoped passes.

## 2026-06-12 - Account Billing Mobile Modal Layer Pass

### Account Billing Modal Change Scope
- Migrated the mobile wrappers in `RechargeModal` and `UserProfileModal` from private `z-[10001]`, `bg-black/60`, `backdrop-blur-sm`, and private mobile panel shadow/background styling to `KK_LAYER.modalBackdrop` plus the shared `kk-canvas-modal-*` primitives.
- Preserved the desktop `KkModal` path and left recharge, payment, auth, and profile business logic unchanged.
- Extended the canvas modal UI-system contract so account and billing mobile modal wrappers are covered by the same shared primitive rules as canvas utility modals.

### Account Billing Modal Files Changed
- `apps/web/src/components/modals/RechargeModal.tsx`
- `apps/web/src/components/modals/UserProfileModal.tsx`
- `tests/unit/canvas-modal-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Account Billing Modal Current Design Decisions
- Account and billing mobile modal wrappers should consume the same canvas modal shell primitive as utility modals; larger billing and profile internals remain separate product surfaces.
- `kk-canvas-modal-panel` owns the mobile shell border, background, blur, and shadow. The React wrapper owns only layout, propagation, and lifecycle behavior.
- `KK_LAYER.modalBackdrop` is the layer source of truth for these mobile overlays instead of private high-z Tailwind utilities.

### Account Billing Modal Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-modal-ui-system-contract.test.ts`: red first for missing `KK_LAYER` import in `RechargeModal`, then 3 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-modal-ui-system-contract.test.ts tests/unit/kkai-billing-ui-surface.test.ts tests/unit/billing-remaining-balance-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/user-profile-modal-auth-contract.test.ts tests/unit/runtime-auth-types-contract.test.ts`: 22 tests passed.
- `rg -n "z-\[10001\]|bg-black/60|backdrop-blur-sm|background:\s*'color-mix\(in srgb, var\(--frost-card-framework-bg\) 88%, #0f1115\)'|shadow-2xl" apps/web/src/components/modals/RechargeModal.tsx apps/web/src/components/modals/UserProfileModal.tsx`: no matches.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 426 test files typechecked.
- `npm.cmd run architecture:check`: passed; `RechargeModal.tsx` and `UserProfileModal.tsx` are no longer listed in the raw z-index warnings.
- `npm.cmd run build`: passed.
- Runtime smoke: short-lived Vite job on `http://127.0.0.1:5196/` returned `status=200`, `length=4989`, and `root=True`, then was stopped.
- Build artifact check: `rg -n "kk-canvas-modal-backdrop|kk-canvas-modal-panel|KK_LAYER|modalBackdrop" apps/web/dist/assets -g "RechargeModal-*.js" -g "UserProfileModal-*.js" -g "*.css"` found the shared modal classes in the generated assets.

### Account Billing Modal Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still progressing through scoped system passes.
- Browser screenshot QA remains blocked/unavailable in this local session; HTTP smoke, build artifact inspection, contract tests, architecture, typecheck, and build were used as fallback evidence.

### Account Billing Modal Risks And Next Steps
- `AiManagementView` still has a settings-adjacent raw `z-[3000]` overlay and should be migrated into the settings or canvas modal primitive vocabulary.
- Mobile shell surfaces (`MobileMoreMenu`, `MobileTabBar`, `MobileWorkspaceQuickBar`, `MobileEcommercePanel`) still own raw layer values and should be grouped into a mobile chrome layer pass.
- `AdminRechargeFloatingPanel`, `PromptBar`, `DesktopComposerModePanel`, and `ui/sign-up.tsx` still appear in raw layer warnings and need separate scoped passes.

## 2026-06-12 - Canvas Modal UI System Pass

### Canvas Modal Change Scope
- Added the global `kk-canvas-modal-backdrop` and `kk-canvas-modal-panel` primitives to `kk-ui-tokens.css` for canvas utility dialogs.
- Migrated `MigrateModal`, `StorageSelectionModal`, and `TagInputModal` from private high z-index overlay styling to `KK_LAYER.modalBackdrop` plus the shared canvas modal primitives.
- Preserved `StorageSelectionModal`'s light/dark overlay contract by mapping `.storage-selection-modal.kk-canvas-modal-backdrop` back to `--storage-selection-overlay-bg`.
- Updated Clay and storage surface contracts so class-based primitives and token mappings are the source of truth instead of requiring frosted material tokens inline in TSX.

### Canvas Modal Files Changed
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/modals/MigrateModal.tsx`
- `apps/web/src/components/modals/StorageSelectionModal.tsx`
- `apps/web/src/components/modals/TagInputModal.tsx`
- `tests/unit/canvas-modal-ui-system-contract.test.ts`
- `tests/unit/clay-frosted-surface-contract.test.ts`
- `tests/unit/settings-entry-surface-style-regression.test.ts`
- `docs/development/session-handoff.md`

### Canvas Modal Current Design Decisions
- Canvas utility modals should use `KK_LAYER.modalBackdrop` and the shared canvas modal primitive rather than `z-[10001]`, `z-[3000]`, `bg-black/60`, `backdrop-blur-sm`, or inline black overlay colors.
- Common modal shell material belongs in `kk-ui-tokens.css`; feature-specific variants can override via CSS variables while keeping the same primitive class.
- This pass intentionally did not touch billing/profile modal business flows because those are larger surfaces with payment/profile state and should be handled in a separate focused pass.

### Canvas Modal Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-modal-ui-system-contract.test.ts`: red first for missing canvas modal primitives and missing `KK_LAYER`, then 2 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-modal-ui-system-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/settings-entry-surface-style-regression.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts`: 26 tests passed.
- `rg -n "z-\[(?:10001|3000)\]|bg-black/60|backdrop-blur-sm|backgroundColor:\s*'rgba\(0,\s*0,\s*0,\s*0\.5\)'" apps/web/src/components/modals/MigrateModal.tsx apps/web/src/components/modals/StorageSelectionModal.tsx apps/web/src/components/modals/TagInputModal.tsx`: no matches.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 426 test files typechecked.
- `npm.cmd run architecture:check`: passed; `MigrateModal.tsx`, `StorageSelectionModal.tsx`, and `TagInputModal.tsx` are no longer listed in the raw z-index warnings.
- `npm.cmd run build`: passed.
- Runtime smoke: short-lived Vite job on `http://127.0.0.1:5195/` returned `status=200`, `length=4989`, and `root=True`, then was stopped. `npm.cmd run dev:status` confirmed no residual Vite/API processes.
- Build artifact check: `rg -n "kk-canvas-modal-backdrop|kk-canvas-modal-panel|--kk-canvas-modal-panel-bg" apps/web/dist/assets -g "*.css"` found the primitive in the generated CSS.

### Canvas Modal Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still progressing through scoped system passes.
- Browser screenshot QA remains blocked/unavailable in this local session; HTTP smoke, build artifact inspection, contract tests, architecture, typecheck, and build were used as fallback evidence.

### Canvas Modal Risks And Next Steps
- `RechargeModal` and `UserProfileModal` still carry `z-[10001]`, `bg-black/60`, and `backdrop-blur-sm`; they are the next common modal targets.
- `AiManagementView` still has a settings-adjacent `z-[3000]` overlay and should be migrated into the settings/canvas modal primitive vocabulary.
- Mobile shell surfaces (`MobileMoreMenu`, `MobileTabBar`, `MobileWorkspaceQuickBar`, `MobileEcommercePanel`) still own raw layer values and should be grouped into a mobile chrome layer pass.

## 2026-06-12 - Project Manager Modal Layer Pass

### Project Manager Modal Change Scope
- Migrated the ProjectManager delete-confirm and merge-project modals from private `z-[100]` / `z-[101]`, `bg-black/60`, and `backdrop-blur-md` overlay styling to `KK_LAYER.modalBackdrop` plus the shared settings modal primitives.
- Moved the global `settings-system-modal-backdrop` and `settings-system-modal-panel` primitive definitions into `kk-ui-tokens.css`, while keeping scoped `.settings-panel` compatibility styles in `settings.css`.
- Added dialog semantics for both destructive project modals through `role="dialog"`, `aria-modal="true"`, and stable labelled title ids.
- Updated the Clay frosted surface contract so SearchPalette is checked through its current `kk-search-palette-*` CSS primitive and token mapping instead of stale inline frosted token assertions.

### Project Manager Modal Files Changed
- `apps/web/src/components/settings/ProjectManager.tsx`
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/styles/settings.css`
- `tests/unit/settings-modal-ui-system-contract.test.ts`
- `tests/unit/clay-frosted-surface-contract.test.ts`
- `docs/development/session-handoff.md`

### Project Manager Modal Current Design Decisions
- Settings-adjacent destructive modals should consume `KK_LAYER.modalBackdrop` and the settings modal primitive rather than carrying private Tailwind layer utilities.
- Portal-mounted settings dialogs must be supported by global primitive selectors in `kk-ui-tokens.css`, because `.settings-panel .settings-system-modal-*` does not apply once the modal is rendered into `document.body`.
- `settings.css` can still scope or specialize settings surfaces, but cross-route or portal primitives must live in the globally imported token stylesheet.
- ProjectManager's dropdowns and workflow menus were not changed in this pass; this pass only handles the full-screen destructive modal layer conflict.
- SearchPalette remains a class-based system surface: TSX owns `kk-search-palette-*` primitives, while `kk-ui-tokens.css` owns the frosted token mapping.

### Project Manager Modal Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-modal-ui-system-contract.test.ts`: red first for the ProjectManager layer contract and global primitive stylesheet contract, then 5 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-modal-ui-system-contract.test.ts tests/unit/project-manager-unused-cleanup-contract.test.ts tests/unit/canvas-snap-to-grid-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts`: 20 tests passed.
- `rg -n "z-\[100\]|z-\[101\]|bg-black/60|backdrop-blur-md" apps/web/src/components/settings/ProjectManager.tsx`: no matches.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 425 test files typechecked.
- `npm.cmd run architecture:check`: passed; existing raw color and raw z-index warning lists remain outside this pass, and `ProjectManager.tsx` is no longer listed for raw z-index.
- `npm.cmd run build`: passed.
- Browser runtime QA: earlier in-app Browser localhost access remained blocked by `net::ERR_BLOCKED_BY_CLIENT`; in this continuation the Browser control tool was not exposed by tool discovery. `npm.cmd run dev:start` reported ready at `http://localhost:3000`, but the managed Vite/API processes then exited in this local environment. A short-lived Vite job on `http://127.0.0.1:5194/settings` returned `status=200`, `length=4989`, and `root=True`, then was stopped. `npm.cmd run dev:stop` and `npm.cmd run dev:status` confirmed no residual Vite/API processes.

### Project Manager Modal Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still progressing through scoped system passes.
- Browser screenshot QA remains blocked/unavailable in this local session; HTTP smoke and build/test verification were used as fallback evidence.

### Project Manager Modal Risks And Next Steps
- ProjectManager still has local dropdown backdrops using `z-40` / `z-50`; they are not part of the current raw z-index architecture warning but can be moved to a dedicated local dropdown primitive in a later pass.
- Existing raw z-index warnings remain in admin recharge, PromptBar internals, mobile ecommerce/menu/tab/quick surfaces, common modals, sign-up confetti, and DesktopComposerModePanel.
- Existing raw color warnings remain broad, especially admin, ecommerce, canvas drawing/group colors, and modal backgrounds. Continue separating UI chrome tokens from user/canvas content colors.

## 2026-06-12 - Advanced Settings Shadow Harness Layer Pass

### Advanced Settings Change Scope
- Moved the hidden advanced-settings diagnostics harness from private inline geometry and raw `zIndex: 99999` into the `settings-system-shadow-harness` settings primitive plus `KK_LAYER.toolbar`.
- Kept the existing Playwright smoke affordances intact: the diagnostics toggle and collapse controls remain available to tests while the harness stays visually transparent and non-disruptive for users.
- Replaced both settings highlight glow raw `z-index: 99999 !important` declarations with the named `--settings-highlight-layer` token.
- Preserved the OCR configuration modal at `KK_LAYER.modalBackdrop`, so real user-facing modal surfaces continue to layer above the diagnostics harness and highlight ring.

### Advanced Settings Files Changed
- `apps/web/src/components/settings/ApiAdvancedSettingsView.tsx`
- `apps/web/src/styles/settings.css`
- `tests/unit/settings-modal-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Advanced Settings Current Design Decisions
- Hidden testing controls can exist, but their layer, size, opacity, and pointer policy must be owned by settings-system CSS primitives instead of private inline layout.
- `KK_LAYER.toolbar` is the bounded layer for this diagnostics harness because it should sit above base settings content but below modals, dropdowns, toasts, and fullscreen surfaces.
- `--settings-highlight-layer: var(--kk-z-dropdown)` makes highlight rings a named settings token, giving future onboarding or focus effects a reusable layer contract instead of a maximum z-index escape hatch.
- Settings modal and highlight behavior now share the same system vocabulary as the broader UI layer pass, reducing the chance of future overlay conflicts when more settings pages are added.

### Advanced Settings Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-modal-ui-system-contract.test.ts`: red first for the new shadow-harness contract, then 4 tests passed after implementation.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-modal-ui-system-contract.test.ts tests/unit/api-settings-workbench-structure.test.ts tests/unit/mobile-settings-browser-verify-script.test.ts tests/unit/settings-ui-system-contract.test.ts tests/unit/api-settings-provider-compact-ui-contract.test.ts`: 30 tests passed.
- `rg -n "z-index:\s*99999|zIndex:\s*99999|99999" apps/web/src/components/settings/ApiAdvancedSettingsView.tsx apps/web/src/styles/settings.css`: no matches.
- `npm.cmd run typecheck`: passed; 425 test files typechecked.
- `npm.cmd run architecture:check`: passed; still prints existing raw color and raw z-index warning lists outside this pass, and `ApiAdvancedSettingsView.tsx` is no longer listed for raw z-index.
- `npm.cmd run build`: passed.
- `npm.cmd run governance:check`: passed.
- `npm.cmd run check:encoding`: passed.
- Browser runtime QA: `npm.cmd run dev:start` reported ready at `http://localhost:3000`, but the in-app Browser still returned `net::ERR_BLOCKED_BY_CLIENT` for `http://localhost:3000/settings/api-management`. The managed dev processes then exited in this local environment. A short-lived Vite job on `http://127.0.0.1:5192/settings/api-management` returned `status=200`, `length=4989`, and `root=True`, then was stopped. `npm.cmd run dev:status` confirmed no residual Vite/API processes.

### Advanced Settings Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still progressing through scoped system passes; keep it for final release-grade convergence.
- Browser screenshot QA remains blocked by the in-app Browser localhost policy returning `net::ERR_BLOCKED_BY_CLIENT`; HTTP smoke, tests, typecheck, architecture, build, governance, and encoding checks were used as fallback evidence.

### Advanced Settings Risks And Next Steps
- `ProjectManager` still has `z-[100]` / `z-[101]` raw layer values and is the next settings-adjacent cleanup target.
- Existing raw z-index warnings also remain in admin recharge, mobile ecommerce/menu/tab/quick surfaces, several common modals, and sign-up confetti. Continue moving them into `KK_LAYER` by user-facing risk.
- Existing raw color warnings are broader historical debt. Treat UI chrome tokens separately from canvas/user-content colors before bulk cleanup.

## 2026-06-12 - Search Palette UI System Layer Pass

### Search Palette Change Scope
- Migrated the global search overlay from raw `z-[100]` and inline backdrop styling to `KK_LAYER.modal` plus reusable `kk-search-palette-*` primitives.
- Moved the SearchPalette shell surface, border, shadow, blur, backdrop, and mobile/desktop radius aliases into `apps/web/src/styles/kk-ui-tokens.css`.
- Kept the existing SearchPalette behavior unchanged: open/close, click outside, keyboard navigation, mobile bottom sheet, desktop command surface, multi-select, hints, and result navigation.
- Updated the Clay global refit contract so shell material assertions live in CSS while state-specific selected/focus tokens remain checked in the component.

### Search Palette Files Changed
- `apps/web/src/components/layout/SearchPalette.tsx`
- `apps/web/src/styles/kk-ui-tokens.css`
- `tests/unit/search-palette-ui-system-contract.test.ts`
- `tests/unit/clay-global-ui-refit-contract.test.ts`
- `docs/development/session-handoff.md`

### Current Design Decisions
- SearchPalette now consumes `KK_LAYER.modal`, matching the top-level overlay policy instead of carrying a private Tailwind z-index.
- `kk-search-palette-backdrop`, `kk-search-palette-scrim`, and `kk-search-palette-panel` are the reusable system primitives for future command/search overlays.
- Existing legacy Clay tokens are preserved as the visual source of truth via aliases such as `--kk-search-palette-backdrop-bg: var(--search-palette-overlay-bg)` and `--kk-search-palette-panel-shadow: var(--frost-card-framework-shadow)`.
- Mobile and desktop variants remain explicit through `data-search-surface` and `data-search-panel`; CSS data selectors own the shell radius and bottom-sheet edge treatment.

### Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/search-palette-ui-system-contract.test.ts`: red first, then 2 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/search-palette-ui-system-contract.test.ts tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts`: 24 tests passed.
- `rg -n "z-\[100\]|fixed inset-0 z-\[100\]|search-palette-overlay-bg|frost-card-framework-shadow|frost-card-framework-blur" apps/web/src/components/layout/SearchPalette.tsx`: no matches.
- `node scripts/architecture/check-no-raw-zindex.mjs`: exit 0 with the existing non-blocking warning list; `SearchPalette.tsx` is no longer listed.
- `npm.cmd run typecheck`: passed; 425 test files typechecked.
- `npm.cmd run architecture:check`: passed; still prints existing raw color and raw z-index warning lists outside this pass.
- `npm.cmd run build`: passed.
- `npm.cmd run governance:check`: passed.
- `npm.cmd run check:encoding`: passed.
- Runtime QA: `npm.cmd run dev:start` reported ready, but the managed Vite/API processes exited in this local environment before HTTP smoke. In-app Browser still returned `net::ERR_BLOCKED_BY_CLIENT` for `http://localhost:3000/`. A short-lived Vite job on `http://127.0.0.1:5191/` returned `status=200`, `length=4989`, and `root=True`, then was stopped. `npm.cmd run dev:status` confirmed no residual Vite/API processes.

### Not Run
- Full `npm run verify:changes` was not run because the overall UI optimization goal is still being advanced in scoped passes; keep it for the final release-grade convergence run.
- Browser screenshot QA is still blocked by the in-app Browser localhost policy returning `net::ERR_BLOCKED_BY_CLIENT`; HTTP smoke and build/test verification were used as fallback.

### Risks And Next Steps
- Global raw z-index warnings remain in `AdminRechargeFloatingPanel`, mobile ecommerce/menu/tab/quick surfaces, several modals, `ProjectManager`, and sign-up confetti. Continue moving them to `KK_LAYER` by risk priority.
- Raw color warnings remain broad and historical. Separate UI chrome tokens from user/content color values before bulk cleanup.
- SearchPalette now has system primitives, so future command/search surfaces should reuse these classes instead of adding new private glass/z-index styling.

## 2026-06-12 - Prompt Bar Mobile Chrome Layer UI System Pass

### Prompt Bar Mobile Chrome Layer 修改范围
- 新增 `KK_LAYER.promptComposer`，为移动端底部输入栏提供介于底部导航与 modal 之间的统一系统层级。
- 将 `PromptBar` 移动端折叠把手从 `z-[800]` 与 raw neutral 背景类迁入 `kk-prompt-bar-mobile-collapse-handle` primitive。
- 将 `PromptBar` 移动端展开态容器从 `z-[800]` / `zIndex: 960` 改为消费 `KK_LAYER.promptComposer`。
- 将移动端结果详情页与更多操作 sheet 标记为 `data-kk-mobile-overlay-layer="true"`，并把自身 raw `z-[990]` / `z-[985]` 改为 `KK_LAYER.modal`。
- 将 PromptBar 外部点击豁免从 `[class*="z-[990]"]` / `[class*="z-[985]"]` 改为语义化 layer selector，减少未来调层级时误关闭输入栏的风险。

### Prompt Bar Mobile Chrome Layer 修改文件
- `packages/ui/src/core/layers.ts`
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/layout/PromptBar.tsx`
- `apps/web/src/components/mobile/MobileResultDetailScreen.tsx`
- `apps/web/src/components/mobile/MobileWorkspaceSurface.tsx`
- `tests/unit/prompt-bar-mobile-chrome-layer-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Prompt Bar Mobile Chrome Layer 当前设计决策
- `promptComposer: 960` 保留原有移动端输入栏的相对层级语义：高于底部导航与常规浮动控件，低于 modal/dropdown/toast/fullscreen。
- PromptBar 不再通过视觉类名猜测其它移动端 overlay；后续需要压在输入栏上方的移动端浮层应声明 `data-kk-mobile-overlay-layer="true"`。
- 折叠把手的尺寸、位置、hover、暗色背景进入 `kk-ui-tokens.css`，组件侧只保留点击展开行为和 `KK_LAYER.promptComposer`。
- 结果详情与更多操作 sheet 先统一进 `KK_LAYER.modal`；后续如拆分 backdrop/panel，可在同一 data selector 下继续细化，不再回退到私有 z-index。

### Prompt Bar Mobile Chrome Layer 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-mobile-chrome-layer-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-mobile-chrome-layer-ui-system-contract.test.ts tests/unit/prompt-bar-mobile-model-sheet-ui-system-contract.test.ts tests/unit/prompt-bar-deep-overlay-ui-system-contract.test.ts tests/unit/prompt-bar-local-overlay-ui-system-contract.test.ts tests/unit/prompt-bar-layout-regression.test.ts tests/unit/prompt-bar-surface-token-regression.test.ts tests/unit/mobile-workspace-surface-contract.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts`: 33 tests passed。
- `rg -n 'z-\[800\]|zIndex:\s*960|\[class\*="z-\[990\]"\]|\[class\*="z-\[985\]"\]|z-\[990\]|z-\[985\]|bg-neutral-400/30|dark:bg-neutral-500/30' apps/web/src/components/layout/PromptBar.tsx apps/web/src/components/mobile/MobileResultDetailScreen.tsx apps/web/src/components/mobile/MobileWorkspaceSurface.tsx`: no matches。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标项已从 PromptBar / MobileResultDetailScreen / MobileWorkspaceSurface warning list 移除。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印项目既有 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。
- Browser runtime QA: `npm.cmd run dev:start` 能启动并记录 Vite/API ready，但进程在当前宿主环境下未长期保活；内置 Browser 打开 `http://localhost:3000/` 仍返回 `net::ERR_BLOCKED_BY_CLIENT`；随后使用短生命周期 dev Job 执行 `Invoke-WebRequest http://127.0.0.1:3000/`，返回 `status=200` 且包含 `<div id="root">`。结束后 `npm.cmd run dev:status` 确认 3000/3001 无残留进程。

### Prompt Bar Mobile Chrome Layer 未运行验证及原因
- 尚未完成 Browser screenshot QA：内置 Browser 当前对本机 localhost 目标返回 `net::ERR_BLOCKED_BY_CLIENT`；本轮已用项目构建、单元契约、架构检查和 HTTP smoke 补位。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Prompt Bar Mobile Chrome Layer 风险与下一步
- `PromptBar` 仍有两个发送按钮内部局部 `z-[1]`，属于同一按钮内部层级，不是全局浮层；后续可迁入局部 CSS layer token。
- 全局 raw z-index 剩余项集中在 `AdminRechargeFloatingPanel`、`SearchPalette`、`MobileEcommercePanel`、`MobileMoreMenu`、`MobileTabBar`、`MobileWorkspaceQuickBar` 和通用 modal；下一轮建议继续处理移动端全屏/底栏浮层。
- raw color warning 仍包含管理浮层、ModelLogo filter/drop-shadow、画布内容色和部分 modal 背景；后续应区分 UI chrome 与用户内容色值。

## 2026-06-12 - Prompt Bar Deep Overlay UI System Pass

### Prompt Bar Deep Overlay 修改范围
- 将 `PromptBar` 桌面模型下拉、右键上下文菜单、模型设置弹窗和移动端并行数量 action sheet 收口到 `kk-prompt-bar-deep-*` primitive。
- 移除本轮目标里的 `z-[10000]` / `z-[10010]` / `z-[10020]`、深层弹窗内联背景/边框/阴影和移动端数量 sheet 的 `bg-black/45` / `backdrop-blur-[2px]`。
- 保留原有弹层定位、展开状态、点击关闭和业务行为，只把视觉壳、材质、间距和全局层级迁入 CSS/token。
- 同步修正 PromptBar 回归测试，让测试断言新的系统 primitive，而不是旧的 Tailwind z-index 或内联样式实现细节。

### Prompt Bar Deep Overlay 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/layout/PromptBar.tsx`
- `tests/unit/prompt-bar-deep-overlay-ui-system-contract.test.ts`
- `tests/unit/prompt-bar-layout-regression.test.ts`
- `tests/unit/prompt-bar-surface-token-regression.test.ts`
- `docs/development/session-handoff.md`

### Prompt Bar Deep Overlay 当前设计决策
- 桌面模型下拉和右键上下文菜单统一消费 `KK_LAYER.dropdown`，不再在组件内写私有高位 z-index。
- 模型设置弹窗和移动端数量 sheet 统一消费 `KK_LAYER.modal`，并分别使用 `kk-prompt-bar-deep-modal-*` 与 `kk-prompt-bar-deep-count-sheet-*` 承载材质。
- PromptBar 组件侧只负责状态、定位和业务事件；弹层背景、边框、阴影、blur、padding、motion 统一由 `kk-ui-tokens.css` 管理。
- 测试契约改为检查 `KK_LAYER`、`kk-prompt-bar-deep-*` class 和 CSS token 映射，避免后续重构时因旧内联样式耦合产生误报。

### Prompt Bar Deep Overlay 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-deep-overlay-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-deep-overlay-ui-system-contract.test.ts tests/unit/prompt-bar-mobile-model-sheet-ui-system-contract.test.ts tests/unit/prompt-bar-local-overlay-ui-system-contract.test.ts tests/unit/prompt-bar-layout-regression.test.ts tests/unit/prompt-bar-surface-token-regression.test.ts tests/unit/prompt-bar-model-library-loading.test.ts tests/unit/prompt-bar-mobile-separation.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/workspace-chrome-ui-system-contract.test.ts tests/unit/chat-sidebar-deep-ui-system-contract.test.ts`: 35 tests passed。
- `rg -n 'z-\[10000\]|z-\[10010\]|z-\[10020\]|bg-black/45|backdrop-blur-\[2px\]|rgba\(0,0,0,0\.18\)' apps/web/src/components/layout/PromptBar.tsx`: 仅剩一个非本轮深层浮层目标的 hover 阴影 `rgba(0,0,0,0.18)`。
- `rg -n "color-mix\(in srgb, var\(--bg-base\) 52%, transparent\)|backdropFilter: 'blur\(12px\)'" apps/web/src/components/layout/PromptBar.tsx`: no matches。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印项目既有 raw color / raw z-index warning list，本轮目标的 `z-[10000]` / `z-[10010]` / `z-[10020]` 已不在 PromptBar warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。
- Browser runtime QA: 已尝试用内置 Browser 打开 `http://127.0.0.1:3000/` 与 `http://localhost:3000/`，均被客户端策略拦截为 `net::ERR_BLOCKED_BY_CLIENT`；随后用临时 dev Job 执行 HTTP smoke，`Invoke-WebRequest http://127.0.0.1:3000/` 返回 `status=200` 且包含 `<div id="root">`。

### Prompt Bar Deep Overlay 未运行验证及原因
- 尚未完成 Browser screenshot QA：内置 Browser 当前对本机 localhost 目标返回 `net::ERR_BLOCKED_BY_CLIENT`；本轮已用构建、测试契约和 HTTP smoke 补位，真实交互抽样建议在浏览器本地访问恢复后补做。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Prompt Bar Deep Overlay 风险与下一步
- `PromptBar` 仍有 `z-[1]`、`z-[800]`、`zIndex: 960` 以及外部点击豁免里的 `z-[990]` / `z-[985]` 历史分支，属于后续 PromptBar layer 清理候选。
- 全局 raw z-index warning 仍覆盖 `AdminRechargeFloatingPanel`、`SearchPalette`、移动端全屏详情和部分 modal；下一轮可继续按浮层风险从高到低迁入 `KK_LAYER`。
- raw color warning 仍是全局历史清单，包含画布内容色、管理浮层、移动端业务面板等；后续需要区分 UI chrome token 和用户内容色值，不应一刀切。

## 2026-06-12 - Prompt Bar Mobile Model Sheet UI System Pass

### Prompt Bar Mobile Model Sheet 修改范围
- 将 `PromptBar` 移动端模型库 bottom sheet 的遮罩、sheet host、面板材质、拖拽手柄和入场动画收口到 `kk-prompt-bar-mobile-model-*` primitive。
- 移除本轮目标里的 `z-[1049]` / `z-[1050]`、`bg-black/40`、局部 `model-sheet-slide-up` keyframes 和 `rgba(0,0,0,0.25)` 面板阴影。
- 将外部点击豁免从 `target.closest('[class*="z-[1049]"]')` / `z-[1050]` 改为稳定 `data-prompt-bar-mobile-model-layer="true"` selector。
- 本轮只处理移动端模型库 bottom sheet，不重写 PromptBar 其它深层菜单、右键菜单、设置弹窗或输入栏堆叠。

### Prompt Bar Mobile Model Sheet 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/layout/PromptBar.tsx`
- `tests/unit/prompt-bar-mobile-model-sheet-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Prompt Bar Mobile Model Sheet 当前设计决策
- 移动端模型库遮罩使用 `KK_LAYER.modalBackdrop`，sheet host 使用 `KK_LAYER.modal`，避免 PromptBar 继续维护私有绝对 z-index。
- 外部点击逻辑只识别语义化 data selector，不依赖视觉 class 或层级数值，减少未来重命名/换层级造成的误关闭。
- sheet 面板继续继承 frosted framework 材质，但通过 `--kk-prompt-bar-mobile-model-*` token 管理背景、边框、阴影、blur 和手柄颜色。
- 入场动画从组件内联 `<style>` 移到 `kk-ui-tokens.css`，后续移动端 sheet 动效可以复用或对齐同一 motion 曲线。

### Prompt Bar Mobile Model Sheet 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-mobile-model-sheet-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-mobile-model-sheet-ui-system-contract.test.ts tests/unit/prompt-bar-local-overlay-ui-system-contract.test.ts tests/unit/prompt-bar-layout-regression.test.ts tests/unit/prompt-bar-surface-token-regression.test.ts tests/unit/prompt-bar-model-library-loading.test.ts tests/unit/prompt-bar-mobile-separation.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/workspace-chrome-ui-system-contract.test.ts tests/unit/chat-sidebar-deep-ui-system-contract.test.ts`: 33 tests passed。
- `rg -n 'z-\[1049\]|z-\[1050\]|\[class\*=\"z-\[1049\]\"\]|\[class\*=\"z-\[1050\]\"\]|model-sheet-slide-up|bg-black/40' apps/web/src/components/layout/PromptBar.tsx`: no matches。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标 `z-[1049]` / `z-[1050]` 已从 PromptBar warning list 移除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标 sheet 黑色遮罩、局部阴影和内联面板材质已清理。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed；本轮顺手修复了 `session-handoff.md` 中 Prompt Node / Result Surface 新式小标题重复导致的治理失败。
- `npm.cmd run check:encoding`: passed。
- `git diff --check -- "apps/web/src/styles/kk-ui-tokens.css" "apps/web/src/components/layout/PromptBar.tsx" "tests/unit/prompt-bar-mobile-model-sheet-ui-system-contract.test.ts" "docs/development/session-handoff.md"`: passed。

### Prompt Bar Mobile Model Sheet 未运行验证及原因
- 尚未重新完成 Browser runtime screenshot QA：本轮是 PromptBar 移动端模型 sheet 的源码契约、类型、架构和构建收口；真实设备上的 bottom sheet 视觉抽样建议和下一轮 PromptBar 深层浮层一起覆盖。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Prompt Bar Mobile Model Sheet 风险与下一步
- PromptBar 仍有 `z-[10000]` / `z-[10010]` / `z-[10020]` 等深层菜单、右键菜单和设置弹窗层级硬编码。
- 外部点击逻辑仍有对 `z-[990]` / `z-[985]` 历史浮层的豁免，下一轮应迁移为语义化 data selector 或共享 overlay primitive。
- 下一轮建议继续处理 PromptBar 右键菜单与模型设置弹窗，或切到 `SearchPalette` / mobile detail screens 清理剩余全屏浮层。

## 2026-06-12 - Prompt Node Generating Placeholder UI System Pass

### Prompt Node 修改范围
- 将 `PromptNodeComponent` 桌面生成占位态的能量流动线、能量粒子、生成图片区域扫光层收口到 `kk-canvas-prompt-node-*` primitive。
- 移除目标区域内的 `zIndex: 1`、`z-[6]`、硬编码能量色值和内联 `rgba(...)` 扫光渐变，改由 `kk-ui-tokens.css` 提供局部 layer token、SVG 色彩 token 和扫光材质。
- 将原本组件内联的 `prompt-shimmer-sweep` `<style>` 迁移为全局 CSS keyframes，并由 `.kk-canvas-prompt-node-generating-sweep` 直接承载动画。
- 本轮不重写 `PromptNodeComponent` 其它业务徽章、连接器、按钮和节点布局，只处理生成占位动画层，降低主画布回归风险。

### Prompt Node 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/canvas/PromptNodeComponent.tsx`
- `tests/unit/prompt-node-generating-placeholder-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Prompt Node 当前设计决策
- 生成占位态内部排序使用 `--kk-canvas-prompt-node-energy-layer` 与 `--kk-canvas-prompt-node-generating-overlay-layer`，因为它们只表达同一 prompt node 内部层级；节点整体堆叠仍由现有 canvas `stackZIndex` 管理。
- 能量线的 start / mid / warm / end 色彩进入 token，避免后续暗色、浅色或品牌微调时在 TSX 中追硬编码。
- 图片区域扫光使用 `.kk-canvas-prompt-node-generating-image-overlay`、`.kk-canvas-prompt-node-generating-sheen`、`.kk-canvas-prompt-node-generating-sweep` 三个 primitive，后续新增生成中视觉态应优先复用这套结构。
- Product Design preflight 未发现保存的用户上下文；本轮依据现有 KK Studio 代码、项目 token 和用户提供的端侧 UI 规范推进。

### Prompt Node 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-node-generating-placeholder-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-node-generating-placeholder-ui-system-contract.test.ts tests/unit/pending-node-ui-system-contract.test.ts tests/unit/canvas-collapsed-groups-contract.test.ts tests/unit/canvas-context-menu-ui-system-contract.test.ts tests/unit/canvas-drawing-overlay-ui-system-contract.test.ts tests/unit/canvas-toolbar-ui-system-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/canvas-snap-to-grid-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/clay-global-ui-refit-contract.test.ts`: 47 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标 `PromptNodeComponent` 的 `zIndex: 1` / `z-[6]` 已清除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标能量色值和扫光 `rgba(...)` 已清除。
- `rg -n 'zIndex:\s*1\b|z-\[6\]|stopColor="#ff4d8b"|stopColor="#ff6b5a"|stopColor="#ffb084"|stopColor="#b8a4ed"|stroke="#ff6b5a"|stroke="#ff4d8b"|fill="#b8a4ed"|rgba\(255,255,255,0\.01\)|rgba\(255,255,255,0\.05\)|rgba\(255,255,255,0\.6\)' apps/web/src/components/canvas/PromptNodeComponent.tsx`: no matches。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。

### Prompt Node 未运行验证及原因
- 尚未重新完成 Browser runtime screenshot QA：本轮是生成占位态源码契约、类型、架构和构建收口；真实生成中动画建议在下一轮主画布视觉抽样中覆盖。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Prompt Node 风险与下一步
- `PromptNodeComponent` 仍有不少非本轮目标的历史 raw color / layout chrome，主要分散在业务徽章、状态条和节点辅助 affordance 中。
- `check-no-raw-zindex` 剩余警告当前仍集中在 `PromptBar` 深层浮层、`AdminRechargeFloatingPanel`、`SearchPalette` 等旧区域。
- 下一轮建议继续处理 `PromptBar` 深层菜单/弹窗 layer，或切到 `AdminRechargeFloatingPanel` 把高风险固定浮层纳入 `KK_LAYER` 和 token 体系。

## 2026-06-12 - Pending Node UI System Pass

### Pending Node 修改范围
- 将 `PendingNode` 的预览断开按钮、生成中连接线、副占位卡、扫光层、流体光效、内容层和 spinner shell 收口到 `kk-canvas-pending-*` primitive。
- 移除 `PendingNode` 内部 `zIndex: 5` / `zIndex: 10` / `zIndex: 1`，改由局部 CSS layer token 表达内部层级；根节点 `stackZIndex` 仍保留给 canvas 拖拽栈管理。
- 将连接线 `rgba(255,255,255,0.25)`、扫光 `rgba(...)`、流体光效 gradient、红色断开按钮 utility class 改为系统 token。
- 修正 `tests/unit/canvas-collapsed-groups-contract.test.ts` 中对 `groupGlowShadow` 变量名的实现耦合，改为验证 group shell 实际使用 `--frost-card-framework-shadow` 与 `--frost-card-framework-border`。

### Pending Node 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/canvas/PendingNode.tsx`
- `tests/unit/pending-node-ui-system-contract.test.ts`
- `tests/unit/canvas-collapsed-groups-contract.test.ts`
- `docs/development/session-handoff.md`

### Pending Node 当前设计决策
- `PendingNode` 的局部内部层级使用 `--kk-canvas-pending-layer-*`，而不是全局 `KK_LAYER`，因为连接线、环境光、占位卡和内容层都只在同一 pending node 内部排序。
- 生成占位卡的动态尺寸、位置和计时文案继续留在组件侧；纯视觉 chrome、动效材质和内部层级进入 `kk-ui-tokens.css`。
- 旧 canvas group collapsed 契约不再绑定 `groupGlowShadow` 这个变量名，避免未来 token 内联/提取时产生非行为性失败。

### Pending Node 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/pending-node-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/encoding-check-contract.test.ts tests/unit/canvas-collapsed-groups-contract.test.ts tests/unit/canvas-context-menu-ui-system-contract.test.ts tests/unit/canvas-drawing-overlay-ui-system-contract.test.ts tests/unit/canvas-toolbar-ui-system-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/canvas-snap-to-grid-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/pending-node-ui-system-contract.test.ts`: 47 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；`PendingNode` 已从 z-index warning 清单移除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标 `PendingNode` raw connector/shimmer/glow/disconnect chrome 已清理。
- `rg -n 'zIndex:\s*(1|5|10)\b|bg-red-500/20|hover:bg-red-500/40|text-red-400|stroke="rgba\(255,255,255,0\.25\)"|rgba\(255,255,255,0\.12\)|rgba\(255,255,255,0\.15\)|linear-gradient\(45deg, rgb\(255 77 139|linear-gradient\(135deg, rgb\(255 176 132' apps/web/src/components/canvas/PendingNode.tsx`: no matches。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。

### Pending Node 未运行验证及原因
- 本轮尚未重新完成 Browser runtime screenshot QA：当前变更为 pending node 源码契约、类型、架构和构建收口；真实生成中占位卡动效建议在后续视觉抽样中覆盖。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Pending Node 风险与下一步
- `PendingNode` 已从 raw z-index 清单移除；主画布剩余明显节点态债务集中在 `PromptNodeComponent` 的内部层级和局部浮层。
- raw color 历史清单仍包含 `CanvasDrawingInteractionOverlay` 的导出白底、`CanvasGroupComponent` 色板内容值、`ModelLogo` filter/drop-shadow、Admin floating panel 和部分 ecommerce 面板。
- 下一轮建议优先处理 `PromptNodeComponent` 的 `zIndex: 1` / `z-[6]` 与相关 overlay chrome，继续把主画布节点态并入系统层级。

## 2026-06-12 - Canvas Drawing Overlay UI System Pass

### Canvas Drawing Overlay 修改范围
- 将 `CanvasDrawingInteractionOverlay` 的 board-mode drawing overlay、框选预览和文字输入框收口到 `kk-canvas-drawing-*` primitive。
- 移除 overlay 容器 `z-[25]` 和文字输入锚点 `z-[100]`，改用 `KK_LAYER.nodeSelected` 与 `KK_LAYER.floating`。
- 将框选预览的 `#6366f1` stroke 和 `rgba(99, 102, 241, 0.12)` fill 改为 `--kk-canvas-drawing-selection-*` token。
- 将文字输入框背景、边框、阴影、字体和 padding 移入 CSS primitive，组件侧只保留 `activeColor` 与动态字号。

### Canvas Drawing Overlay 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/canvas/CanvasDrawingInteractionOverlay.tsx`
- `tests/unit/canvas-drawing-overlay-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Canvas Drawing Overlay 当前设计决策
- 导出 PNG 的 `ctx.fillStyle = '#ffffff'` 仍保留在绘图导出逻辑里：它是选区导出给多模态模型的内容白底语义，不是 UI chrome。
- 用户绘制颜色、笔刷宽度、文本颜色继续由 `activeColor` / `activeWidth` 驱动，不强行映射到 UI token，避免破坏画布内容表达。
- overlay 容器和文字输入浮层进入统一 layer token；后续 board-mode 工具浮层应优先复用 `kk-canvas-drawing-*` 或补充相邻 primitive。

### Canvas Drawing Overlay 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-drawing-overlay-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-drawing-overlay-ui-system-contract.test.ts tests/unit/canvas-context-menu-ui-system-contract.test.ts tests/unit/canvas-toolbar-ui-system-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/canvas-snap-to-grid-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/clay-global-ui-refit-contract.test.ts`: 37 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标 `CanvasDrawingInteractionOverlay` 的 `z-[25]` / `z-[100]` 已从清单移除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标 selection preview 与 text input UI chrome 已清理，`ctx.fillStyle = '#ffffff'` 作为导出内容白底语义保留。
- `rg -n 'z-\[25\]|z-\[100\]|#6366f1|rgba\(99, 102, 241, 0\.12\)|frost-card-main-bg, rgba|accent-coral, #ef4444|0 0 10px rgba' apps/web/src/components/canvas/CanvasDrawingInteractionOverlay.tsx`: no matches。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。

### Canvas Drawing Overlay 未运行验证及原因
- 本轮尚未重新完成 Browser runtime screenshot QA：当前变更为 board-mode overlay 源码契约、类型、架构和构建收口；真实画笔框选/文字输入视觉抽样建议在下一次运行时 QA 中覆盖。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Canvas Drawing Overlay 风险与下一步
- drawing overlay 的 UI chrome 已收口，但画布内容导出白底和用户绘制色值仍会出现在 raw color literal 清单；这部分不应直接按 UI token 债务处理。
- raw z-index 历史清单当前主要剩余在 `PendingNode`、`PromptNodeComponent`、`PromptBar` 深层浮层、Admin floating panel 和部分其它业务面板。
- 下一轮建议优先处理 `PendingNode` 或 `PromptNodeComponent` 的内部层级，把主画布节点态浮层继续并入 `KK_LAYER` 体系。

## 2026-06-12 - Canvas Context Menu UI System Pass

### Canvas Context Menu 修改范围
- 将 `CanvasGroupComponent` 的右键菜单收口到 `kk-canvas-context-menu-*` primitive，统一菜单壳层、菜单项、危险操作、分隔线、分区标题、色板和自定义色彩输入。
- 移除右键菜单私有 `z-[9999]`，改用 `KK_LAYER.dropdown`，避免主画布浮层继续分叉层级规则。
- 将菜单危险操作从 `text-red-500` / `hover:bg-[rgba(...)]` / `hover:text-red-400` 改为 tokenized danger menu 状态。
- 顺手修正 `CanvasGroupComponent` group shell 边框与阴影契约：边框回到 `--frost-card-framework-border`，核心 shadow token 直接留在 `groupSurfaceStyle` 内部，避免测试依赖菜单样式误匹配。

### Canvas Context Menu 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/canvas/CanvasGroupComponent.tsx`
- `tests/unit/canvas-context-menu-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Canvas Context Menu 当前设计决策
- Canvas group 右键菜单使用独立 `kk-canvas-context-menu-*` 命名空间，不复用 ChatSidebar / Workspace 菜单类，避免后续主画布菜单与应用 chrome 菜单视觉职责混淆。
- 色板颜色本身仍作为用户可选内容值保留在组件常量里；色板边框、选中阴影、勾选对比色和危险态统一进入 CSS token。
- `CanvasGroupComponent` 只负责菜单位置、业务事件和选中色值；菜单材质、状态和动效由 `kk-ui-tokens.css` 承载。

### Canvas Context Menu 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-menu-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-context-menu-ui-system-contract.test.ts tests/unit/canvas-toolbar-ui-system-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/canvas-snap-to-grid-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/clay-global-ui-refit-contract.test.ts`: 35 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标 `CanvasGroupComponent` 的 `z-[9999]` 已从清单移除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标菜单的 raw red hover / divider class 已清理，色板内容值仍在历史 color literal 清单中。
- `rg -n "z-\[9999\]|text-red-500|hover:text-red-400|hover:bg-\[rgba\(255,107,90,0\.10\)\]|bg-\[var\(--border-light\)\]|fixed z-\[9999\]" apps/web/src/components/canvas/CanvasGroupComponent.tsx`: no matches。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。

### Canvas Context Menu 未运行验证及原因
- 本轮尚未重新完成 Browser runtime screenshot QA：当前变更为源码 UI 契约、类型、架构和构建收口；真实右键菜单视觉抽样建议与下一轮 CanvasDrawingInteractionOverlay 巡检一起做。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Canvas Context Menu 风险与下一步
- `CanvasGroupComponent` 仍保留色板内容常量的 hex 值，这是业务可选颜色，不是菜单 chrome；后续如果要彻底压缩 raw literal 清单，可迁移为 shared palette token 或显式标注 UI token exception。
- raw color / raw z-index 历史清单仍包含 CanvasDrawingInteractionOverlay、PendingNode、PromptNodeComponent 内部层级、Admin floating panel、PromptBar 深层菜单/弹窗、部分 ecommerce 面板和 `ModelLogo` raw filter/drop-shadow。
- 下一轮建议优先处理 `CanvasDrawingInteractionOverlay`，它现在同时存在 raw z-index、stroke/fill literal 和局部浮层材质，是主画布剩余分叉里最显眼的一块。

## 2026-06-12 - Canvas Toolbar UI System Pass

### Canvas Toolbar 修改范围
- 将主画布左侧 toolbar 收口到 `kk-canvas-toolbar-*` primitive，统一 toolbar 壳层、按钮、hover、active 和 icon 颜色状态。
- 移除主画布 toolbar 的私有 `z-[1001]`，改为消费 `KK_LAYER.toolbar`，避免未来新增画布控件继续分叉层级规则。
- 将 toolbar 按钮从 raw gray/zinc/white utility class 改为 tokenized CSS 与 `data-active` 状态，保留定位与点阵开关业务行为不变。

### Canvas Toolbar 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/canvas/Canvas.tsx`
- `tests/unit/canvas-toolbar-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Canvas Toolbar 当前设计决策
- `kk-canvas-toolbar-*` 命名空间放在 canvas selection menu primitive 附近，作为主画布控制区的独立系统元素，不混用 settings、prompt bar 或 image card primitive。
- toolbar 层级统一使用 `KK_LAYER.toolbar`；后续新增主画布固定工具条、模式按钮和 canvas-level quick action 时，应优先复用该层级，不再写私有 z-index。
- 按钮视觉状态由 CSS token 和 `data-active="true"` 表达；组件侧只保留结构、交互回调和可审计状态属性。

### Canvas Toolbar 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-toolbar-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-toolbar-ui-system-contract.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/canvas-snap-to-grid-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/clay-global-ui-refit-contract.test.ts`: 33 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标 `Canvas.tsx` 的 `z-[1001]` 已从清单移除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标 toolbar raw gray/zinc/white utility class 已收口。
- `rg -n "z-\[1001\]|toolbar-btn|text-gray-500|dark:text-zinc-400|dark:group-hover:text-white|dark:text-white" apps/web/src/components/canvas/Canvas.tsx`: 仅剩 zoom slider 百分比文本的历史 `text-gray-500 dark:text-zinc-400`，不属于本轮 toolbar block。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。

### Canvas Toolbar 未运行验证及原因
- 本轮尚未重新完成 Browser runtime screenshot QA：当前变更为主画布 toolbar 源码契约、类型、架构和构建收口；真实视觉抽样建议与后续 canvas controls / drawing overlay 统一巡检一起做。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Canvas Toolbar 风险与下一步
- raw color / raw z-index 历史清单仍包含 CanvasDrawingInteractionOverlay、CanvasGroupComponent 右键菜单、PendingNode、PromptNodeComponent 内部层级、Admin floating panel、PromptBar 深层菜单/弹窗、部分 ecommerce 面板和 `ModelLogo` raw filter/drop-shadow。
- 主画布 toolbar 已完成系统化；下一轮建议继续处理 CanvasDrawingInteractionOverlay 或 CanvasGroupComponent 右键菜单，以减少主操作画布里的剩余视觉分叉。

## 2026-06-12 - Settings Modal UI System Pass

### Settings Modal 修改范围
- 将 `ApiAdvancedSettingsView` 的 OCR 服务配置二级弹窗收口到 Settings shared modal primitive。
- 移除本轮目标弹窗中的 `z-[3000]`、`bg-black/60` 和 `shadow-2xl`，改用 `KK_LAYER.modalBackdrop` 与 settings CSS class。
- 新增 `SETTINGS_MODAL_BACKDROP_CLASSNAME` / `SETTINGS_MODAL_PANEL_CLASSNAME`，让后续设置页新增弹窗可以复用同一套结构。
- 为 OCR 弹窗补充 `role="dialog"`、`aria-modal="true"` 和标题关联，提升设置页弹窗的系统化与可访问性。

### Settings Modal 修改文件
- `apps/web/src/components/settings/SettingsScaffold.tsx`
- `apps/web/src/styles/settings.css`
- `apps/web/src/components/settings/ApiAdvancedSettingsView.tsx`
- `tests/unit/settings-modal-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Settings Modal 当前设计决策
- Settings 二级弹窗使用 `settings-system-modal-*` 命名空间，不借用 auth/image/prompt 的 overlay primitive，避免设置页弹窗风格和其他业务浮层耦合。
- 弹窗背景使用 `--settings-modal-backdrop-bg` 映射到全局 overlay token，面板继续继承 `--settings-surface-elevated` 与 `--settings-card-shadow`。
- 组件侧只组合结构、layer token 和业务内容；颜色、模糊、阴影、reduced-motion 均留在 `settings.css`。

### Settings Modal 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-modal-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-modal-ui-system-contract.test.ts tests/unit/settings-ui-system-contract.test.ts tests/unit/settings-ui-density-regression.test.ts tests/unit/settings-shell-scroll-regression.test.ts tests/unit/settings-workbench-ui-refit.test.ts tests/unit/theme-contrast-contract.test.ts`: 32 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标 `ApiAdvancedSettingsView` 的 `z-[3000]` 已从清单移除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标弹窗黑底/大阴影 class 已清除。
- `rg -n "z-\[3000\]|bg-black/60|shadow-2xl" apps/web/src/components/settings/ApiAdvancedSettingsView.tsx`: no matches。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。
- `git diff --check -- "apps/web/src/components/settings/SettingsScaffold.tsx" "apps/web/src/styles/settings.css" "apps/web/src/components/settings/ApiAdvancedSettingsView.tsx" "tests/unit/settings-modal-ui-system-contract.test.ts" "docs/development/session-handoff.md"`: passed；Git 仅提示 `SettingsScaffold.tsx` 下次触碰时会从 CRLF 归一到 LF。

### Settings Modal 未运行验证及原因
- 本轮尚未重新完成 Browser runtime screenshot QA：当前重点是设置页二级弹窗源码契约、类型、架构和构建收口；真实弹窗视觉抽样建议与后续设置页细节巡检一起做。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Settings Modal 风险与下一步
- raw color / raw z-index 历史清单仍包含 Canvas 交互浮层、Admin 浮层、PromptBar 更深层模型菜单/弹窗浮层、部分 ecommerce 面板和 `ModelLogo` raw filter/drop-shadow。
- 下一轮建议优先处理 Canvas toolbar / drawing overlay 或 Admin 浮层；设置页 OCR 二级弹窗已具备可复用的 modal primitive。

## 2026-06-12 - Prompt Bar Local Overlay UI System Pass

### Prompt Bar Local Overlay 修改范围
- 将 `PromptBar` 的移动端长按并行数量气泡与积分 hover tooltip 收口到 `kk-prompt-bar-*` local overlay primitive。
- 移除本轮目标区域中的 `z-[1200]`、`bg-black/85` / `dark:bg-black/90`、`text-white/60`、`shadow-pink-500/20` 和黑底 tooltip 拼接。
- 新增 PromptBar 局部浮层 token，覆盖 overlay 背景、边框、阴影、主/次文本、箭头背景和数量选中态。
- 保留 PromptBar 主输入、模型选择、资源上传、积分业务逻辑不变；本轮只处理长按数量气泡与积分 tooltip 两个高频局部浮层。

### Prompt Bar Local Overlay 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/layout/PromptBar.tsx`
- `tests/unit/prompt-bar-local-overlay-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Prompt Bar Local Overlay 当前设计决策
- `PromptBar` 局部辅助浮层使用独立 `kk-prompt-bar-*` 命名空间，不混入 ChatSidebar、workspace 或 image card primitive，避免以后新增 prompt 工具时视觉职责不清。
- 移动端长按数量气泡使用 `KK_LAYER.dropdown` 管理层级，外观继承 PromptBar shell token，选中态继承 `--prompt-bar-toggle-*` 语义。
- 积分 hover tooltip 复用同一套 PromptBar local overlay primitive，不再用一次性黑底白字样式。

### Prompt Bar Local Overlay 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-local-overlay-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/prompt-bar-local-overlay-ui-system-contract.test.ts tests/unit/prompt-bar-layout-regression.test.ts tests/unit/prompt-bar-surface-token-regression.test.ts tests/unit/prompt-bar-model-library-loading.test.ts tests/unit/prompt-bar-mobile-separation.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/workspace-chrome-ui-system-contract.test.ts tests/unit/chat-sidebar-deep-ui-system-contract.test.ts`: 31 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标 `PromptBar` `z-[1200]` 已清除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标黑底 tooltip / pink shadow / white text 硬编码已清除。
- `rg -n "z-\[1200\]|bg-black/85|dark:bg-black/90|text-white/60|shadow-pink-500/20|bg-black/85 text-white text-xs rounded-lg" apps/web/src/components/layout/PromptBar.tsx`: no matches。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。
- `git diff --check -- "apps/web/src/styles/kk-ui-tokens.css" "apps/web/src/components/layout/PromptBar.tsx" "tests/unit/prompt-bar-local-overlay-ui-system-contract.test.ts" "docs/development/session-handoff.md"`: passed。

### Prompt Bar Local Overlay 未运行验证及原因
- 本轮尚未重新完成 Browser runtime screenshot QA：当前重点是局部浮层源码契约、类型、架构和构建收口；真实 hover / long-press 视觉抽样建议与后续 PromptBar 深层菜单、Canvas 浮层一起做。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Prompt Bar Local Overlay 风险与下一步
- raw color / raw z-index 历史清单仍包含 Canvas 交互浮层、Admin 浮层、PromptBar 更深层模型菜单/弹窗浮层、部分 ecommerce 面板和 `ModelLogo` raw filter/drop-shadow。
- 本轮目标的移动端长按数量气泡与积分 tooltip 已脱离局部黑底/私有 z-index；下一轮建议优先处理 Canvas 交互浮层或 PromptBar 更深层模型菜单/弹窗浮层。

## 2026-06-12 - Chat Sidebar Deep UI System Pass

### Chat Sidebar Deep 修改范围
- 将 `ChatSidebar` 的 AI 接管附件菜单、会话上下文菜单、导入预览遮罩和导入预览面板收口到 `kk-chat-sidebar-*` primitive。
- 移除本轮目标区域中的 `z-[1000]` / `z-[10020]` / `z-[10030]`、`bg-[#0d0e14]`、`bg-black/50`、zinc 菜单项和红色硬编码筛选态。
- 新增 ChatSidebar 深层浮层 token，覆盖 floating menu、menu item、danger item、divider、modal backdrop、modal panel 和 active filter toggle。
- 保留会话导入、会话上下文操作、AI 接管上传入口和资源面板切换业务逻辑，仅替换视觉 primitive 与 layer token。

### Chat Sidebar Deep 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/layout/ChatSidebar.tsx`
- `tests/unit/chat-sidebar-deep-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Chat Sidebar Deep 当前设计决策
- `ChatSidebar` 外壳继续沿用 `kk-workspace-*`，深层菜单单独使用 `kk-chat-sidebar-*` 命名空间，避免把聊天侧栏内部细节塞进通用 workspace primitive。
- 悬浮菜单统一使用 `KK_LAYER.dropdown`；导入预览遮罩使用 `KK_LAYER.modalBackdrop`，不再维护局部超大 z-index。
- danger 和 active filter 状态通过 token 表达，后续新增“删除/排除/危险操作”应复用 `.kk-chat-sidebar-menu-item--danger` 或 `.kk-chat-sidebar-filter-toggle--active`。

### Chat Sidebar Deep 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-sidebar-deep-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/chat-sidebar-deep-ui-system-contract.test.ts tests/unit/workspace-chrome-ui-system-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/result-surface-ui-system-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/ui-unused-cleanup-contract.test.ts`: 19 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；本轮目标 ChatSidebar 深层 `z-[1000]` / `z-[10020]` / `z-[10030]` 已清除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；本轮目标 ChatSidebar 黑底/zinc/red 硬编码菜单已清除。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。

### Chat Sidebar Deep 未运行验证及原因
- 本轮未重新完成 Browser runtime screenshot QA：当前重点是 ChatSidebar 深层菜单源码系统化、契约、类型、架构和构建收口；真实菜单 hover、导入预览弹窗视觉抽样建议与后续 PromptBar/Canvas 浮层一起做。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Chat Sidebar Deep 风险与下一步
- raw color / raw z-index 历史清单仍包含 Canvas 交互浮层、Admin 浮层、PromptBar 更深层模型菜单/弹窗浮层和部分 ecommerce 面板。
- 下一轮建议优先处理 Canvas 交互浮层或 PromptBar 更深层模型菜单/弹窗浮层；它们现在是主工作流中最明显的剩余并行视觉系统。

## 2026-06-12 - Image Card UI System Pass

### Image Card 修改范围
- 将 `ImageCard2` 的加载骨架、错误/失效占位、生成中遮罩、加载遮罩、PPT badge、视频播放覆盖层、停止生成按钮和下载菜单收口到 `kk-image-card-*` primitive。
- 移除 `ImageCard2` 中面向 UI 的 `z-[1100]` / `LayerPortal zIndex={1100}`、`bg-black/*`、`bg-white/*`、`border-white/*`、`text-white`、red utility、`shadow-2xl`、裸 `rgba(...)` / 旧式 `rgb(...)` 写法。
- 下载菜单改用 `LayerPortal` + `KK_LAYER.dropdown`，卡片激活边框、错误边框、状态背景和视频控件均改由 `kk-ui-tokens.css` 管理。
- 顺手补齐 `AppDesktopChrome` 和 `LazyModuleBoundary` 的 frosted surface fallback，让桌面顶栏、用户菜单和懒加载失败面板继续显式绑定 `--frost-card-*` 材质 token。

### Image Card 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/image/ImageCard2.tsx`
- `tests/unit/image-card-ui-system-contract.test.ts`
- `apps/web/src/app/AppDesktopChrome.tsx`
- `apps/web/src/components/common/LazyModuleBoundary.tsx`
- `docs/development/session-handoff.md`

### Image Card 当前设计决策
- 图片卡片只保留业务态判断；视觉状态通过 `.kk-image-card-state` 和 `--error` / `--expired` / `--generating` / `--loading` modifier 表达，避免在组件里继续拼接一次性颜色。
- 卡片内部下载菜单使用全局 layer token，后续新增更多浮动菜单时应复用 `LayerPortal` 与 `KK_LAYER.dropdown`，不要再写私有大 z-index。
- `AppDesktopChrome` 和 `LazyModuleBoundary` 的 inline style 只承担系统 token fallback 与源码契约可见性，主要视觉仍由 `kk-workspace-*` / `kk-lazy-boundary-*` class 承载。

### Image Card 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-card-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-card-ui-system-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/key-manager-wuyin-route-regression.test.ts tests/unit/canvas-visual-regression.test.ts tests/unit/canvas-snap-to-grid-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts tests/unit/ecommerce-structured-task-source-contract.test.ts tests/unit/ui-unused-cleanup-contract.test.ts tests/unit/result-surface-ui-system-contract.test.ts`: 38 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: completed with existing non-blocking warning list；`ImageCard2` 已从本轮目标裸 z-index 清单中清除。
- `node scripts/architecture/check-ui-token-literals.mjs`: completed with existing non-blocking warning list；`ImageCard2` 已从本轮目标裸色值清单中清除。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。

### Image Card 未运行验证及原因
- 本轮未重新完成 Browser runtime screenshot QA：当前重点是 ImageCard2 源码系统化、契约、类型、架构和构建收口；真实卡片缩略图、视频覆盖和下载菜单视觉手感建议在后续统一视觉抽样中完成。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Image Card 风险与下一步
- raw color / raw z-index 历史清单仍包含 Canvas 交互浮层、Admin 浮层、PromptBar 更深层模型菜单/弹窗浮层和部分 ecommerce 面板；ChatSidebar 深层菜单已在后续 Chat Sidebar Deep pass 中收口，PromptBar 局部数量气泡与积分 tooltip 已在后续 Prompt Bar Local Overlay pass 中收口。
- 下一轮建议优先处理 Canvas 交互浮层与 PromptBar 更深层模型菜单/弹窗浮层；它们仍是主工作流里最容易把视觉系统重新分叉的区域。

## 2026-06-12 - Redraw Workspace UI System Pass

### Redraw Workspace 修改范围
- 将 `RedrawWorkspace` 的全屏编辑器、关闭按钮、浮动工具条、画笔控制、色板、色块提示输入、底部 prompt composer、参考图托盘收口到 `kk-redraw-*` primitive。
- 移除 `RedrawWorkspace` 中的 `z-[100000]` / `z-20` / `z-30`、`bg-black/*`、`bg-white/*`、`border-white/*`、`text-white/*`、`shadow-2xl`、裸 hex / `rgba(...)` UI 写法。
- 新增 redraw 专属 token，覆盖 fullscreen 背景、toolbar、control active/inactive、composer、reference tile、annotation stroke/fill、draft stroke 和标准色板。
- 保留局部重绘业务逻辑：框选、画笔、色块、参考图上传、本地模型路由、`buildRedrawPlan`、`assignColorBlockLabels`、提交 payload 均保持原语义。

### Redraw Workspace 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/image/RedrawWorkspace.tsx`
- `tests/unit/redraw-workspace-ui-system-contract.test.ts`

### Redraw Workspace 当前设计决策
- `RedrawWorkspace` 使用 `KK_LAYER.fullscreen` 管理全屏层级；内部工具条层级只在 CSS primitive 中通过系统 z token 处理，不在组件里写裸 `z-[...]`。
- 标准色板拆成“UI token 渲染色”和“业务色值”：色板显示走 `--kk-redraw-swatch-*`，写入 `RedrawColorBlock.color` 的仍是可被 `assignColorBlockLabels` 识别的标准色值，避免 @红色 / @蓝色 等提示语义退化。
- Canvas 标注导出使用 `readCssToken('--kk-redraw-annotation-*')` 读取系统 token，避免组件源码继续携带裸色值，同时保持 annotated reference image 的绘制能力。

### Redraw Workspace 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/redraw-workspace-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/redraw-workspace-ui-system-contract.test.ts tests/unit/partial-redraw-modal-contract.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/image-overlay-ui-system-contract.test.ts tests/unit/ppt-overlay-ui-system-contract.test.ts tests/unit/result-surface-ui-system-contract.test.ts tests/unit/partial-redraw-model-capabilities.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tests/unit/redraw-core.test.ts`: 21 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: reports existing non-blocking warning list；`RedrawWorkspace` 已从裸 z-index 清单中清除。
- `node scripts/architecture/check-ui-token-literals.mjs`: reports existing non-blocking warning list；`RedrawWorkspace` 已从裸色值清单中清除。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。

### Redraw Workspace 未运行验证及原因
- 本轮未重新完成 Browser runtime screenshot QA：当前重点是 RedrawWorkspace 源码系统化、契约、类型、架构和构建收口；真实图像编辑手感建议在后续 Image/Card/Canvas 视觉抽样中统一做。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Redraw Workspace 风险与下一步
- raw color / raw z-index 历史清单仍包含 Canvas 交互浮层、Admin 浮层、ChatSidebar 局部菜单和部分 ecommerce 面板；`ImageCard2` 已在后续 Image Card pass 中收口。
- 下一轮建议优先处理 Canvas 交互浮层和 PromptBar 更深层模型菜单/弹窗浮层，因为它们直接影响主画布页和图片结果工作流的一致性；ChatSidebar 深层菜单已在后续 Chat Sidebar Deep pass 中收口，PromptBar 局部数量气泡与积分 tooltip 已在后续 Prompt Bar Local Overlay pass 中收口。

## 2026-06-12 - PPT Overlay UI System Pass

### PPT Overlay 修改范围
- 将 `PptStackPreviewModal` 和 `PptDeckEditorModal` 收口到统一的 `kk-image-modal-*` / `kk-ppt-*` overlay、deck、slide nav、preview frame、layer card primitive。
- 移除 PPT 预览/编辑弹窗中的 `z-[100000]` / `z-[100001]`、`bg-black/*`、`border-white/*`、`text-white/*`、sky/slate/hex/`rgba(...)` 一次性视觉类。
- 新增 PPT 专属 token，覆盖整屏拼接页、页码 badge、slide nav 选中态、预览 frame、图层卡片和图层默认文字色。
- 保留 PPT 分层编辑业务逻辑；仅将文本层背景色转换输出从 `rgba(...)` 改为现代 `rgb(r g b / a)`，并把默认文字色切到 `--kk-ppt-layer-default-text`。

### PPT Overlay 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/image/PptStackPreviewModal.tsx`
- `apps/web/src/components/image/PptDeckEditorModal.tsx`
- `tests/unit/ppt-overlay-ui-system-contract.test.ts`

### PPT Overlay 当前设计决策
- PPT stack 和 deck editor 都使用 `KK_LAYER.fullscreen`，不再维护组件私有超大层级。
- PPT 视觉继承 image modal 的 backdrop、panel、control、field、primary、icon button primitive，再用 `kk-ppt-*` 补充 PPT 独有结构。
- slide 选中态通过 `data-active` 驱动 CSS，而不是在组件里拼接 sky/border/shadow 工具类，便于以后新增 PPT 页面能力继续沿用同一套状态语义。

### PPT Overlay 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-overlay-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ppt-overlay-ui-system-contract.test.ts tests/unit/image-overlay-ui-system-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/result-surface-ui-system-contract.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/responsive-surface.test.ts`: 19 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: reports existing non-blocking warning list；`PptStackPreviewModal` / `PptDeckEditorModal` 已从裸 z-index 清单中清除。
- `node scripts/architecture/check-ui-token-literals.mjs`: reports existing non-blocking warning list；本轮 PPT 目标文件已从裸色值清单中清除。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍打印历史 raw color / raw z-index warning list。
- `npm.cmd run build`: passed。

### PPT Overlay 未运行验证及原因
- 本轮未重新完成 Browser runtime screenshot QA：当前重点是 PPT 浮层源码契约、类型、架构和构建收口；运行态视觉抽样保留到更大一轮 Image/Canvas 浮层收口。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### PPT Overlay 风险与下一步
- Canvas 交互浮层、Admin 浮层和部分 layout 菜单仍在历史 raw color / raw z-index warning list 中；`ImageCard2` 已在后续 Image Card pass 中收口。
- `RedrawWorkspace`、ChatSidebar 深层菜单和 PromptBar 局部数量气泡/积分 tooltip 已在后续 pass 中收口；下一轮建议优先处理 Canvas 交互浮层和 PromptBar 更深层模型菜单/弹窗浮层。

## 2026-06-12 - Image Overlay UI System Pass

### Image Overlay 修改范围
- 将 `ImagePreview` 和 `PartialRedrawModal` 收口到统一 `kk-image-*` overlay / modal / control / selection primitive。
- 移除 `ImagePreview` 中的 `z-[9998]` / `z-[9999]`、内联 `rgba(...)` 边框/阴影/背景，改用 `KK_LAYER.fullscreen` 和 `.kk-image-preview-*`。
- 移除 `PartialRedrawModal` 中的 `z-[100000]`、`bg-black/*`、`border-white/*`、`text-white/*`、indigo/sky/emerald/amber 一次性状态色，改用 `.kk-image-modal-*`、`.kk-image-selection-frame`、`.kk-image-generation-frame`。
- 为局部重绘弹窗补齐 44px 控件热区、统一字段/按钮/参考图/信息面板/警告状态 token。

### Image Overlay 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/image/ImagePreview.tsx`
- `apps/web/src/components/image/PartialRedrawModal.tsx`
- `tests/unit/image-overlay-ui-system-contract.test.ts`

### Image Overlay 当前设计决策
- 图片预览和局部重绘都使用 `KK_LAYER.fullscreen`，不再使用组件私有超大 `z-[...]`。
- Image overlay 视觉沿用 result/lightbox 的 panel、control、motion 体系，但单独暴露 `--kk-image-*` token，避免局部重绘选择框和参考图状态污染通用 result token。
- 局部重绘的业务交互保持不变：模型/比例选择、框选、参考图上传、提交条件和 `PartialRedrawRequest` 结构均未改动。

### Image Overlay 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-overlay-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node scripts/architecture/check-no-raw-zindex.mjs`: passed with existing non-blocking warning list；`ImagePreview` / `PartialRedrawModal` 已从裸 z-index 清单中清除。
- `node scripts/architecture/check-ui-token-literals.mjs`: passed with existing non-blocking warning list；`ImagePreview` / `PartialRedrawModal` 已从本轮目标裸色值搜索中清除。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/image-overlay-ui-system-contract.test.ts tests/unit/result-surface-ui-system-contract.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/partial-redraw-model-capabilities.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/mobile-result-feed-app-contract.test.ts tests/unit/ecommerce-partial-redraw-runtime-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts`: 19 tests passed。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed。
- `npm.cmd run build`: passed。

### Image Overlay 未运行验证及原因
- 本轮未重新完成 Browser runtime screenshot QA：当前重点是 Image overlay 源码契约、类型、架构和构建收口；完整视觉抽样保留到更大一轮 Image/Canvas 浮层收口。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Image Overlay 风险与下一步
- `PptDeckEditorModal`、`PptStackPreviewModal`、`RedrawWorkspace` 和 `ImageCard2` 已在后续同日 pass 中收口。
- `architecture:check` 仍报告 Canvas 交互浮层、Admin 浮层和部分 layout 菜单等历史 raw color / raw z-index warning。

## 2026-06-11 - Common Overlay UI System Pass

### Common Overlay 修改范围
- 将 `LazyModuleBoundary`、`TutorialOverlay`、`WorkspaceStartupSkeleton` 收口到 common overlay/startup UI primitive。
- `LazyModuleBoundary` 移除裸 `z-[130]` 与 `bg-black/45`，改用 `.kk-lazy-boundary-*` 和 `KK_LAYER.toolbar`。
- `TutorialOverlay` 根层移除 `z-[99999]`，改用 `.kk-tutorial-overlay-root` 和 `KK_LAYER.fullscreen`。
- `WorkspaceStartupSkeleton` 移除启动骨架屏内联 `rgba(...)` / hex 色值与 `z-[110]`，改用 `.kk-workspace-startup-*` token/class 和 `KK_LAYER.toolbar`。

### Common Overlay 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/common/LazyModuleBoundary.tsx`
- `apps/web/src/components/common/TutorialOverlay.tsx`
- `apps/web/src/components/common/WorkspaceStartupSkeleton.tsx`
- `tests/unit/common-overlay-ui-system-contract.test.ts`
- `tests/unit/result-surface-ui-system-contract.test.ts`

### Common Overlay 当前设计决策
- common 层覆盖物必须通过 `KK_LAYER` 进入系统层级，不再在组件里新增超大 `z-[...]`。
- 启动骨架屏使用 `kk-workspace-startup-*`，与 workspace chrome token 保持同一视觉语言，但不改启动状态逻辑。
- lightbox 背景契约更新为检查 `.kk-lightbox-backdrop` CSS primitive，不再要求组件内保留 `rgb(var(--kk-result-overlay-rgb) / ...)` 表达式。

### Common Overlay 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/common-overlay-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/common-overlay-ui-system-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/notification-toast-ui-system-contract.test.ts tests/unit/result-surface-ui-system-contract.test.ts tests/unit/workspace-chrome-ui-system-contract.test.ts tests/unit/login-screen-auth-actions.test.ts tests/unit/theme-system-adaptation.test.ts`: 19 tests passed。
- `node scripts/architecture/check-ui-token-literals.mjs`: passed with existing non-blocking warning list；本轮目标 common 文件已从精准裸色值搜索中清除。
- `node scripts/architecture/check-no-raw-zindex.mjs`: passed with existing non-blocking warning list；本轮目标 common 文件已从裸 z-index 清单中清除。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。

### Common Overlay 未运行验证及原因
- 本轮未重新完成 Browser runtime screenshot QA：这一步主要是 common 浮层源码系统化与契约守卫，未改变业务数据流或路由入口。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Common Overlay 风险与下一步
- `architecture:check` 仍报告 `AdminRechargeFloatingPanel`、`Canvas.tsx`、`CanvasDrawingInteractionOverlay`、`CanvasGroupComponent`、`PendingNode`、`PromptNodeComponent` 等存量 raw color / raw z-index warning；Image overlay、PPT overlay、RedrawWorkspace 和 ImageCard2 已在后续 pass 中收口。
- 下一轮建议优先收口 Canvas 交互浮层与 PromptBar 更深层模型菜单/弹窗浮层，避免核心画布交互继续形成平行视觉系统；ChatSidebar 深层菜单和 PromptBar 局部数量气泡/积分 tooltip 已在后续 pass 中收口。

## 2026-06-11 - Overlay & Notification UI System Pass

### Overlay/Notification 修改范围
- 将微信扫码弹窗、全局 lightbox、画布选择菜单和通知 Toast 收口到统一 overlay / auth modal / canvas menu / toast UI 系统。
- 新增 `KK_LAYER.fullscreen`，并让高层覆盖物使用 `KK_LAYER` 管理层级，避免继续新增裸 `z-[...]` 或任意 `zIndex`。
- 将 Toast 的 success/error/warning/info/payment/update 状态色、抽屉、移动胶囊、操作按钮和详情区迁移到 `kk-toast-*` token/class。
- 将 lightbox 动态遮罩透明度改为 `--kk-lightbox-backdrop-opacity`，组件只传变量，颜色表达式由 CSS 系统管理。

### Overlay/Notification 修改文件
- `packages/ui/src/core/layers.ts`
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/auth/WechatQrModal.tsx`
- `apps/web/src/components/image/GlobalLightbox.tsx`
- `apps/web/src/components/canvas/SelectionMenu.tsx`
- `apps/web/src/components/common/NotificationToast.tsx`
- `tests/unit/overlay-layer-ui-system-contract.test.ts`
- `tests/unit/notification-toast-ui-system-contract.test.ts`

### Overlay/Notification 当前设计决策
- 认证弹窗统一使用 `.kk-overlay-backdrop` / `.kk-auth-modal-*`，微信扫码不再保留独立深色面板、边框和大阴影写法。
- 全屏 lightbox 使用 `.kk-lightbox-backdrop` 与 `KK_LAYER.fullscreen`；背景透明度保留拖拽动态，但不再在组件中硬编码 `rgb(...)`。
- 画布选择菜单使用 `.kk-canvas-selection-menu` / `.kk-canvas-selection-menu-item` 和 `KK_LAYER.floating`，后续新增批量操作项必须沿用该菜单 primitive。
- Toast 使用 `data-type` 驱动状态视觉，堆叠深度通过 `--kk-toast-card-stack-index` 传入，样式统一在 `kk-ui-tokens.css` 中维护。

### Overlay/Notification 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/notification-toast-ui-system-contract.test.ts`: 先红后绿，最终 2 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/notification-toast-ui-system-contract.test.ts`: 5 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/notification-toast-ui-system-contract.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts tests/unit/result-surface-ui-system-contract.test.ts tests/unit/workspace-chrome-ui-system-contract.test.ts tests/unit/login-screen-auth-actions.test.ts tests/unit/theme-system-adaptation.test.ts`: 17 tests passed。
- `node scripts/architecture/check-ui-token-literals.mjs`: passed with existing non-blocking warning list; this pass removed `NotificationToast` and `GlobalLightbox` from the newly targeted warnings。
- `node scripts/architecture/check-no-raw-zindex.mjs`: passed with existing non-blocking warning list; this pass removed `WechatQrModal` / `GlobalLightbox` / `SelectionMenu` from the targeted warnings。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；raw color / z-index warning list remains non-blocking and points to older areas outside this pass。
- `npm.cmd run build`: passed。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run check:encoding`: passed。

### Overlay/Notification 未运行验证及原因
- 本轮未重新完成 Browser runtime screenshot QA：当前阶段优先做源码契约、类型、架构和构建收口；此前 dev server / preview 生命周期在自动化 shell 下存在短暂退出和加载态限制。
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，完整发布级验证保留到全局 UI 收口或发布前执行。

### Overlay/Notification 风险与下一步
- `architecture:check` 仍报告 `AdminRechargeFloatingPanel`、`CanvasDrawingInteractionOverlay`、`CanvasGroupComponent`、`PendingNode`、`PromptNodeComponent` 等历史 raw color / raw z-index warning；TutorialOverlay 和 ImageCard2 已在后续 pass 中收口。
- 下一轮建议优先收口 `CanvasDrawingInteractionOverlay`、`CanvasGroupComponent` 与 `AdminRechargeFloatingPanel`，这些区域仍会影响浮层一致性和专业 UI 系统延展性。

## 2026-06-11 - Workspace Chrome UI System Pass

### Workspace 修改范围
- 将桌面顶部 chrome、用户菜单、充值/退出操作、画布导航 minimap、ChatSidebar 外壳与高频图标按钮收口到统一 `kk-workspace-*` UI 系统。
- 新增 workspace chrome token、surface/control/action/minimap/edge-toggle 复用类，补齐 44px 触控热区、统一玻璃/实体 fallback、层级 token 与 reduced-motion 约束。
- 主画布页整体结构未重排，只对常驻 chrome 和边缘控件做系统化微调，降低后续新增工具按钮、菜单、侧栏时继续扩散硬编码颜色、阴影、z-index 的风险。

### Workspace 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/app/AppDesktopChrome.tsx`
- `apps/web/src/app/AppCanvasNavigationPanel.tsx`
- `apps/web/src/components/layout/ChatSidebar.tsx`
- `tests/unit/workspace-chrome-ui-system-contract.test.ts`

### Workspace 当前设计决策
- 工作区常驻 chrome 统一使用 `.kk-workspace-chrome-surface` / `.kk-workspace-menu-surface`；按钮统一使用 `.kk-workspace-control`、`.kk-workspace-icon-control`、`.kk-workspace-primary-action`、`.kk-workspace-danger-action`。
- ChatSidebar 外壳使用 `KK_LAYER.drawer`，用户菜单使用 `KK_LAYER.modalBackdrop` / `KK_LAYER.modal`，不再继续新增超大裸 `z-[...]` 层级。
- 画布 minimap 的背景、网格、节点、视口全部改用 `--kk-workspace-minimap-*` token；后续新增 minimap 状态色必须先补 token 再接组件。
- 本轮不改变画布交互逻辑、生成逻辑或认证逻辑，只做 UI 系统化和视觉一致性收口。

### Workspace 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/workspace-chrome-ui-system-contract.test.ts`: 先红后绿，最终 3 tests passed。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/workspace-chrome-ui-system-contract.test.ts tests/unit/prompt-bar-surface-token-regression.test.ts tests/unit/prompt-bar-layout-regression.test.ts tests/unit/app-shell-panel-layer.test.ts tests/unit/mobile-app-shell-contract.test.ts tests/unit/result-surface-ui-system-contract.test.ts`: 19 tests passed。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed；仍输出既有 raw color / z-index warning 清单，当前脚本将其作为非阻断提醒。
- `npm.cmd run build`: passed。
- 构建产物确认：`apps/web/dist/assets/index-Bh3mJmce.css` 已包含 `kk-workspace-chrome-surface`、`kk-workspace-icon-control`、`kk-workspace-canvas-minimap` 与 `--kk-touch-target-min` 相关规则。
- Browser runtime QA 限制记录：重启前的 3000 dev server 返回旧 CSS transform cache；`npm.cmd run dev:restart` / `npm.cmd run dev:start` 在当前自动化 shell 中短暂 ready 后 Vite 进程退出；`vite preview` 可启动，但临时用户进入后停留在启动加载态，未能完成主工作区运行态截图验证。

### Workspace 未运行验证及原因
- 未运行完整 `npm run verify:changes`：当前 UI 总目标仍在分阶段推进，本轮已覆盖相关合约、类型、架构、构建与构建产物样式确认；完整发布级验证留到全局 UI 收口或发布前执行。
- 浏览器主工作区运行态截图未完成：受当前 dev server 缓存/进程生命周期和 preview 本地临时认证启动态限制影响，未通过修改业务状态强行绕过。

### Workspace 风险与下一步
- ChatSidebar 下半部分资源面板部分卡片仍有历史硬编码色值；导入预览弹窗和会话上下文菜单已在后续 Chat Sidebar Deep pass 中收口。
- `architecture:check` 仍提示历史 Canvas、PromptBar 深层菜单/弹窗、Admin 和部分 ecommerce raw color / raw z-index warning；下一轮建议优先收口 Canvas toolbar / drawing overlay 与 PromptBar 更深层模型菜单/弹窗浮层。
- 当前工作区有大量本轮之前的并行修改和未跟踪文件，本轮没有回滚、重排或替代这些改动。

## 2026-06-11 - Result Surface UI System Pass

### Result Surface 修改范围
- 将移动结果瀑布流、移动结果卡片和全局灯箱收口到统一 `kk-result-*` UI 系统，补齐结果面 overlay、panel、control、danger、selected、bottom scrim 和 media edge token。
- 为结果面控件建立 44px 触控热区、统一 motion timing、reduced motion 协议和透明度 fallback，降低后续新增结果操作时继续扩散一次性颜色/动效的风险。
- 在开发预览 `/stress-lab` 中加入结果面系统预览，覆盖 `MobileResultFeed`、`MobileResultTile` 和 `GlobalLightbox` 的组合呈现。

### Result Surface 修改文件
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/components/image/GlobalLightbox.tsx`
- `apps/web/src/components/mobile/MobileResultFeed.tsx`
- `apps/web/src/components/mobile/MobileResultTile.tsx`
- `apps/web/src/dev/StressLab.tsx`
- `apps/web/src/app/AppRootContentSwitch.tsx`
- `tests/unit/result-surface-ui-system-contract.test.ts`
- `tests/unit/mobile-result-feed-detail-contract.test.ts`

### Result Surface 当前设计决策
- 结果面新增或改造操作必须优先复用 `kk-result-control`、`kk-result-icon-control`、`kk-result-primary-action`、`kk-result-danger-control` 和 `kk-result-panel`，不再在组件内直接硬编码一次性色系和零散 hover 边框。
- 结果面高层容器统一使用 `.kk-result-surface`，视觉层级由 `--kk-result-overlay-rgb`、`--kk-result-panel-bg`、`--kk-result-card-bg` 与已有 app layer/touch token 协作。
- `GlobalLightbox` 和 `MobileResultFeed` 的动效使用 `--kk-motion-standard`、`--kk-motion-panel` 与 `--kk-motion-ease-standard`，并受 `prefers-reduced-motion` 与应用 motion scale 约束。
- `/stress-lab` 仅作为 dev visual QA 入口；生产构建中代码可被打包验证，但运行时入口仍由 `import.meta.env.DEV` 限制。

### Result Surface 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/result-surface-ui-system-contract.test.ts tests/unit/mobile-result-feed-detail-contract.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/theme-contrast-contract.test.ts`: 33 tests passed.
- `npm.cmd run architecture:check`: passed；仍输出既有 raw color / z-index warning 清单，当前脚本将其作为非阻断提醒。
- `npm.cmd run governance:check`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed.
- `npm.cmd run dev:status`: Vite `3000` 与 API `3001` 均 healthy。
- Browser runtime QA: `http://127.0.0.1:3000/stress-lab` 在桌面 `1280x720` 和移动 `390x844` 下无横向溢出；移动结果卡片 4 个可见；结果灯箱可打开；可见 `kk-result-control` / `kk-result-icon-control` 控件均不小于 44px；reduced motion 规则可检测。

### Result Surface 未运行验证及原因
- 未运行完整 `npm run verify:changes`：当前目标仍在分阶段推进，本轮已覆盖架构、治理、类型、构建、编码、相关单元合约与浏览器运行时抽样；完整发布级验证留到全局 UI 收口或发布前执行。

### Result Surface 风险与下一步
- `architecture:check` 仍报告历史 raw color / z-index warning，后续全局 UI 优化应继续把 canvas toolbar、drawing overlay、Admin 浮层和 PromptBar 更深层模型菜单/弹窗浮层等高频浮层纳入 token/layer 系统；ChatSidebar 深层菜单和 PromptBar 局部数量气泡/积分 tooltip 已收口。
- 主画布整体问题不大，本轮仅收口结果面；下一步建议继续排查 `ChatSidebar`、`PromptBar` 与 Canvas 交互浮层，保证设置页以外的高频工作流也沿用同一系统。
- 当前工作区有大量本轮之外的修改与未跟踪文件，本次未回滚、重排或替代这些并行改动。

## 1. 修改范围
- API 多供应商生成链路继续保持当前收口方向：共享契约、API client、server dispatcher 和前端 provider routing 按 `packages/shared` -> `packages/api-client` -> `server` -> `apps/web` 分层治理。
- 设置页完成系统化 UI 基线：`Appearance & Motion`、Settings scaffold primitives、系统 CSS 变量、架构守卫和移动端标题/操作区修复。
- 启动体验完成真实 UI 替换：`AppStartupScreen` 不再依赖不可运行的测试占位代码，真实渲染品牌启动厅、阶段状态、进度条和警告态。
- 登录页完成首屏系统化调优：品牌名回到 `KK Studio`，背景/卡片/输入框/按钮/Turnstile/版本徽标接入统一 auth system 变量，并修复移动端底部动作可见性。
- 主画布页保持整体结构不大改，只继续保留既有 canvas、prompt bar、runtime banner 和移动端 shell 的验证入口。

## 2. 修改文件
- `packages/ui/src/core/tokens.ts`: 新增 `TOKENS.uiSystem`，统一断点、间距、触控尺寸、布局、glass 和 motion 基线。
- `apps/web/src/styles/kk-ui-tokens.css`: 新增 `--kk-space-*`、page margins、content widths、touch target、glass、motion scale、solid fallback 等变量。
- `apps/web/src/context/AppearanceMotionContext.tsx` 与 `apps/web/src/App.tsx`: 新增外观与动态偏好 Provider，并同步 CSS variables。
- `apps/web/src/components/settings/SettingsScaffold.tsx`, `apps/web/src/styles/settings.css`: 新增 settings system page/card/field/grid/glass contract，并修复移动端 hero 排版。
- `apps/web/src/components/settings/views/AppearanceMotionView.tsx`, `settingsRegistry.ts`, `settingsRouteConfig.tsx`, `useWorkspaceSurface.ts`: 接入 `appearance-motion` 页面。
- `apps/web/src/components/settings/SettingsPanel.localized.tsx`: 移动端顶部标题改为普通文本容器，避免重复 heading landmark。
- `apps/web/src/components/common/AppStartupScreen.tsx`: 用真实品牌启动厅替换简陋百分比 fallback 和 dead-code 测试占位。
- `apps/web/src/app/AppRootContentSwitch.tsx`: 设置页/后台页 lazy fallback 复用 `AppStartupScreen`，去掉黑底蓝色 spinner。
- `apps/web/src/components/auth/LoginScreen.tsx`, `apps/web/src/components/auth/LoginScreen.css`: 登录页接入 auth system 变量，品牌改为 `KK Studio`，优化桌面/移动端视觉和动作区。
- `scripts/architecture/check-settings-ui-system.mjs`, `package.json`: 将设置 UI 系统守卫接入 `architecture:check`。
- `tests/unit/settings-ui-system-contract.test.ts`, `tests/unit/settings-entry-surface-style-regression.test.ts`, `tests/unit/login-screen-auth-actions.test.ts`, `tests/unit/mobile-settings-browser-verify-script.test.ts`: 补充 UI 系统、启动页、登录页和 settings smoke source contracts。
- `scripts/test/verify-desktop-settings-smoke.mjs`: 更新 fallback source contracts，减少旧文案依赖。
- `docs/development/session-handoff.md`: 整理为单一去重交接记录，避免治理脚本重复标题失败。

## 3. 当前设计决策
- 新增设置页必须优先复用 `SettingsViewShell`、`SettingsHero`、`SettingsSystemCard`、`SettingsSystemField` 和 `SETTINGS_UI_SYSTEM`。
- glass 只用于导航、工具层、设置卡片和轻量浮层；长文本和表单仍使用实体或低透明背景，并保留 solid fallback。
- 动效统一通过 `--kk-ui-motion-scale`、`--kk-motion-standard` 和系统 reduced motion 协同，不在新 UI 中随意硬编码时长。
- 登录页采用覆盖式系统化：不改认证逻辑，只用 CSS 变量和少量语义结构修复首屏视觉、品牌一致性和移动端可见性。
- 浏览器截图以实际运行状态为准；源码契约只能用于防止回归，不能替代视觉检查。

## 4. 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-ui-system-contract.test.ts`: 通过。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/mobile-settings-browser-verify-script.test.ts`: 通过。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/settings*.test.ts" tests/unit/mobile-settings-browser-verify-script.test.ts`: 54 项通过。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-entry-surface-style-regression.test.ts tests/unit/app-startup-coordinator.test.ts tests/unit/kkai-app-root.test.ts tests/unit/settings-canonical-entry-regression.test.ts`: 通过。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/login-screen-auth-actions.test.ts tests/unit/theme-system-adaptation.test.ts tests/unit/theme-contrast-contract.test.ts`: 通过。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/login-screen-auth-actions.test.ts tests/unit/auth-localization.test.ts`: 通过。
- `npm run architecture:check`: 通过；仍输出历史 raw color / z-index warning，但当前守卫不阻断，且新增 Settings UI System Check 通过。
- `npm run governance:check`: 通过。
- `npm run typecheck`: 通过。
- `npm run build`: 通过。
- Playwright visual QA:
  - `http://127.0.0.1:3000/settings/appearance-motion`: 已检查 1440x920 与 430x932，无横向溢出，hero 不重叠，CSS 变量可同步。
  - 登录页 `http://127.0.0.1:3000/`: 已检查 1440x920 dark、1440x920 light、430x932 dark；品牌为 `KK Studio`，无横向溢出，移动端 `Sign up` / `Forgot your password?` 均为 44px 高且首屏可见。
- `npm run dev:status`: Vite 3000 与 API 3001 均 healthy。

## 5. 未运行验证及原因
- 未运行完整 `npm run verify:changes`：当前目标仍在推进中，本轮已覆盖架构、类型、重点单元契约和浏览器视觉 QA；完整发布级套件留给阶段性收口或发布前执行。

## 6. 风险与下一步
- 当前工作区存在较多本次任务之外的已修改/未跟踪文件，本轮没有回滚、重排或代替处理这些并行改动。
- `architecture:check` 仍报告历史 raw color / z-index warning；当前脚本将其作为非阻断提醒，但后续全面 UI 优化应逐步把高频浮层、modal、canvas toolbar 收口到 token/layer 系统。
- 登录页已经视觉收口，但 `WechatQrModal`、旧 `LoginForm`、若干 auth 子组件仍有独立色值，后续应继续纳入 auth system。
- 桌面/移动 settings smoke 的浏览器主路径仍受既有 API workbench 按钮文案/可见性影响进入 fallback；建议后续改成稳定 test id 主路径。
- 下一步建议继续审计：PromptBar 更深层模型菜单/弹窗 / Canvas 交互浮层 / Admin 浮层 / ecommerce panels，以及 ChatSidebar 资源面板剩余卡片，这些是用户日常最高频 UI 面。

## 7. 版本治理与声明
- 本轮遵循 KK Studio v1.5.6 当前事实，`config/release-manifest.json` 为主版本源。
- `apps/web/src/config/appInfo.ts` 运行时只读导出。
- `release/publish/stable/manifest.json` 为 portable stable 发布清单。
- 当前 Web runtime 为 `apps/web/`，未回退到根 `src/` 或历史入口。
- AI 相关治理仍以 `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`、`ToolRegistry`、`CanvasRuntimeState`、`DurableGenerationQueue`、`assets.zipOriginals`、`generation.createBatchJob` 为关键术语与能力边界。
- 生产密钥、支付状态、用户隐私路径和数据库凭据未写入前端或文档。

Primary Web runtime: `apps/web/`
Mobile workspace: `apps/mobile/`

