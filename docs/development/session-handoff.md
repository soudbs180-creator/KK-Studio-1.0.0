# Session Handoff - UI System Optimization and Runtime Governance

**Last Updated:** 2026-06-16 (Premium Landing Pass)
**Version:** KK Studio v1.5.7

## 2026-06-16 - Premium Landing Page and Empty Canvas Welcome State

### Premium Landing Scope
- 基于现有 Vite + React 19 + TypeScript + Tailwind 架构，全新改造了 KK Studio 的营销落地页 / 未登录首页，代替了原先简陋的 SaaS 蓝紫霓虹科技风格。
- 引入了暖奶油背景 `#fffaf0` + 近黑墨 `#0a0a0a` + 珊瑚粉与淡桃色的低对比优雅渐变，融入了噪点颗粒感（noise overlay）美学。
- 实现极简磨砂毛玻璃顶栏导航组件 `LandingChrome.tsx`，支持桌面和移动端安全折叠菜单。
- 实现非对称的作品集式特色卡片网格 `FeatureNarrative.tsx`，展示无限画布、多模型路由、电商流、智能体等产品叙事。
- 实现交互式步骤时间线组件 `ProcessTimeline.tsx`，在滚动进入视口时动态激活高亮状态。
- 实现纯前端高还原度的工作台预览组件 `CanvasPreviewMock.tsx`，通过 SVG 虚线动效展示节点的流向，无任何额外性能负担。
- 新增针对已登录用户的“空画布欢迎态”组件 `EmptyCanvasWelcome.tsx`。当判定画布完全无节点时呈极简卡片排版提示，包含快速上手指示，并可一键载入已注册的 workflow 预设模板（如 Ecommerce Workflow 等）。
- 重构了 `LoginScreen.tsx`。移除了旧的 slider 首屏，使用全新的 `<KkLandingPage />` 代替。登录、注册及微信/Google第三方认证表单整体被封装在了点击按钮才弹出的 Frosted Modal 磨砂浮层内，做到对原有鉴权逻辑零改动、零破坏。
- 修改 `App.tsx`，定义了 `isCanvasEmpty` 状态变量，在画布为空且非移动端时自动渲染 `<EmptyCanvasWelcome />`。

### Premium Landing Files Touched
- `apps/web/src/landing/landingContent.ts` [NEW]
- `apps/web/src/landing/landingStyles.css` [NEW]
- `apps/web/src/landing/LandingChrome.tsx` [NEW]
- `apps/web/src/landing/CanvasPreviewMock.tsx` [NEW]
- `apps/web/src/landing/FeatureNarrative.tsx` [NEW]
- `apps/web/src/landing/ProcessTimeline.tsx` [NEW]
- `apps/web/src/landing/LandingCTA.tsx` [NEW]
- `apps/web/src/landing/KkLandingPage.tsx` [NEW]
- `apps/web/src/landing/EmptyCanvasWelcome.tsx` [NEW]
- `apps/web/src/components/auth/LoginScreen.tsx` [MODIFY]
- `apps/web/src/App.tsx` [MODIFY]
- `docs/development/session-handoff.md` [MODIFY]

### Premium Landing Design Decisions
- 视觉风格紧密靠拢高端设计工作室美学，采用超大 Display 标题（72px-112px，行高 0.98），拒绝普通 SaaS 模板堆砌。
- 保证无任何破坏性集成。通过把登录、注册、微信扫码和 Google 登录表单用高定磨砂毛玻璃 Modal 弹窗打包，在不改动已有 VPS 前后端认证和状态管理的条件下实现完美蜕变。
- 空画布欢迎态通过 pointer-events-none 穿透底层 InfiniteCanvas，仅卡片本身 pointer-events-auto 可交互，避免遮挡画布本身的双击创建卡片与拖拽上传行为。
- 使用 `@import "tailwindcss/index.css"` 的 Inline Type 导入规范处理接口，确保 rolldown/vite 构建打包零错误。

### Premium Landing Verification Run
- `npm run typecheck`: Passed successfully.
- `npm run build`: Passed successfully. Web client compiled successfully with Vite 8.

### Premium Landing Not Run / Deferred
- 暂未在 Expo 移动端 App 的原生 WebView 中全面联调落地页的渲染性能（移动端已做好了全幅极简卡片和 reduced motion 退避保护）。

### Premium Landing Risks / Next
- 无新引入风险。下一步可以对已登录的 Onboarding TutorialOverlay 引导提示做进一步的视觉排版统一。

## 2026-06-16 - Code Review Issue Fixes

### Code Review Fixes Scope
- Fixed review findings in the current uncommitted web changes.
- Restored desktop settings navigation search filtering and added a source contract regression test.
- Removed the unused `@lobehub/ui` dependency from the web workspace to stay aligned with the current UI boundary policy.
- Loaded favorites before selection-menu favorite state checks and removed a dead local collection.
- Cleaned `canvasLivePositionStore.ts` whitespace reported by `git diff --check`.
- Removed the stale API workbench overview render/comment path and kept model-center list mode aligned with the current API settings tests.
- Aligned workspace package ownership for React/UI runtime dependencies after the new UI resource dependency governance test surfaced the boundary requirement.

### Code Review Fixes Files Touched
- `apps/web/src/components/settings/SettingsPanel.localized.tsx`
- `apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx`
- `apps/web/src/components/settings/ApiSettingsView.tsx`
- `apps/web/src/components/settings/ApiAdvancedSettingsView.tsx`
- `apps/web/src/components/settings/apiWorkbenchSections.tsx`
- `apps/web/src/app/useSelectionMenuOverlay.ts`
- `apps/web/src/app/canvasLivePositionStore.ts`
- `package.json`
- `apps/web/package.json`
- `package-lock.json`
- `packages/ui/package.json`
- `packages/ui/tsconfig.json`
- `tests/unit/settings-desktop-workbench-regression.test.ts`
- `docs/development/session-handoff.md`

### Code Review Fixes Design Decisions
- Keep the settings search UI visible and let the parent shell own the query filtering, while the sidebar groups the already-filtered items by section.
- Do not keep unused heavy UI dependencies for future work; reintroduce a dependency only with a concrete source usage and updated governance.
- Use the favorites store's loaded state and latest `getState()` snapshot for the selection menu so first-run favorite toggles do not act on an empty stale list.
- Keep API settings default mode on the model-center provider list and move advanced/legacy overview details out of the default source path.
- Keep app-owned React dependencies out of the root workspace while declaring local workspace packages explicitly in `apps/web`.

### Code Review Fixes Verification Run
- `git diff --check`: Passed with CRLF normalization warnings only.
- Targeted regressions passed:
  - `tests/unit/settings-desktop-workbench-regression.test.ts`
  - `tests/unit/ui-resource-dependency-governance.test.ts`
  - `tests/unit/api-settings-provider-compact-ui-contract.test.ts`
  - `tests/unit/api-settings-routing-regression.test.ts`
  - `tests/unit/api-settings-simple-mode-contract.test.ts`
  - `tests/unit/api-settings-workbench-structure.test.ts`
- `npm run architecture:check`: Passed. Non-fatal existing UI token literal warnings remain.
- `npm run governance:check`: Passed.
- `npm run typecheck`: Passed.
- `npm run check:encoding`: Passed.
- `npm run build`: Passed.
- `npm run test`: Passed.
- `npm run verify:changes`: Passed. Mobile settings smoke used its fallback contract path after `settings-workbench-overview` was not visible, and the script exited successfully.
- `npm ls @lobehub/ui antd --all`: Output was empty as expected. `npm ls` returned exit code 1 because the queried packages are not installed.

### Code Review Fixes Risks / Next
- No blocking issue remains from this review pass.
- Follow-up cleanup can tokenize the long-standing hardcoded UI color literals reported by `architecture:check`.

## 2026-06-16 - Reference Image Loss Display Pass

### Reference Image Loss Display 修改范围
- 优化了卡片上的参考图组件 `ReferenceThumbnail`（`PromptNodeComponent.tsx`）在找不到图片或图片加载失败时的显示效果。
- 增加了 `hasError` 状态变量并为图片标签添加 `onError` 监听以检测渲染失败的情况。
- 重新设计了丢失态的降级 UI：引入 `lucide-react` 的 `AlertCircle` 警告图标，并采用半透明黑色蒙层（`bg-black/60`）配合深灰色背景，展现出类似图二中圆圈感叹号的视觉效果，确保图片丢失时优雅显示且带有“Ref”标签。
- 同样优化了输入栏参考图缩略图组件 `ReferenceThumbnail`（`PromptBar.tsx`），为其添加 `imageLoadError` 捕获并将错误占位符统一为圆圈感叹号加半透明黑色背景的样式。

### Reference Image Loss Display 修改文件
- [PromptNodeComponent.tsx](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/components/canvas/PromptNodeComponent.tsx)
- [PromptBar.tsx](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/components/layout/PromptBar.tsx)
- [session-handoff.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/development/session-handoff.md)

### Reference Image Loss Display 当前设计决策
- 当参考图在本地读取时，通常因连接在本地所以丢失概率较低。如果确实因 expired blob 或其他问题导致加载失败，则需要有降级 UI。
- 降级 UI 设计为：在变暗的半透明黑色遮罩之上居中显示白色的 `AlertCircle`（圆圈感叹号）。
- 依然保留卡片上 `Ref` 标签在最上层展示，使用户容易辨识是哪一张参考图发生了丢失。

