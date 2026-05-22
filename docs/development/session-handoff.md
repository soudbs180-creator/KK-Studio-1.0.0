# 2026-05-22 单主线交接

## 1. 总状态
- 当前仍只保留一条执行主线：`API 路由与信用计费`、`设置 / 管理后台 / 鉴权`、`移动端 / 电商续作`。
- settings 相关本轮新增收口如下：
  - `/settings` 直达入口已接通。
  - settings 浮层与 settings 页面已统一为同一套 workbench shell。
  - fullscreen 启动阻塞卡已取消，后台预热改为非阻塞顶部提示。
  - `verify:desktop-settings-smoke` 已新增并跑通。
- 当前对外口径继续保守：除非再补完手工烟测，否则 `设置 / 管理后台 / 鉴权` 继续写成 `已落地待回归`。

## 2. 当前事实基线
- 当前版本：`1.4.7`
- `config/release-manifest.json` 是主版本源。
- `src/config/appInfo.ts` 是运行时只读导出。
- `release/publish/stable/manifest.json` 是 portable stable 发布清单。
- 当前在线前端运行时：根目录 `src/`
- 目标前端运行时：`apps/web/`
- `src/` remains the live frontend runtime.
- `apps/payment-sidecar/` is the canonical payment runtime.
- settings 继续按“自托管 route-driven workbench”描述，不写成“根级路由迁移完成”。
- `/settings*` 已可直达，但根级 `BrowserRouter` 迁移仍是 `进行中`。

## 3. 模块状态
### 3.1 API 路由与信用计费
- **状态**：`已落地待回归`
- **交接口径**
  - request-profile registry / alias truth source 已收口。
  - credit-route 直测已补齐。
  - 继续只允许做 provider-specific 统一和回归，不开启新 provider 战线。

### 3.2 设置 / 管理后台 / 鉴权
- **状态**：`已落地待回归`
- **本轮已支持**
  - `/settings`、`/settings/api-management` 与 settings 深链可直达。
  - settings 浮层与直达页面共享同一 shell、同一路由工厂、同一 view 语义。
  - desktop settings smoke 已覆盖直达 settings、API workbench、diagnostics toggle、editor 进出和工作区打开 settings。
  - fullscreen startup blocker 已取消，工作区优先渲染。
  - 启动仍可显示进度，但只作为非阻塞顶部提示出现。
- **仍未收口**
  - 根级 `BrowserRouter` 迁移仍在 `进行中`。
  - settings 最终产品观感、登录回跳和人工体验仍需手工确认。

### 3.3 移动端 / 电商续作
- **状态**：`已落地待回归`
- **交接口径**
  - mobile continuation、three-zone shell、shared projection 继续成立。
  - 剩余优先级仍是移动端真实触控体验与外部登录回跳人工确认。

## 4. 今日关键变化
- `createAppRootMode()` 已支持 `settings` 根模式。
- 新增 `src/app/SettingsPageRoot.tsx`。
- `SettingsPanel` 支持 `page / overlay` 双承载。
- settings token 已朝灰阶控制台统一。
- `AppStartupScreen` 与 `StorageSelectionModal` 已去掉亮蓝主视觉。
- 新增 `verify:desktop-settings-smoke` 并并入主验证链。

## 5. 未收口项
- 手工确认仍需：
  - 启动体感是否达到“秒进”
  - settings 页面与浮层最终观感
  - 外部登录回跳
  - 移动端真实触控体感
- `src -> apps/web` 迁移未完成。
- 根级 `BrowserRouter` 迁移未完成。
- 支付桥接层与多供应商 follow-up 仍在进行中。

## 6. 验证证据
```text
node --test "tests/unit/kkai-app-root.test.ts" "tests/unit/settings-dual-entry-regression.test.ts" "tests/unit/app-startup-coordinator.test.ts" "tests/unit/app-startup-screen-localization.test.ts" "tests/unit/mobile-settings-browser-verify-script.test.ts" "tests/unit/settings-entry-surface-style-regression.test.ts" "tests/unit/settings-shell-scroll-regression.test.ts"
node scripts/test/verify-desktop-settings-smoke.mjs
npm run typecheck
npm run dev:status
```

- 当前结果：以上命令已通过。
- 浏览器产物目录：
  - `.tmp-playwright/desktop-settings-smoke`
  - `.tmp-playwright/mobile-settings-smoke`
  - `.tmp-playwright/prompt-group-drag`

## 7. 历史线程归档
- provider-phase / vendor follow-up -> 归入 `API 路由与信用计费`
- auth-password-change / profile modal -> 归入 `设置 / 管理后台 / 鉴权`
- prompt-group / mobile-ecommerce / three-zone -> 归入 `移动端 / 电商续作`
- settings-router / workbench-shell -> 归入 `设置 / 管理后台 / 鉴权`

*Handoff Updated: 2026-05-22*
