# 2026-04-14 单主线进度报告

## 1. 总状态
- 当前主线仍保持为三块：`API 路由与信用计费`、`设置 / 管理后台 / 鉴权`、`移动端 / 电商续作`。
- 本轮新增重点收口的是 `设置 / 管理后台 / 鉴权` 内的 settings 入口与入场体验：
  - `/settings` 与 `/settings/api-management` 直达入口已接通。
  - 应用内 settings 浮层与直达 settings 页面已共用同一套 workbench shell。
  - 全屏“正在进入工作区”阻塞遮罩已移除，改为非阻塞顶部提示。
  - 新增 `verify:desktop-settings-smoke`，把 desktop settings 真实浏览器路径纳入自动验证。
- 对外状态仍保持保守：
  - `API 路由与信用计费`：`已落地待回归`
  - `设置 / 管理后台 / 鉴权`：`已落地待回归`
  - `移动端 / 电商续作`：`已落地待回归`
  - `前端运行时迁移`：`进行中`
  - `支付迁移`：`已支持` + `进行中`
  - `多供应商 Phase 1`：`进行中`

## 2. 统一事实基线
- 当前版本：`1.4.2`
- `config/release-manifest.json` 是版本真相源。
- `src/config/appInfo.ts` 是运行时只读导出。
- `release/publish/stable/manifest.json` 是 stable 发布清单。
- settings 仍按“自托管 route-driven workbench”口径描述，不写成“全应用根级 `BrowserRouter` 已迁移完成”。
- `/settings*` 现在已具备真实页面入口，但这不改变“根级 `BrowserRouter` 迁移仍在 `进行中`”的事实。
- 工作区启动现在遵循：
  - 能渲染工作区时优先先渲染工作区。
  - 后台预热仍可继续，但只通过非阻塞提示暴露。
  - 不再用全屏黑色阻塞卡遮住已经能显示的工作区。

## 3. 模块进度
### 3.1 API 路由与信用计费
- **状态**：`已落地待回归`
- **已支持**
  - `RequestProfile`、`CreditRouteUnit`、`CreditModelSpec`、`ModelExecutionLane` 主合同已进入运行时。
  - `providerStrategy` 已对齐 request-profile registry / alias truth source。
  - `adminModelService` 的 credit-route 直测已补齐。
- **仍未收口**
  - 多供应商 Phase 1 仍需继续围绕 `GPT Best / Suxi / 12AI` 做统一和回归。

### 3.2 设置 / 管理后台 / 鉴权
- **状态**：`已落地待回归`
- **已支持**
  - settings registry、route factory、route-driven workbench shell 已落地。
  - `ApiSettingsView` 在 router 外仍可自包 `MemoryRouter`，在 settings 页面 / 浮层双入口下共用同一路由语义。
  - `/settings`、`/settings/api-management` 与现有 settings 子路径深链已接通。
  - 应用内 settings 浮层与直达 settings 页面已共用同一套 shell。
  - desktop settings 用户菜单入口、settings 页面根容器、API workbench 主动作与编辑返回已补稳定选择器。
  - `verify:mobile-settings-smoke` 与新增 `verify:desktop-settings-smoke` 已覆盖 mobile / desktop settings 关键浏览器路径。
  - 全屏启动阻塞遮罩已移除，改为顶部非阻塞启动提示。
- **仍未收口**
  - 根级 `BrowserRouter` 迁移仍未完成，继续记为 `进行中`。
  - settings 最终产品体验、外部登录回跳与部分手工体验仍需人工确认。
  - API 管理在不同登录/本地 API 状态下虽然已有更稳定结构，但仍保留 `已落地待回归` 口径。

### 3.3 移动端 / 电商续作
- **状态**：`已落地待回归`
- **已支持**
  - `prompt-group` regroup / live layout / connector following 已落地。
  - `EcommerceGroupSlotState` 继续作为 slot current/history/preview 唯一运行态合同。
  - `MobileResultTile`、mobile continuation、three-zone mobile shell 继续按共享状态投影。
  - `verify:prompt-group-drag` 与 `verify:mobile-settings-smoke` 已在浏览器脚本中跑通。
- **仍未收口**
  - 真实触控体感、外部登录回跳和手工体验细节仍需人工确认。

## 4. 迁移完成度
| 主题 | 当前状态 | 说明 |
| --- | --- | --- |
| `src -> apps/web` 前端运行时迁移 | `进行中` | `src/` 仍是在线前端运行时，`apps/web/` 仍是目标运行时 |
| settings 双入口统一 | `已落地待回归` | 浮层与直达页面已统一 shell，但整体体验仍需手工验收 |
| 根级 `BrowserRouter` 迁移 | `进行中` | 本轮未扩成全站路由重构 |
| `payment-server -> apps/payment-sidecar` | `已支持` + `进行中` | `apps/payment-sidecar/` 为主运行时，`payment-server/` 仍是桥接层 |
| 多供应商 Phase 1 | `进行中` | 继续围绕 provider-specific follow-up 做回归 |

## 5. 2026-04-14 今日变化
- `createAppRootMode()` 不再只返回 `workspace`，现在能识别 `workspace / settings` 两种根模式。
- 新增 `src/app/SettingsPageRoot.tsx`，使 `/settings*` 成为真实入口，而不是落回空白工作区。
- `SettingsPanel` 现已支持 `overlay / page` 两种承载方式，共用同一套 settings shell。
- `src/index.css` 的 settings 视觉 token 已朝灰阶控制台方向收口：
  - dark shell/page 不再走纯黑 + 蓝光主视觉。
  - 默认主按钮 / 导航激活改为中性灰。
  - 子卡片默认无阴影，避免“模块外一层阴影、模块里再一层阴影”的割裂感。
- `AppStartupScreen` 与 `StorageSelectionModal` 已去掉亮蓝 / indigo 作为默认主视觉。
- `AuthenticatedAppShell` 已去除全屏阻塞启动卡，改为顶部非阻塞启动提示。
- 新增 `verify:desktop-settings-smoke`，并将其并入 `verify:changes`。
- desktop smoke 已覆盖：
  - `/settings`
  - `/settings/api-management`
  - diagnostics toggle
  - local API editor 进入 / 返回
  - 工作区桌面用户菜单打开 settings

## 6. 未收口项
- 剩余手工确认已收窄为：
  - 首页启动体感是否达到“秒进”预期
  - settings 直达页与浮层的最终产品观感
  - 外部登录回跳
  - 移动端真实触控体感
- 根级 `BrowserRouter` 统一仍未完成。
- `src -> apps/web` 迁移仍未完成。
- 多供应商 Phase 1 仍有 provider-specific follow-up。

## 7. 验证证据
- `node --test "tests/unit/kkai-app-root.test.ts" "tests/unit/settings-dual-entry-regression.test.ts" "tests/unit/app-startup-coordinator.test.ts" "tests/unit/app-startup-screen-localization.test.ts" "tests/unit/mobile-settings-browser-verify-script.test.ts" "tests/unit/settings-entry-surface-style-regression.test.ts" "tests/unit/settings-shell-scroll-regression.test.ts"` -> 通过，`14/14` 通过。
- `node scripts/test/verify-desktop-settings-smoke.mjs` -> 通过。
- `npm run typecheck` -> 通过。
- `npm run dev:start` / `npm run dev:status` -> 本地前端与 API 均恢复为 healthy。
- 浏览器脚本产物目录：
  - `.tmp-playwright/mobile-settings-smoke`
  - `.tmp-playwright/desktop-settings-smoke`
  - `.tmp-playwright/prompt-group-drag`

*Report Updated: 2026-04-14*
