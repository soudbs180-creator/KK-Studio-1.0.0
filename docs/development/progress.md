# 2026-05-24 单主线进度报告

## 1. 总状态
- 当前主线仍保持为三块：`API 路由与信用计费`、`设置 / 管理后台 / 鉴权`、`移动端 / 电商续作`。
- 本轮新增重点收口的是 `移动端 / 电商续作` 内的模型常用置顶功能，以及清退无用代码和修复单元测试契约：
  - 移除了移动端模型列表中容易与页面滚动、画布拖拽发生争夺的手势侧滑。
  - 将模型置顶交互重构为直接点击的图钉（📌/📍）按钮，彻底根治触控冲突问题。
  - 清理了 `PromptBar.tsx` 中的无用触控手势垃圾代码，跑通了 `ui-unused-cleanup-contract` 测试。
- 对外状态仍保持保守：
  - `API 路由与信用计费`：`已落地待回归`
  - `设置 / 管理后台 / 鉴权`：`已落地待回归`
  - `移动端 / 电商续作`：`已落地待回归`
  - `前端运行时迁移`：`进行中`
  - `支付迁移`：`已支持` + `进行中`
  - `多供应商 Phase 1`：`进行中`

## 2. 统一事实基线
- 当前版本：`1.4.8`
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
  - 移动端常用模型列表去除了手势侧滑交互，重构为直接点击的图钉置顶按钮（📌/📍），彻底根治与纵向滚动的手势冲突，提升触控稳定性。
- **仍未收口**
  - 外部登录回跳和手工体验细节仍需人工确认。

## 4. 迁移完成度
| 主题 | 当前状态 | 说明 |
| --- | --- | --- |
| `src -> apps/web` 前端运行时迁移 | `进行中` | `src/` 仍是在线前端运行时，`apps/web/` 仍是目标运行时 |
| settings 双入口统一 | `已落地待回归` | 浮层与直达页面已统一 shell，但整体体验仍需手工验收 |
| 根级 `BrowserRouter` 迁移 | `进行中` | 本轮未扩成全站路由重构 |
| `payment-server -> apps/payment-sidecar` | `已支持` + `进行中` | `apps/payment-sidecar/` 为主运行时，`payment-server/` 仍是桥接层 |
| 多供应商 Phase 1 | `进行中` | 继续围绕 provider-specific follow-up 做回归 |

## 5. 2026-05-24 今日变化
- 移动端常用模型选择的侧滑手势转换为直观的“图钉置顶”（📌 / 📍）按钮，避免与滚动/拖拽发生手势争夺。
- 彻底清理了 `src/components/layout/PromptBar.tsx` 中的无用/垃圾侧滑手势触控代码，跑通了 `ui-unused-cleanup-contract` 契约单元测试。
- 对齐项目全部说明文档（README.md, DESIGN.md 等）至 1.4.8 版本，规范化最新的 Clay UI v3.0 及 API 架构。

## 6. 未收口项
- 剩余手工确认已收窄为：
  - 首页启动体感是否达到“秒进”预期
  - settings 直达页与浮层的最终产品观感
  - 外部登录回跳
- 根级 `BrowserRouter` 统一仍未完成。
- `src -> apps/web` 迁移仍未完成。
- 多供应商 Phase 1 仍有 provider-specific follow-up。

## 7. 验证证据
- `node --test tests/unit/ui-unused-cleanup-contract.test.ts` -> 通过。
- `node --test "tests/unit/kkai-app-root.test.ts" "tests/unit/settings-dual-entry-regression.test.ts" "tests/unit/app-startup-coordinator.test.ts" "tests/unit/app-startup-screen-localization.test.ts" "tests/unit/mobile-settings-browser-verify-script.test.ts" "tests/unit/settings-entry-surface-style-regression.test.ts" "tests/unit/settings-shell-scroll-regression.test.ts"` -> 通过，`14/14` 通过。
- `node scripts/test/verify-desktop-settings-smoke.mjs` -> 通过。
- `npm run typecheck` -> 通过。
- `npm run dev:start` / `npm run dev:status` -> 本地前端与 API 均恢复为 healthy。
- 浏览器脚本产物目录：
  - `.tmp-playwright/mobile-settings-smoke`
  - `.tmp-playwright/desktop-settings-smoke`
  - `.tmp-playwright/prompt-group-drag`

*Report Updated: 2026-05-24*