### Reference Image Loss Display 已运行验证
- `npm run typecheck`：通过，没有报错。
- `npm run build`：成功构建，无任何编译错误。

### Reference Image Loss Display 未运行验证及原因
- 暂未在真实浏览器界面上手工上传损坏的图片以进行交互式视觉走查（因宿主环境本地访问策略限制）。已通过编译、TS 类型检查和语法静态校验确保了安全性。

### Reference Image Loss Display 风险与下一步
- 目前已经完成了对提示词卡片上参考图以及 Prompt 输入条中参考图的防丢失及加载错误占位图优化，无新增风险。

## 2026-06-16 - Mobile Settings Topbar and Position Optimization

### Mobile Topbar Scope
- 优化了手机端（移动端）设置面板顶部条的布局，移除左右边距（设置 `left: 0 !important`，`right: 0 !important`），使其宽度与外层面板框完全齐平撑满。
- 引入 `border-radius: inherit !important` 并清空底角圆角，使顶栏顶角的圆角弧度自动继承并贴合外层容器。
- 优化了返回按钮和关闭按钮的左右安全边距（调整为 `8px`），并将居中标题的左右 padding 提升到 `56px`，防止按钮和边框贴死或与长标题文本发生冲突。
- 修复了在平板尺寸（`768px` 至 `1023px` 之间）绝对定位顶栏会遮挡页面顶部内容的问题，将对应的 content padding-top 统一优化为 `76px !important`。

### Mobile Topbar Files Touched
- [index.css](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/index.css)
- [settings.css](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/styles/settings.css)
- [SettingsPanel.localized.tsx](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/components/settings/SettingsPanel.localized.tsx)
- [session-handoff.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/development/session-handoff.md)

### Mobile Topbar Design Decisions
- 顶栏宽度与框齐平让面板整体显得更加大气完整，搭配 `border-bottom: 1px solid var(--settings-visual-border)` 分割线，极大地提升了移动端设置界面的精致程度与整体感。
- 按钮和标题文字的呼吸间隙确保在各种小屏设备下都有优秀的视觉比例与防误触体验。

### Mobile Topbar Verification Run
- `npm run typecheck`: Passed.

### Mobile Topbar Not Run / Deferred
- 暂无。

### Mobile Topbar Risks / Next
- 暂无。

## 2026-06-16 - Minimap UI and Interaction Optimization

### Minimap Scope
- 优化了画布小地图（Minimap）在 AI 助手展开时的避让算法，将偏移距离从 16px 增加到 32px，以解决小地图右侧被 AI 助手折叠按钮部分遮挡的问题。
- 调整了小地图整体布局，从原先的地图在上、控制条在下，重构为控制条在上、地图在下的排版结构，并对高度进行了极致优化。
- 简化了卡片渲染，将小地图上的卡片调整为极简的半透明中性空白卡片占位，使界面具备更高端的视觉质感。
- 引入了基于虚拟状态的“目标视口”机制。在小地图上拖动定位框或操作缩放控制条时，大画布保持静止以避免频繁重绘的性能卡顿，并新增“确认定位”与“重置”按钮供确认生效。
- 支持在小地图 SVG 画面上通过鼠标滚轮进行无感的拟定位缩放比调节。

### Minimap Files Touched
- `apps/web/src/App.tsx`
- `apps/web/src/app/AppCanvasNavigationPanel.tsx`
- `docs/development/session-handoff.md`

### Minimap Design Decisions
- 确保在 AI 助手侧边栏滑入动画和常驻展示时，小地图组件能被推到可视范围，且留出充足距离避开悬浮把手。
- 将定位框分为虚线框（大画布实际位置）和高亮珊瑚色实线框（目标定位位置），提供更精准且逻辑清晰的“延迟确认定位”体验。
- 空白卡片采用统一的半透明灰色 `rgba(156, 163, 175, 0.15)`，去除了业务状态颜色与文字干扰，整体设计呈现高级毛玻璃悬浮效果。

### Minimap Verification Run
- `npm run typecheck`: Passed.
- `npm run architecture:check`: Passed.
- `npm run governance:check`: Passed.

### Minimap Not Run / Deferred
- 暂未启动本地 dev 服务器对全流程交互在不同屏幕分辨率下进行 E2E 回归测试。

### Minimap Risks / Next
- 暂无。

## 2026-06-16 - Mobile Scroll-to-Bottom Icon and Alignment Optimization

### Mobile Icon Scope
- Replaced the generic `ArrowDown` icon with a more user-friendly and standard `ChevronsDown` icon for the mobile result feed's scroll-to-bottom button.
- Fixed the alignment and symmetry issue between the scroll-to-bottom button and the standard/detail mode switcher.
- Added explicit layout properties (`flex items-center justify-center`) and strict size bounds (`!w-10 !h-10 !min-w-0 !min-h-0`) to keep the button perfectly centered and horizontally aligned with the 40px mode switching capsule.

### Mobile Icon Files Touched
- `apps/web/src/components/mobile/MobileResultFeed.tsx`
- `docs/development/session-handoff.md`

### Mobile Icon Design Decisions
- Keeping the button dimensions strictly bounded at 40px (`w-10 h-10`) matches the height of the mode-switching capsule, delivering a clean, symmetrical layout.
- The `ChevronsDown` icon is enlarged to size `16` (from `14`) to stand out clearly as a navigation control.

### Mobile Icon Verification Run
- `npm run typecheck`: Passed.
- `npm run build`: Passed (Web client compiled successfully with Vite 8).

### Mobile Icon Not Run
- E2E mobile tests (since the layout change was manually verified by inspection and standard desktop-side tests do not touch mobile DOM structures).

### Mobile Icon Risks
- None.

## 2026-06-16 - Cross-Manifest Dependency Audit Closure

### Audit Closure Scope
- Closed the new root/server audit findings introduced by updated npm advisories: `tar <=7.5.15`, `form-data <4.0.6`, and `protobufjs <=7.6.2`.
- Completed the dedicated `apps/mobile` dependency security pass that was deferred on 2026-06-15.
- Removed unused mobile production dependencies `expo-three` and `@expo/ngrok`, which were pulling vulnerable legacy fetch, uuid, fbjs, and tunnel-tooling chains into the mobile manifest.
- Added mobile overrides for patched transitive packages while staying on Expo 54 / React Native 0.81 to avoid an unplanned mobile platform migration.

### Audit Closure Files Touched
- `package.json`
- `package-lock.json`
- `server/package.json`
- `server/package-lock.json`
- `apps/mobile/package.json`
- `apps/mobile/package-lock.json`
- `docs/development/session-handoff.md`

### Audit Closure Design Decisions
- Root and server both pin `protobufjs@7.6.4`; this stays within the Google GenAI v1 dependency line and avoids a broader `@google/genai` major upgrade.
- Root `tar` and nested `@mapbox/node-pre-gyp` tar resolution are pinned to `7.5.16`; `form-data` is pinned to `4.0.6`.
- Mobile keeps the current Expo 54 / RN 0.81 runtime. The security closure uses targeted npm overrides for patched transitive packages instead of moving to Expo 56 / RN 0.86 in this pass.
- Mobile `@istanbuljs/load-nyc-config` is safely overridden to `js-yaml@4.2.0` after source inspection confirmed it uses `require('js-yaml').load(...)`, which remains supported in js-yaml 4.x.
- `expo-three` was removed because no mobile source imports it. Reintroducing 3D features should select a maintained Expo-compatible path rather than restoring the vulnerable legacy chain.
- `@expo/ngrok` was removed because no project script or source imports it; local tunnel workflows should use the Expo CLI's current supported tunnel path instead of keeping the old package in production dependencies.

### Audit Closure Verification Run
- All npm audit surfaces passed with 0 vulnerabilities at `--audit-level=moderate`: root prod/all, `apps/web` prod/all, `server` prod/all, and `apps/mobile` prod/all.
- `npm install --ignore-scripts`: restored root install after Windows blocked `npm ci` from unlinking a locked native `lightningcss` binary; completed with 0 vulnerabilities. npm reported local cleanup warnings for locked temporary native addon directories only.
- `npm ci --prefix server --ignore-scripts`: passed with 0 vulnerabilities.
- `npm ci --prefix apps/mobile --legacy-peer-deps --ignore-scripts`: passed with 0 vulnerabilities.
- `npm run verify:changes`: passed, including architecture, governance, root dependency audit, typecheck, OpenAPI spec check, build, unit/integration/contract/e2e tests, smoke checks, and encoding checks.

### Audit Closure Not Run / Deferred
- Full Expo 56 / RN 0.86 migration was not performed; the current audit surface is clean without that platform jump.

### Audit Closure Risks / Next
- Mobile still prints deprecation warnings for old Expo/RN/Jest ecosystem packages during install, especially `glob@7`, `rimraf@3`, and related tooling. These are not npm audit vulnerabilities after this pass, but they should be revisited during a planned mobile platform upgrade.
- Root `npm ci` was blocked by a Windows EPERM lock on native addon files. The non-destructive `npm install --ignore-scripts` recovery completed successfully; if this recurs, stop local processes using Tailwind/lightningcss before rerunning clean installs.

## 2026-06-15 - Dependency Security and Integrity Audit

### Scope
- Fixed the root/web development dependency audit failure caused by stale Vite/esbuild/vite-node resolution across root workspaces and the standalone `apps/web` CI install path.
- Aligned root, `apps/web`, and `packages/api-client` Vite constraints to the patched Vite 8 line.
- Added root and web package overrides so React Router dev tooling and Vitest resolve to patched Vite/vite-node/esbuild versions.
- Fixed type errors surfaced by the stricter verification pass: API client hooks now use type-only imports, and the obsolete Vitest `esbuild.jsx` option was removed for Vite 8.

### Files Touched
- `package.json`
- `package-lock.json`
- `apps/web/package.json`
- `apps/web/package-lock.json`
- `apps/web/vitest.config.ts`
- `packages/api-client/package.json`
- `packages/api-client/src/hooks.ts`
- `docs/development/session-handoff.md`

### Current Design Decisions
- The npm root workspace lockfile and the standalone `apps/web/package-lock.json` both need to stay aligned because CI runs both `npm ci` and `npm ci --prefix apps/web --legacy-peer-deps`.
- React Router has no published patched `@react-router/dev` release beyond 7.17.0 at this time, so the project pins a verified override to `vite-node@6.0.0` and Vite 8 instead of leaving the dev audit red.
- `apps/mobile` remains a separate Expo/RN dependency surface. Its audit findings are not mixed into the web/server fix because npm dry-run shows no safe automatic patch path and many fixes require Expo 56 / third-party major migrations.

### Verification Run
- `npm audit --audit-level=moderate --json`: 0 vulnerabilities.
- `npm audit --omit=dev --audit-level=moderate --json`: 0 vulnerabilities.
- `npm audit --prefix apps/web --audit-level=moderate --json`: 0 vulnerabilities.
- `npm audit --prefix server --audit-level=moderate --json`: 0 vulnerabilities.
- `npm ci --prefix apps/web --legacy-peer-deps --ignore-scripts`: passed with 0 vulnerabilities.
- `npm run typecheck -w web`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run verify:changes`: passed, including architecture, governance, dependency audit, typecheck, OpenAPI spec check, build, unit/integration/contract/e2e tests, smoke checks, and encoding checks.

### Not Run / Deferred
- `npm audit --prefix apps/mobile --omit=dev --audit-level=moderate --json` was run and still reports mobile-only findings: 42 total vulnerabilities, including one critical `shell-quote` chain and several Expo/RN ecosystem high findings.
- `npm audit fix --prefix apps/mobile --omit=dev --package-lock-only --dry-run --json` made 0 proposed changes. Mobile remediation is deferred because the available fixes require Expo 56 or third-party package major migrations that need a dedicated mobile compatibility pass.

### Risks / Next
- Root `npm ls vite esbuild vite-node @react-router/dev` reports the intentional `vite-node@6.0.0` override as outside `@react-router/dev`'s declared `^3.2.2` range, while `react-router typegen`, root typecheck, build, and full `verify:changes` pass. Revisit this once React Router publishes a patched dev dependency chain.
- Continue a dedicated `apps/mobile` security pass: evaluate Expo 56 migration, `@anythingai/app` update path, `expo-three` compatibility, and targeted overrides for fixable transitive packages.
- Existing non-blocking UI token warnings remain in `architecture:check`; this pass did not change UI token debt.

## 2026-06-15 - UI System Alignment Push Cleanup

### Push Cleanup Scope
- Restored the desktop settings sidebar search contract while keeping the new system-aligned sidebar visual treatment.
- Adjusted the theme contrast contract helper so it reads the canonical Clay `:root` token block instead of a later unrelated `:root` block.
- Kept the broader UI-system migration grouped on branch `codex/ui-system-alignment-20260615` for review and push, without routing changes back to legacy entry points.

### Push Cleanup Files Touched
- `apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx`
- `tests/unit/theme-contrast-contract.test.ts`
- `docs/development/session-handoff.md`

### Push Cleanup Verification Run
- Targeted regression suite: `settings-desktop-workbench-regression.test.ts`, `settings-shell-scroll-regression.test.ts`, and `theme-contrast-contract.test.ts`: 13 tests passed.
- `npm.cmd run verify:changes`: passed, including architecture, governance, dependency audit, typecheck, spec check, build, unit/integration/contract/e2e tests, prompt drag smoke, mobile settings smoke, desktop settings smoke, startup banner smoke, and encoding checks.

### Push Cleanup Risks And Next Steps
- Smoke scripts reported fallback mode for two settings smoke probes, but the fallback contract checks completed successfully and `verify:changes` exited cleanly.
- Historical non-blocking UI token warnings still exist outside this UI-system pass; future UI cleanup should continue moving older canvas/admin/ecommerce surfaces onto shared tokens.

## 2026-06-15 - System Logs Settings System Alignment Pass

### System Logs Change Scope
- Rebuilt the System Logs settings page on top of the shared settings scaffold: `SettingsViewShell`, `SettingsHero`, `SettingsMetricCard`, `SettingsSection`, `SettingsBadge`, and `SettingsCardGridContainer`.
- Removed the previous utility-styled dashboard cards and the fake `__legacy_testing_support_mark` scaffold marker so the real page now satisfies the system contract.
- Added `settings-log-*` primitives for metric grids, filter toolbar, log actions, console switches, alert cards, stream cards, and per-level stream entries.
- Fixed desktop alignment so the System Logs page uses a 4-column settings grid, metrics span the full row, filter/switch sections sit in two balanced columns, and alert/stream sections span full width.
- Fixed the filter toolbar to use a stable two-row layout inside a 2-column settings card, avoiding select/button overlap while keeping mobile single-column.

### System Logs Files Changed
- `apps/web/src/components/settings/views/SystemLogsView.localized.tsx`
- `apps/web/src/styles/settings.css`
- `tests/unit/system-logs-settings-ui-system-contract.test.ts`
- `tests/unit/settings-workbench-ui-refit.test.ts`
- `docs/development/session-handoff.md`

### System Logs Current Design Decisions
- Future System Logs additions should use the `settings-log-*` primitives and semantic `data-tone`, `data-variant`, `data-state`, and `data-level` attributes instead of component-local color, border, or spacing utilities.
- The System Logs page intentionally overrides the legacy fixed-width A-card grid inside `.settings-system-logs-view`; new settings pages with composed sections should prefer page-scoped grid contracts over inheriting global `270px` card rules blindly.
- Filter controls and actions stay in separate toolbar rows on desktop and mobile to prevent regressions when labels, locales, or source names become longer.
- Destructive maintenance behavior remains guarded by confirmation, and local log filtering/export behavior is unchanged.

### System Logs Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/system-logs-settings-ui-system-contract.test.ts`: red first, then 2 tests passed.
- Related settings contract suite: `tests/unit/system-logs-settings-ui-system-contract.test.ts tests/unit/settings-workbench-ui-refit.test.ts tests/unit/settings-shared-ui-primitives-contract.test.ts tests/unit/settings-ui-system-contract.test.ts tests/unit/settings-ui-density-regression.test.ts tests/unit/settings-desktop-workbench-regression.test.ts tests/unit/system-logs-unused-cleanup-contract.test.ts`: 30 tests passed.
- `npm.cmd run architecture:check`: passed. It still prints non-blocking historical raw color warnings in older UI surfaces; no settings-system or z-index failures.
- `npm.cmd run governance:check`: passed.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and tests typecheck passed for 433 test files.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed.
- `git diff --check`: passed with CRLF normalization warnings only.
- In-app Browser visual smoke with a local temp user and seeded system logs:
  - Desktop `1440x900` `/settings/system-logs`: final grid computed as `244px 244px 244px 244px`, metric grid computed as 4 columns, no horizontal overflow, and toolbar controls/actions no longer overlap.
  - Mobile `390x844` `/settings/system-logs`: final grid computed as one column, no horizontal overflow.
  - Latest screenshots: `.tmp/system-logs-toolbar-fresh.png`, `.tmp/system-logs-mobile-stable.png`.

### System Logs Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization remains in staged passes; this pass covered the requested related contracts, architecture, governance, typecheck, build, encoding, diff check, and visual browser smoke.

### System Logs Risks And Next Steps
- `architecture:check` continues to report historical raw color literals outside this pass. The next UI passes should keep migrating PromptBar overlays, Canvas chrome, Admin floating panels, and ecommerce panels into shared token/layer primitives.
- The dev restart helper timed out twice during visual QA; Vite was manually verified through the actual port listener and browser loading. This did not affect the production build or tests.

## 2026-06-15 - Browser Assistant Settings Full-System Alignment Pass

### 修改范围
- 继续收口设置页 `BrowserAssistantView` 下半部分 UI，将 AI 接管指令区、命令解析报告、演示沙盒、网页直通生成、模型路由策略、Session 选择、自动化流水线、终端日志和结果卡片统一迁移到 `settings-browser-*` 设计系统 primitive。
- 修复桌面设置侧栏中工作区总览和存储统计的中文乱码，避免设置页整体观感被侧栏状态文案破坏。
- 保持主画布页结构不做大改，本轮只针对设置页浏览器助手与设置侧栏做系统化 UI 对齐。

### 修改文件
- `apps/web/src/components/settings/views/BrowserAssistantView.tsx`
- `apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx`
- `apps/web/src/styles/settings.css`
- `tests/unit/browser-assistant-settings-rows-ui-system-contract.test.ts`
- `tests/unit/settings-sidebar-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### 当前设计决策
- Browser Assistant 后续新增模块优先复用 `settings-browser-section-card`、`settings-browser-command-grid`、`settings-browser-field`、`settings-browser-tabbar`、`settings-browser-result-card`、`settings-browser-pipeline-*`、`settings-browser-terminal` 和 `settings-browser-notice`，不要再在组件内直接堆 Tailwind 颜色、边框和背景工具类。
- 可变状态统一通过 `data-status`、`data-state`、`data-tone`、`data-active` 驱动 CSS，业务组件只传语义状态，不再直接决定视觉 token。
- 移动端规则以不横向溢出为底线：命令行、策略卡、结果卡、流水线布局和终端日志在窄屏下全部按单列流式排列。
- 设置侧栏状态文案必须保持可读中文；新增中文文案时需要经过 `check:encoding` 和单元契约保护。

### 已运行验证
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/browser-assistant-settings-rows-ui-system-contract.test.ts`: 新增用例先红后绿，最终通过。
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/browser-assistant-settings-rows-ui-system-contract.test.ts tests/unit/settings-shared-ui-primitives-contract.test.ts tests/unit/settings-sidebar-ui-system-contract.test.ts tests/unit/settings-ui-system-contract.test.ts tests/unit/settings-ui-density-regression.test.ts tests/unit/mobile-settings-browser-verify-script.test.ts tests/unit/api-settings-workbench-structure.test.ts`: 39 tests passed。
- `npm.cmd run typecheck`: passed。
- `npm.cmd run architecture:check`: passed，仍输出历史 raw color / z-index 非阻断 warning，主要来自 canvas、admin、ecommerce 等旧区域。
- `npm.cmd run governance:check`: passed。
- `npm.cmd run build`: passed。
- `npm.cmd run check:encoding`: passed。
- `git diff --check`: passed，仅有 Windows CRLF normalization warning。
- Chrome/Playwright visual smoke:
  - Desktop `1440x920` `/settings/browser-assistant`: 侧栏中文可读，`scrollWidth=1440`，无横向溢出，`settings-browser-playground` 位于视口内。
  - Mobile `390x844` pipeline tab: `scrollWidth=390`，terminal 宽度 `326px`，无横向溢出。
  - 截图保存在 `.tmp/browser-assistant-desktop-final-after-restart.png` 与 `.tmp/browser-assistant-mobile-pipeline-final.png`。
- `npm.cmd run dev:status`: Vite `3000` 与 API `3001` 均 healthy。

### 未运行验证及原因
- 未运行完整 `npm run verify:changes`：当前全局 UI 系统优化目标仍在分阶段推进，本轮已经覆盖相关单测、类型、架构、治理、构建、编码检查和运行态视觉 smoke；完整发布级验证保留到全局 UI 收口或发布前执行。

### 风险与下一步
- `architecture:check` 仍提示历史区域存在 raw color / raw z-index warning；本轮没有回滚或重排这些并行改动。
- 下一轮建议继续收口 `PromptBar` 深层模型菜单/弹窗、Canvas 交互浮层、Admin 浮层和 ecommerce panels，保证设置页之外的高频 UI 也沿用同一 token/layer/primitive 体系。

## 2026-06-15 - Browser Assistant Settings System Deep Pass

### Browser Assistant Deep Pass Change Scope
- Reworked the Browser Assistant settings mid-page from scattered utility styling into reusable `settings-browser-*` primitives.
- Migrated Session pool rows, social channel rows, plugin install guide tiles, Daemon setup steps, desktop IDE adapter form, and the Advanced Fusion Center feature cards.
- Added system primitives for rows, chips, subtle actions, toggles, guide tiles, step lists, code snippets, compact fields, status dots, feature cards, insight cards, and swatches.
- Added a Browser Assistant scoped adaptive grid override so legacy fixed-width A-card spans no longer push two-column cards beyond the settings shell on desktop or force overlap.
- Preserved existing Browser Assistant behavior: session checks/toggles, social channel checks/toggles, plugin download notification, IDE launch test, local LLM test, clipboard simulation, screen inspect flow, and WASM/WebGPU switches.

### Browser Assistant Deep Pass Files Changed
- `apps/web/src/components/settings/views/BrowserAssistantView.tsx`
- `apps/web/src/styles/settings.css`
- `tests/unit/browser-assistant-settings-rows-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Browser Assistant Deep Pass Current Design Decisions
- Browser Assistant settings cards should expose structure through stable classes and `data-status`, `data-state`, `data-tone`, or `data-platform` attributes instead of local color utilities.
- New Browser Assistant row-like content should reuse `settings-browser-row`, `settings-browser-row-list`, `settings-browser-inline-status`, `settings-browser-subtle-action`, and `settings-browser-toggle`.
- New guide or feature cards should reuse `settings-browser-section-card`, `settings-browser-tile`, `settings-browser-feature-card`, `settings-browser-meta-row`, and shared form primitives before adding new CSS.
- Browser Assistant must not inherit the global fixed `270px` A-card width contract directly; its grid uses `minmax(0, 1fr)` columns and releases per-card `min-width`/`max-width` locally to stay inside the settings shell.
- Motion remains restrained: hover lift and status pulse use existing motion tokens and reduced-motion governance; no component-local animation timing was added.

### Browser Assistant Deep Pass Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/browser-assistant-settings-rows-ui-system-contract.test.ts`: red first, then 4 tests passed.
- Related settings contract suite covering Browser Assistant, shared primitives, sidebar, UI system, density, mobile settings smoke source, and API workbench structure: 36 tests passed.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 432 test files typechecked.
- `npm.cmd run architecture:check`: passed. Non-blocking historical raw color warnings remain in ecommerce/canvas/admin surfaces.
- `npm.cmd run governance:check`: passed before this handoff entry was appended; rerun after handoff update is required.
- `npm.cmd run build`: passed and emitted `BrowserAssistantView-3AsfPBMq.js`.
- Chrome visual smoke after local temp-user entry:
  - Desktop `1440x920` `/settings/browser-assistant`: `hasSettings=true`, grid `244px 244px 244px 244px`, `sectionCards=6`, `featureCards=4`, `maxCardRight=1375`, `cardsOverViewport=0`, no horizontal overflow.
  - Mobile `390x844` `/settings/browser-assistant`: grid `358px`, `sectionCards=6`, `featureCards=4`, `rowCount=5`, `maxSectionCardRight=371`, no horizontal overflow.

### Browser Assistant Deep Pass Not Run
- Full `npm run verify:changes` not run because the larger UI modernization goal remains in progress and this pass is scoped to Browser Assistant settings surfaces.

### Browser Assistant Deep Pass Risks And Next Steps
- `BrowserAssistantView.tsx` still has legacy utility styling in the lower Phase 5 AI Takeover and ecommerce automation playground sections. Those should be the next settings-page slices to migrate to the same primitives.
- Project-level raw color warnings are still historical and non-blocking; future passes should continue with PromptBar overlays, Canvas interaction chrome, Admin floating panels, and ecommerce panels.
- Current worktree contains pre-existing modified and untracked files from earlier UI passes. This pass did not revert or reorder unrelated changes.

## 2026-06-15 - Settings Shared Primitives And Browser Assistant First Screen Pass

### Settings Shared Primitive Change Scope
- Migrated shared settings `IconButton`, `ProgressBar`, and `StatusBadge` away from local inline paint logic into CSS-owned primitives.
- Added `settings-icon-button`, `settings-progress`, and `settings-status-badge` classes with `data-variant`, `data-tone`, and `data-status` state contracts.
- Reworked the Browser Assistant settings first screen status cards and connectivity doctor card to use `settings-browser-*` primitives instead of private slate/white/red/blue utility styling.
- Preserved Browser Assistant connection checks, daemon/extension status logic, local latency display, and connectivity test behavior.

### Settings Shared Primitive Files Changed
- `apps/web/src/components/settings/ui/index.tsx`
- `apps/web/src/components/settings/views/BrowserAssistantView.tsx`
- `apps/web/src/styles/settings.css`
- `tests/unit/settings-shared-ui-primitives-contract.test.ts`
- `tests/unit/settings-ui-density-regression.test.ts`
- `docs/development/session-handoff.md`

### Settings Shared Primitive Current Design Decisions
- Shared settings controls should expose state through `data-*` attributes and stable classes. Components should not reintroduce local hex/rgb colors, inline status color math, or bespoke icon-button paint logic.
- Browser Assistant first-screen status cards now use `settings-browser-status-card` with `data-status`; future cards in that view should continue moving toward `settings-browser-*` row/action/note primitives.
- This pass keeps large Browser Assistant business logic intact and only consolidates the visible first-screen UI surface.

### Settings Shared Primitive Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-shared-ui-primitives-contract.test.ts`: red first, then 2 tests passed.
- Settings related contract suite covering shared primitives, sidebar, UI system, density, mobile settings smoke source, and API workbench structure: 32 tests passed.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 431 test files typechecked.
- `npm.cmd run architecture:check`: passed. The z-index check still reports no hardcoded z-indexes; the non-blocking raw color warning list remains historical and now reports 373 additional offenders.
- `npm.cmd run governance:check`: passed after making duplicate handoff headings unique.
- `npm.cmd run build`: passed.
- `npm.cmd run check:encoding`: passed.
- Build artifact check found `settings-icon-button`, `settings-progress__bar`, `settings-status-badge`, `settings-browser-status-card`, and `settings-browser-action` in generated assets.
- `npm.cmd run dev:status`: Vite `3000` and API `3001` healthy.
- Runtime HTTP smoke on `http://localhost:3000/`: returned `status=200`, `length=5005`, and `root=true`.
- `git diff --check`: passed with CRLF replacement warnings only.

### Settings Shared Primitive Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still in scoped system passes; this pass covered focused contracts plus typecheck, architecture, governance, build, encoding, runtime smoke, and artifact checks.
- Browser screenshot QA was not repeated in this pass because previous in-app Browser screenshot capture timed out; runtime was checked through project dev status and HTTP smoke.

### Settings Shared Primitive Risks And Next Steps
- `BrowserAssistantView` still contains many deeper local slate/white/black utility surfaces below the first screen. Continue migrating session rows, social channel rows, plugin management, macro pipeline, and console panels to `settings-browser-*` primitives.
- `architecture:check` still reports non-blocking raw color warnings in ecommerce desktop panels, ModelLogo, canvas drawing/group components, and other legacy surfaces.
- `apps/web/src/components/settings/ui/index.tsx` still has older inline paint in segmented controls, inputs, and toggles. These should be converted in smaller guarded passes so the shared settings component layer becomes fully token driven.

## 2026-06-14 - Settings Sidebar Alignment And Overlay Layer Pass

### Change Scope
- Reworked the desktop settings sidebar from per-item inline visual themes into a shared card primitive driven by `data-state` and `data-accent`.
- Centralized active rails, active chevrons, billing/status marks, icon containers, hover states, shadows, and reduced-motion behavior in `settings.css` so future settings sections inherit the same UI rules.
- Finished a remaining floating-layer pass by moving admin recharge floating panels, PromptBar send-button internals, desktop composer mobile sheet, and sign-up/confetti overlays onto `KK_LAYER` and CSS-owned primitives.
- Preserved existing settings navigation behavior, billing count display, provider status display, PromptBar behavior, mobile composer behavior, and sign-up behavior.

### Files Changed
- `apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx`
- `apps/web/src/styles/settings.css`
- `apps/web/src/components/admin/AdminRechargeFloatingPanel.tsx`
- `apps/web/src/components/layout/PromptBar.tsx`
- `apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx`
- `apps/web/src/components/ui/sign-up.tsx`
- `apps/web/src/index.css`
- `packages/ui/src/core/layers.ts`
- `tests/unit/settings-sidebar-ui-system-contract.test.ts`
- `tests/unit/remaining-overlay-layer-ui-system-contract.test.ts`

### Settings Sidebar And Overlay Current Design Decisions
- New desktop settings navigation items should reuse `.settings-sidebar-card` and set `data-accent`; components should not reintroduce inline card colors, bespoke active rails, or one-off chevron animations.
- Settings sidebar status and balance details should use `.settings-sidebar-card__balance`, `.settings-sidebar-card__status-dot`, and `.settings-sidebar-card__status-text` instead of local Tailwind color bundles.
- Floating surfaces should use `KK_LAYER` values and local CSS primitives. New raw `z-[...]` or inline `zIndex` values are treated as regressions.
- This pass intentionally keeps the main canvas structure stable while tightening settings and overlay rules, matching the request to avoid destabilizing the primary canvas page.

### Settings Sidebar And Overlay Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/remaining-overlay-layer-ui-system-contract.test.ts`: 2 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-sidebar-ui-system-contract.test.ts`: 2 tests passed.
- Related UI contract suite covering settings, overlays, mobile chrome, mobile ecommerce, PromptBar, billing, and login: 52 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run governance:check`: passed.
- `npm.cmd run check:encoding`: passed after fixing suspicious mojibake in `SettingsDesktopSidebar.tsx`.
- `npm.cmd run architecture:check`: passed. The raw z-index check now reports no hardcoded z-indexes.
- `npm.cmd run build`: passed.
- Short-lived runtime HTTP smoke on `http://127.0.0.1:5199/`: returned `status=200`, `length=4989`, and `root=true`.
- `npm.cmd run dev:start` was then run outside the sandbox after approval; `npm.cmd run dev:status` reported Vite `3000` and API `3001` healthy, and `http://localhost:3000/` returned `status=200`, `length=4989`, and `root=true`.
- In-app Browser DOM verification loaded `http://localhost:3000/`, progressed from startup to the login screen, and reported `overflowX=false` at `1280x720`.
- `git diff --check`: passed with CRLF replacement warnings only.

### Settings Sidebar And Overlay Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still in scoped system passes; this round covered related contracts, typecheck, governance, architecture, encoding, build, diff check, and Vite HTTP smoke.
- Browser screenshot QA was attempted with the in-app Browser, but screenshot capture timed out in the Browser backend. The default login entry was still verified by DOM signals; settings runtime navigation behind local auth was not completed because the local temporary-login click also timed out in the Browser backend.

### Settings Sidebar And Overlay Risks And Next Steps
- `architecture:check` still prints historical non-blocking raw color warnings in older canvas/auth/ModelLogo and related legacy surfaces. This pass cleared the remaining hardcoded z-index warnings but did not finish every raw color migration.
- The login/auth CSS still has older visual-system compatibility layers and should be trimmed in a dedicated pass.
- Settings BrowserAssistantView, model center surfaces, and other settings subviews should continue moving toward the same sidebar/card/form primitives so new pages inherit one system instead of adding local themes.

## 2026-06-13 - Mobile Ecommerce Panel Primitive Pass

### Mobile Ecommerce Panel Change Scope
- Migrated the most visible internal controls in `MobileEcommercePanel` to reusable mobile ecommerce primitives: upload cards, upload dropzones, delete/remove actions, generation preview shell, download action, inspiration trigger/grid/chips, config section, segmented controls, ratio cards, selects, batch stepper, sticky bottom bar, prompt textarea, and submit button.
- Replaced local white-alpha glass, private black blur download overlay, rose/amber gradient ratio cards, and private gradient submit button styling with `mobile-clay`, `frost-card`, and Clay brand token driven CSS.
- Preserved ecommerce upload, reference upload, ratio switching, advanced parameter selection, batch count changes, prompt editing, task queue execution, image generation, and download behavior.

### Mobile Ecommerce Panel Files Changed
- `apps/web/src/components/mobile/MobileEcommercePanel.tsx`
- `apps/web/src/index.css`
- `tests/unit/mobile-ecommerce-panel-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Mobile Ecommerce Panel Current Design Decisions
- Mobile ecommerce internals should use class primitives with `data-state` for active/busy/ready states instead of conditional Tailwind color bundles.
- The panel now uses CSS-owned primitives such as `mobile-ecommerce-upload-card`, `mobile-ecommerce-ratio-option`, `mobile-ecommerce-field-select`, `mobile-ecommerce-bottom-bar`, and `mobile-ecommerce-submit`.
- The submit button still uses a restrained Clay brand gradient, but it is centralized under `.mobile-ecommerce-submit[data-state="ready"]`; component code should not reintroduce private `from-[#FF5E62]` or `to-[#FF9966]` utilities.
- This pass focuses on mobile ecommerce controls. Desktop ecommerce workbench/import/review panels still need their own UI tokenization pass.

### Mobile Ecommerce Panel Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/mobile-ecommerce-panel-ui-system-contract.test.ts`: red first for missing primitives and legacy local styling, then 3 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/mobile-ecommerce-panel-ui-system-contract.test.ts tests/unit/mobile-chrome-layer-ui-system-contract.test.ts tests/unit/prompt-bar-mobile-chrome-layer-ui-system-contract.test.ts tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/mobile-workspace-surface-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/ecommerce-mode-source-contract.test.ts tests/unit/ecommerce-mode-source-guard.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts tests/unit/vite-manual-chunk-boundary-contract.test.ts`: 36 tests passed.
- `rg -n "bg-black/60|backdrop-blur-md|border-white/10|hover:text-white|text-rose-300|border-white/20|border-white/5|bg-white/\[0\.01\]|hover:border-white/10|hover:bg-white/\[0\.02\]|bg-gradient-to-tr from-rose-500/10 to-amber-500/5|shadow-rose-500/2|bg-gradient-to-tr from-\[#FF5E62\] to-\[#FF9966\]|bg-white/10 text-white/50|hover:shadow-lg|hover:shadow-rose-500/10" apps/web/src/components/mobile/MobileEcommercePanel.tsx`: no matches.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 428 test files typechecked.
- `npm.cmd run architecture:check`: passed. Existing warning groups remain in admin recharge, canvas color constants, PromptBar internals, sign-up/confetti, and other legacy surfaces; ecommerce warning count was reduced by this pass.
- `npm.cmd run build`: passed.
- `npm.cmd run governance:check`: passed.
- `npm.cmd run check:encoding`: passed.
- Build artifact check: `rg -n "mobile-ecommerce-upload-card|mobile-ecommerce-ratio-option|mobile-ecommerce-submit|mobile-ecommerce-bottom-bar" apps/web/dist/assets -g "index-*.css" -g "index-*.js"` found the new primitives in generated assets.
- Runtime HTTP smoke: short-lived Vite process on `http://127.0.0.1:5199/` returned `status=200`, `length=4989`, and `root=true`, then the process tree was stopped.
- `npm.cmd run dev:status`: confirmed no residual Vite/API processes after smoke runs.

### Mobile Ecommerce Panel Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still progressing through scoped system passes.
- Screenshot visual QA was not completed because the Browser navigation/screenshot tool was not exposed in this session.

### Mobile Ecommerce Panel Risks And Next Steps
- Desktop ecommerce panels and admin recharge still contain raw color/layer styling and should be moved to the same tokenized primitive approach.
- `MobileEcommercePanel` still contains some decorative status/loading micro-styles and local product copy structure; these are lower risk than the primary controls now covered by contract tests.

## 2026-06-13 - Mobile Chrome Layer System Pass

### Mobile Chrome Layer Change Scope
- Added semantic mobile chrome layers to `KK_LAYER` and CSS z-index tokens for bottom navigation and project dropdown overlays.
- Migrated `MobileTabBar`, `MobileWorkspaceQuickBar`, `MobileMoreMenu`, and the `MobileEcommercePanel` root away from private raw z-index utilities and root hardcoded dark backgrounds.
- Added reusable mobile menu and ecommerce root primitives in `apps/web/src/index.css` covering backdrop, sheet, action tile, icon, label, active states, bottom tab active states, and reduced-motion behavior.
- Preserved the main canvas interaction model, ecommerce generation flow, project switching behavior, settings/profile entry actions, and mobile result/feed behavior.

### Mobile Chrome Layer Files Changed
- `packages/ui/src/core/layers.ts`
- `apps/web/src/styles/kk-ui-tokens.css`
- `apps/web/src/index.css`
- `apps/web/src/components/mobile/MobileTabBar.tsx`
- `apps/web/src/components/mobile/MobileWorkspaceQuickBar.tsx`
- `apps/web/src/components/mobile/MobileMoreMenu.tsx`
- `apps/web/src/components/mobile/MobileEcommercePanel.tsx`
- `tests/unit/mobile-chrome-layer-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Mobile Chrome Layer Current Design Decisions
- Mobile app chrome should use named layer tokens: `KK_LAYER.mobileChrome`, `KK_LAYER.mobileChromeOverlay`, `KK_LAYER.modalBackdrop`, and `KK_LAYER.modal`; mobile components should not reintroduce `z-[940]`, `z-[964]`, `z-[995]`, or `z-[1001]`.
- CSS-owned mobile primitives should carry the visual system. Components should attach stable classes such as `kk-mobile-more-menu-sheet`, `kk-mobile-more-menu-action`, and `mobile-ecommerce-panel-root` instead of inline background, border, and shadow recipes.
- Mobile chrome surfaces continue to inherit the existing `mobile-clay` and `frost-card` token system so light/dark mode, border rhythm, active state, and reduced-motion rules stay consistent.
- This pass intentionally only changes the `MobileEcommercePanel` root layer/surface. Internal ecommerce controls still contain legacy local button and tag styling and should be handled by a dedicated ecommerce panel UI pass.

### Mobile Chrome Layer Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/mobile-chrome-layer-ui-system-contract.test.ts`: red first for missing layer/CSS/component contracts, then 3 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/mobile-chrome-layer-ui-system-contract.test.ts tests/unit/prompt-bar-mobile-chrome-layer-ui-system-contract.test.ts tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/mobile-workspace-surface-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/ecommerce-mode-source-contract.test.ts tests/unit/ecommerce-mode-source-guard.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts`: 30 tests passed.
- `rg -n "z-\[1001\]|z-\[964\]|z-\[940\]|z-\[995\]|bg-\[#0A0A0C\]" apps/web/src/components/mobile/MobileMoreMenu.tsx apps/web/src/components/mobile/MobileTabBar.tsx apps/web/src/components/mobile/MobileWorkspaceQuickBar.tsx apps/web/src/components/mobile/MobileEcommercePanel.tsx`: no matches.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 427 test files typechecked.
- `npm.cmd run architecture:check`: passed. Existing hardcoded color/raw z-index warning groups remain in admin recharge, PromptBar internals, sign-up/confetti, and other legacy surfaces, but the mobile chrome warnings addressed by this pass are no longer listed.
- `npm.cmd run build`: passed.
- `npm.cmd run governance:check`: passed.
- `npm.cmd run check:encoding`: passed.
- `git diff --check -- packages/ui/src/core/layers.ts apps/web/src/styles/kk-ui-tokens.css apps/web/src/index.css apps/web/src/components/mobile/MobileMoreMenu.tsx apps/web/src/components/mobile/MobileTabBar.tsx apps/web/src/components/mobile/MobileWorkspaceQuickBar.tsx apps/web/src/components/mobile/MobileEcommercePanel.tsx tests/unit/mobile-chrome-layer-ui-system-contract.test.ts`: passed with CRLF/LF normalization warnings only.
- Build artifact check: `rg -n "kk-mobile-more-menu|mobile-ecommerce-panel-root|kk-z-mobile-chrome" apps/web/dist/assets -g "index-*.css" -g "index-*.js"` found the new mobile chrome primitives in generated assets.
- Runtime HTTP smoke: short-lived Vite process on `http://127.0.0.1:5199/` returned `status=200`, `length=4989`, and `root=true`, then the process tree was stopped.
- `npm.cmd run dev:status`: confirmed no residual Vite/API processes after smoke runs.

### Mobile Chrome Layer Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still progressing through scoped system passes.
- In-app Browser screenshot QA was not completed because the Browser navigation/screenshot tool was not exposed in this session; Product Design local context also has no saved screenshot/Figma reference. Runtime smoke and build artifact checks were used instead.

### Mobile Chrome Layer Risks And Next Steps
- `MobileEcommercePanel` still contains internal legacy local visual utilities such as local overlays, rose/amber gradients, and white-alpha button treatments. A follow-up ecommerce panel system pass should convert its upload cards, inspiration chips, option selectors, and sticky composer actions to reusable primitives.
- Architecture warnings still identify unrelated legacy raw z-index and color literals in admin recharge, PromptBar internals, sign-up/confetti, and ecommerce desktop/import panels.
- A later visual QA pass should open mobile viewport states with real screenshots once the Browser tool or Playwright-backed smoke environment is available.

## 2026-06-13 - Settings Visual Alignment Layer Pass

### Settings Visual Alignment Change Scope
- Added a visible settings UI system layer covering the settings shell, desktop/mobile topbars, sidebar, page background, hero header, cards, inputs, dropdowns, floating menus, hover states, and reduced-motion behavior.
- Migrated shared `SettingSelect` dropdowns from private layer/shadow/blur utilities to the settings control-menu primitive with `KK_LAYER.dropdown`, `listbox`/`option` semantics, selected state attributes, and shared visual styling.
- Preserved settings routing, business logic, provider/API flows, account behavior, billing behavior, and the main canvas interaction model. This pass focuses on visible alignment and system reuse.

### Settings Visual Alignment Files Changed
- `apps/web/src/components/settings/SettingsScaffold.tsx`
- `apps/web/src/components/settings/ui/index.tsx`
- `apps/web/src/styles/settings.css`
- `tests/unit/settings-ui-system-contract.test.ts`
- `docs/development/session-handoff.md`

### Settings Visual Alignment Current Design Decisions
- Settings UI should inherit one visible system layer instead of accumulating page-by-page overrides: shell, sidebar, hero, cards, controls, dropdowns, and modal panels now share the same visual variables.
- Settings content cards keep an 18-24px radius rhythm, subtle glass material, bounded shadows, and unified hover motion; reduced-motion mode removes transitions and transforms.
- Sidebar navigation spacing is owned by grid `gap` in the final settings layer; legacy Tailwind `space-y-*` margins are reset to avoid doubled vertical rhythm.
- Shared settings dropdowns must use `SETTINGS_CONTROL_MENU_*` classes and `KK_LAYER.dropdown`; individual views should not reintroduce raw `z-[100]`, private `shadow-lg`, or private `backdrop-blur-md`.
- The main canvas page remains intentionally untouched in this pass because the user called out settings and non-canvas surfaces as the priority.

### Settings Visual Alignment Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-ui-system-contract.test.ts`: red first for missing visual alignment/control-menu contracts, then 7 tests passed.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/settings-ui-system-contract.test.ts tests/unit/settings-modal-ui-system-contract.test.ts tests/unit/settings-entry-surface-style-regression.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/mobile-settings-browser-verify-script.test.ts tests/unit/overlay-layer-ui-system-contract.test.ts`: 33 tests passed.
- `rg -n "z-\[100\]|shadow-lg|backdrop-blur-md" apps/web/src/components/settings/ui/index.tsx`: no matches.
- `npm.cmd run typecheck`: passed; server syntax check passed for 47 files and 426 test files typechecked.
- `npm.cmd run architecture:check`: passed. Existing hardcoded color and raw z-index warning lists remain outside this pass.
- `npm.cmd run build`: passed.
- `npm.cmd run governance:check`: passed.
- `npm.cmd run check:encoding`: passed.
- `git diff --check -- apps/web/src/components/settings/SettingsScaffold.tsx apps/web/src/components/settings/ui/index.tsx apps/web/src/styles/settings.css tests/unit/settings-ui-system-contract.test.ts docs/development/session-handoff.md`: passed with CRLF/LF normalization warnings only.
- Build artifact check found `settings-visual-shell-bg`, `settings-visual-sidebar-card-bg`, `settings-system-control-menu`, and the visual alignment layer inside `apps/web/dist/assets/SettingsPanel-*.css`.
- Runtime HTTP smoke: short-lived Vite job on `http://127.0.0.1:5198/settings` returned `status=200`, `length=4989`, and `root=True`, then was stopped.
- `npm.cmd run verify:mobile-settings-smoke`: exited 0 in fallback mode; direct settings routes returned 200, Playwright preflight passed, but the local backend/API proxy was not running.
- `npm.cmd run verify:desktop-settings-smoke`: exited 0 in fallback mode; direct settings routes returned 200, Playwright preflight passed, but the local backend/API proxy was not running.
- `npm.cmd run dev:status`: confirmed no residual Vite/API processes after smoke runs.

### Settings Visual Alignment Not Run
- Full `npm run verify:changes` was not run because the broader UI optimization goal is still progressing through scoped system passes.
- Full screenshot comparison QA was not completed: the Browser connector did not expose a direct navigation/screenshot tool in this session, and the Playwright smoke scripts fell back because the local backend/API proxy was not started.

### Settings Visual Alignment Risks And Next Steps
- Broader non-settings surfaces still need visible system passes: mobile chrome, admin recharge, PromptBar internals, ecommerce panels, and sign-up/confetti still appear in raw layer or token warning groups.
- Settings shell now has a stronger visible system layer, but screenshot review with a live backend should still be done before considering the full UI optimization goal complete.
- Some legacy styling still lives in `apps/web/src/index.css`; the final `settings.css` layer overrides it safely for settings, but future cleanup should gradually retire duplicated settings rules.

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

### Search Palette Current Design Decisions
- SearchPalette now consumes `KK_LAYER.modal`, matching the top-level overlay policy instead of carrying a private Tailwind z-index.
- `kk-search-palette-backdrop`, `kk-search-palette-scrim`, and `kk-search-palette-panel` are the reusable system primitives for future command/search overlays.
- Existing legacy Clay tokens are preserved as the visual source of truth via aliases such as `--kk-search-palette-backdrop-bg: var(--search-palette-overlay-bg)` and `--kk-search-palette-panel-shadow: var(--frost-card-framework-shadow)`.
- Mobile and desktop variants remain explicit through `data-search-surface` and `data-search-panel`; CSS data selectors own the shell radius and bottom-sheet edge treatment.

### Search Palette Verification Run
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

### Search Palette Not Run
- Full `npm run verify:changes` was not run because the overall UI optimization goal is still being advanced in scoped passes; keep it for the final release-grade convergence run.
- Browser screenshot QA is still blocked by the in-app Browser localhost policy returning `net::ERR_BLOCKED_BY_CLIENT`; HTTP smoke and build/test verification were used as fallback.

### Search Palette Risks And Next Steps
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
- 本轮遵循 KK Studio v1.5.7 当前事实，`config/release-manifest.json` 为主版本源。
- `apps/web/src/config/appInfo.ts` 运行时只读导出。
- `release/publish/stable/manifest.json` 为 portable stable 发布清单。
- 当前 Web runtime 为 `apps/web/`，未回退到根 `src/` 或历史入口。
- AI 相关治理仍以 `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`、`ToolRegistry`、`CanvasRuntimeState`、`DurableGenerationQueue`、`assets.zipOriginals`、`generation.createBatchJob` 为关键术语与能力边界。
- 生产密钥、支付状态、用户隐私路径和数据库凭据未写入前端或文档。

Primary Web runtime: `apps/web/`
Mobile workspace: `apps/mobile/`

## 2026-06-16 - Hosted Release Preflight Guardrails

### Hosted Release Scope
- Audited `npm run release:hosted:check`, `scripts/diagnose-hosted-release.mjs`, hosted frontend API base URL handling, and VPS runtime env checks for KK Studio v1.5.7.
- Fixed hosted preflight false positives for disabled frontend bypass flags while keeping enabled local/dev bypasses as blockers.
- Added hosted preflight blockers for local/private `VITE_KK_API_BASE_URL` and `VITE_PUBLIC_API_BASE_URL` values.
- Aligned hosted API required env diagnostics with current `server/` VPS startup/runtime constraints.
- Updated ignored local `.env.local` release snapshot values to avoid hosted build pollution:
  - `VITE_TURNSTILE_LOCAL_BYPASS=false`
  - `VITE_KK_API_BASE_URL=https://172-245-156-16.sslip.io`
  - `VITE_PUBLIC_API_BASE_URL=/api`

### Hosted Release Files Touched
- `scripts/diagnose-hosted-release.mjs`
- `tests/unit/hosted-release-guardrails.test.ts`
- `.env.local` (ignored local release snapshot)
- `docs/development/session-handoff.md`

### Hosted Release Design Decisions
- `VITE_ENABLE_LEGACY_WEB_API_FALLBACK` and `VITE_TURNSTILE_LOCAL_BYPASS` are treated as forbidden only when enabled; false-like values (`false`, `0`, `no`, `off`, or empty) are reported as disabled.
- Hosted API base URLs must be same-origin (`/`, `/api`, `proxy`, `self`, `relative`) or HTTPS. Loopback/private URLs and remote plain HTTP are blockers.
- `VITE_PUBLIC_API_BASE_URL` is optional, but if present it is validated with the same hosted URL safety rules because `packages/api-client` is still imported by Web admin surfaces.
- VPS backend required env diagnostics now include the canonical server startup/runtime keys: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `PASSWORD_SALT`, `JWT_SECRET`, `KK_API_SESSION_SIGNING_SECRET`, plus database, user API encryption, OAuth, WeChat, and Stripe keys already checked.

### Hosted Release Validation Run
- `node --test --test-isolation=none "tests/unit/hosted-release-guardrails.test.ts"`: passed, 3 tests.
- `npm run typecheck:tests`: passed, 434 test files.
- `npm run governance:check`: passed.
- `npm run check:encoding`: passed.
- `npm run release:hosted:check`: still exits 1 only for external Vercel state:
  - `.vercel/project.json` is missing.
  - Vercel auth is unavailable; run `vercel login` or provide `VERCEL_TOKEN`.

### Hosted Release Not Run
- Full `npm run verify:changes` was not run in this pass. The focused change is a release preflight script/config fix, and the preflight cannot go green until Vercel project linkage/auth exists in the local environment.

### Hosted Release Risks / Next
- Before hosted release, link the repo with `vercel link` and authenticate with `vercel login` or `VERCEL_TOKEN`, then rerun `npm run release:hosted:check`.
- Confirm VPS runtime env contains the required backend secrets in the actual VPS environment; local `server/.env.local` is absent in this workspace, so the script reports those as remote checks rather than hard local blockers.

## 2026-06-16 - Windows npm ci Native Addon Lock Recovery

### Windows npm ci Scope
- Diagnosed the local Windows `npm ci` EPERM failure path for native addon files, especially `lightningcss-win32-x64-msvc` and `@tailwindcss/oxide-win32-x64-msvc`.
- Added an explicit Windows recovery entry that can identify Restart Manager lockers for native `.node` files, list KK Studio dev/test processes, stop project dev/test processes, and remove stale npm native-addon cleanup directories.
- Kept the recovery path outside `verify:changes`; the verification chain continues to run exactly through architecture, governance, audit, typecheck, spec, build, tests, smoke checks, and encoding.

### Windows npm ci Files Touched
- `package.json`
- `scripts/dev/diagnose-install-locks.ps1`
- `tests/unit/windows-npm-ci-lock-recovery.test.ts`
- `docs/development/session-handoff.md`

### Windows npm ci Design Decisions
- `npm run install:diagnose-locks` is read-only. It scans native addon `.node` files with Windows Restart Manager and reports exact locking PIDs when available.
- `npm run install:recover` is the explicit recovery command. It stops KK Studio dev/test processes, then removes stale temporary native-addon directories such as `.lightningcss-*`, `@tailwindcss/.oxide-*`, and `@rollup/.rollup-*` only after checking for active lockers.
- The root cause observed locally was Vite holding native addon files. The first diagnosis found PID `60320` locking both `node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node` and `node_modules/@tailwindcss/oxide-win32-x64-msvc/tailwindcss-oxide.win32-x64-msvc.node`. After `verify:changes`, a fresh Vite PID `3204` held the same files until `npm run install:recover` stopped it.

### Windows npm ci Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/windows-npm-ci-lock-recovery.test.ts`: failed before the script existed, then passed after implementation.
- `npm run install:diagnose-locks`: identified Vite PID `60320` as the native addon locker before recovery.
- `npm run install:recover`: stopped the locker and removed stale native addon directories.
- `npm ci`: passed after recovery, adding 1026 packages with 0 vulnerabilities.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/windows-npm-ci-lock-recovery.test.ts tests/unit/dev-script-project-root.test.ts tests/unit/dev-script-port-owner-guards.test.ts`: passed, 11 tests.
- `npm run verify:changes`: passed. Mobile and desktop settings smoke scripts used their existing fallback contract path, and the full verification command exited 0.
- Final cleanup: `npm run install:recover`, `npm run dev:status`, and `npm run install:diagnose-locks` confirmed no Vite/API dev processes and no native addon locks remained.

### Windows npm ci Not Run / Deferred
- No additional server/mobile `npm ci --prefix ...` commands were run in this pass because the failure and recovery target was the root Windows workspace clean install.

### Windows npm ci Risks / Next
- `verify:changes` may start a local Vite process for smoke verification. If a clean install is needed after browser smoke checks, run `npm run install:recover` before `npm ci`.
- The working tree also contains existing or concurrent edits outside this pass, including hosted-release guardrails and dev script guard changes. This pass did not revert or rearrange those changes.

## 2026-06-16 - Visual Smoke Dev Lifecycle Recovery

### Visual Smoke Scope
- Diagnosed local `npm run dev:start`, repeated smoke fallback, `process-spawn-blocked`, and in-app Browser localhost access for KK Studio v1.5.7.
- Fixed dev restart/stop cleanup so stale API watch supervisors are cleared and API pid tracking keeps the stable supervisor instead of the transient port-owner child process.
- Updated desktop/mobile settings smoke scripts from the removed Advanced/diagnostics UI path to the current API model-center UI.
- Relaxed prompt-group drag verification with a named dock tolerance so pixel-level prompt bar overlap does not force fallback while connector-following still runs in browser mode.

### Visual Smoke Files Touched
- `scripts/dev/dev-launch.ps1`
- `scripts/dev/dev-stop.ps1`
- `scripts/test/verify-desktop-settings-smoke.mjs`
- `scripts/test/verify-mobile-settings-smoke.mjs`
- `scripts/test/verify-prompt-group-drag.mjs`
- `scripts/test/verify-startup-runtime-banner-centering.mjs`
- `tests/unit/dev-script-port-owner-guards.test.ts`
- `tests/unit/mobile-settings-browser-verify-script.test.ts`
- `tests/unit/prompt-group-browser-verify-script.test.ts`
- `docs/development/session-handoff.md`

### Visual Smoke Design Decisions
- `dev:start -Restart` now clears known dev port conflicts before reusing any healthy local listener, preventing old `node --watch` parents from respawning children behind the pid file.
- New API starts keep `.kk-local/run/dev-api.pid` pointed at the PowerShell watch supervisor; Vite still tracks the direct Node/Vite process.
- `dev-stop`/`dev-launch` use a single Win32 process snapshot plus listener owner snapshot for known dev process cleanup, avoiding slow repeated per-process listener scans.
- Settings smoke now verifies `settings-model-center`, provider pool, preset directory, local API add, proxy provider add, and editor back flow.
- Prompt drag smoke allows a 60px dock tolerance for the current prompt bar/card overlap while still requiring grouped spread and connector following.
- Browser smoke scripts remove their stale `*-fallback.json` artifact before attempting a fresh browser run, so an old fallback file no longer makes a successful run look degraded.

### Visual Smoke Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/dev-script-port-owner-guards.test.ts" "tests/unit/mobile-settings-browser-verify-script.test.ts"`: passed, 7 tests.
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/prompt-group-browser-verify-script.test.ts"`: passed, 6 tests.
- `npm run dev:stop`: passed with clean output.
- `npm run dev:start`: exited 0; `npm run dev:status` reported Vite PID `50900` on port 3000 healthy. API stayed stopped because local `.env.local` points `VITE_KK_API_BASE_URL` at the HTTPS VPS host.
- in-app Browser opened `http://127.0.0.1:3000/settings/api-management` and rendered `settings-page-root`, confirming Browser localhost access is not blocked.
- `npm run verify:desktop-settings-smoke`: passed in browser mode.
- `npm run verify:mobile-settings-smoke`: passed in browser mode.
- `npm run verify:startup-runtime-banner-centering`: passed in browser mode.
- `npm run verify:prompt-group-drag`: passed without fallback; `mainDragGrouped=true` and `childConnectorFollows=true`.
- Final recheck: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none "tests/unit/dev-script-port-owner-guards.test.ts" "tests/unit/mobile-settings-browser-verify-script.test.ts" "tests/unit/prompt-group-browser-verify-script.test.ts"` passed, 14 tests; `git diff --check` reported no whitespace errors, only existing CRLF normalization warnings.
- Final artifact check found no `temp/playwright/**/*fallback.json` files after the four browser smoke runs.

### Visual Smoke Not Run
- Full `npm run verify:changes` was not rerun for this focused pass. The relevant dev lifecycle checks, source contract tests, Browser access check, and four visual smoke scripts were run directly.

### Visual Smoke Risks / Next
- The visual smoke commands still emit existing local API/admin-model 502 console noise when no local API is running; the smoke route mocks keep the tested flows green, but log noise can still distract future debugging.
- The workspace had pre-existing unrelated edits before this pass; this pass did not revert or reorganize them.

## 2026-06-16 - UI Resource and Dependency Governance

### UI Resource / Dependency Scope
- Normalized UI asset ownership for KK Studio v1.5.7:
  - `apps/web/public` remains the URL-addressed runtime asset surface.
  - `apps/web/src/assets` keeps imported bundled UI assets only.
  - `packages/ui` remains code/tokens/components only, with no binary business assets.
- Replaced production favicon ownership from `/src/__create/favicon.png` to `/logo.png` and gated the dev-only error overlay script behind `import.meta.env.DEV`.
- Removed the FontAwesome CDN stylesheet with an embedded token from the Web root document.
- Switched recharge payment icons to existing SVG assets and removed duplicate PNG payment icons plus unused legacy avatar/Gemini/logo assets.
- Removed Web-local package locks (`apps/web/package-lock.json`, `apps/web/bun.lock`) and ignored them so the root npm lockfile stays the only Web dependency source of truth.
- Moved browser runtime dependencies into `apps/web/package.json`, kept root dependencies to root scripts/tooling (`jszip`, `pg`) plus CI/build dev tools, and kept `server/` package ownership separate.
- Added explicit workspace dependencies for `@kk/ui`, `@kk/shared`, and `@nano-banana/api-client`.
- Made `@kk/ui` independently typecheckable with React peer/dev dependencies, DOM/JSX compiler options, and a no-emit build.
- Updated `packages/api-client` query/client/type dependencies to the current compatible line.
- Rebuilt the root `package-lock.json` from a clean root lock state after removing stale hidden npm lock data that preserved workspace-local `@types/node@20.x` entries.

### UI Resource / Dependency Files Touched
- `.gitignore`
- `package.json`
- `package-lock.json`
- `apps/web/package.json`
- `apps/web/src/app/root.tsx`
- `apps/web/src/components/modals/RechargeModal.tsx`
- Removed `apps/web/package-lock.json`
- Removed `apps/web/bun.lock`
- Removed unused assets:
  - `apps/web/src/assets/payment/alipay.png`
  - `apps/web/src/assets/payment/card.png`
  - `apps/web/src/assets/payment/wechat.png`
  - `apps/web/src/assets/avatars/preset-male-1.svg`
  - `apps/web/src/assets/avatars/preset-male-2.svg`
  - `apps/web/src/assets/avatars/preset-male-3.svg`
  - `apps/web/src/assets/avatars/preset-female-1.svg`
  - `apps/web/src/assets/avatars/preset-female-2.svg`
  - `apps/web/src/assets/avatars/preset-female-3.svg`
  - `apps/web/src/assets/icons/google-gemini.svg`
  - `apps/web/src/assets/logo.png`
- `packages/api-client/package.json`
- `packages/ui/package.json`
- `packages/ui/tsconfig.json`
- `tests/unit/ui-resource-dependency-governance.test.ts`
- `docs/development/session-handoff.md`

### UI Resource / Dependency Design Decisions
- Root `npm@11.12.1` lockfile is the only Web workspace lock. Mobile/server lockfiles stay separate because they are not root npm workspaces.
- Root `build` now runs `npm run build -w packages/ui` before `packages/api-client` and the Web Vite build, so UI package compiler drift is caught in the normal build path.
- `@types/node` is pinned to the Node 24 line (`^24.13.2`) to match the root `engines.node = 24.x`; the generated dependency tree was verified clean with `npm ls --depth=0 --workspaces --include-workspace-root`.
- Web keeps Tailwind 3.4.19 for the app stylesheet/runtime while root/tooling uses Tailwind 4.3.1 and `@tailwindcss/postcss` 4.3.1. This avoids a Tailwind 4 application migration inside a dependency-governance pass.
- Chakra stays on the latest v2-compatible line (`^2.10.10`) because the project exposes it through `apps/web/src/client-integrations/chakra-ui.jsx`; jumping to Chakra v3 would be an API migration, not a safe dependency hygiene update.
- `vitest` remains in root devDependencies because root `tsc --noEmit` resolves `apps/web/*vitest.config.ts`, so the root toolchain must provide `vitest/config`.

### UI Resource / Dependency Verification Run
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ui-resource-dependency-governance.test.ts`: passed, 3 tests.
- `npm install`: passed, regenerated the root dependency state with 0 vulnerabilities.
- `npm run build -w packages/ui`: passed.
- `npm run architecture:check`: passed; the UI token checker still prints existing hardcoded color suggestions as non-blocking output.
- `npm run governance:check`: passed.
- `npm run typecheck`: passed, including server syntax check for 47 files and semantic test check for 436 test files.
- `npm run build`: passed, including `packages/ui`, `packages/api-client`, and the Web Vite production build.
- `npm audit --omit=dev --audit-level=moderate`: passed with 0 vulnerabilities.
- `npm ls --depth=0 --workspaces --include-workspace-root`: passed with no invalid or extraneous dependencies after hidden npm lock cleanup.
- `npm run verify:changes`: passed after the clean lockfile regeneration. It covered architecture, governance, audit, typecheck, spec, build, unit/integration/contract/e2e tests, prompt-group drag smoke, mobile settings smoke, desktop settings smoke, startup banner centering, and encoding/mojibake checks.

### UI Resource / Dependency Not Run
- No separate server/mobile install or build commands were run. This pass intentionally targeted the root npm workspace, Web UI resources, `packages/ui`, and `packages/api-client`; `server/` and `apps/mobile/` keep their own package locks.

### UI Resource / Dependency Risks / Next
- `verify:mobile-settings-smoke` currently exits 0 through its existing fallback contract path because Playwright times out waiting for `settings-workbench-overview`; desktop settings smoke and startup banner smoke run in browser mode. This was not caused by the dependency tree after the clean lockfile pass, but it is still a useful future smoke-script follow-up.
- The architecture check still reports existing hardcoded color literal suggestions from the UI token checker without failing. This pass did not broaden into token migration.
- The working tree already contained unrelated settings/canvas edits before this pass. This pass did not revert or reorganize those changes.
