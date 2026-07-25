Status: reference

# Legacy Pruning and Anti-Regression Registry (v1.6.1)

Last Updated: 2026-06-26
Project Version: 1.6.1

## 1. 已废弃与被清理的旧模块/入口 (Pruned Entrypoints)
为了彻底给项目瘦身，防止旧版的冗余逻辑对新版本的打包和性能产生拖拽，以下模块已被永久移除、迁移或归档：

| 废弃模块/路径 | 替代或升级方案 | 防回流规则 (Anti-Regression Rule) |
| :--- | :--- | :--- |
| **根 `src/` 目录** | 全部业务代码已迁移至 `apps/web/src/` | `check-legacy-zone-boundaries.mjs` 静态拦截任何针对根 `src/` 的 import 引用。 |
| **`apps/admin/`** | 移除前端直连后台。控制台操作已迁移至独立的外部管理系统 | package.json scripts 中将 `admin:dev` 等抛错挂起，防止本地误起。 |
| **`apps/api/` & `apps/payment-side*`** | 合并至统一的 Express `services/api/` 运行时 | CI 脚本扫描 workspace directories，若检测到废弃路径直接挂起构建。 |
| **旧 Canvas 页面 & 碎片化卡片** | 升级为高性能无限画布 `WorkspacePage.tsx` 和 Grid Bucket 空间索引，移除零散卡片 | `check-no-legacy-canvas-import.mjs` 静态确认没有任何老旧画布布局被前端装载。 |
| **网页直接调用 Provider API** | 统一收口至 `ProviderRouteEngine` 决策 | `check-no-direct-provider-fetch-in-ui.mjs` 检测 UI 组件是否存在直接 fetch 第三方模型接口的逻辑。 |

## 2. 静态边界校验脚本 (CI Guards)
为确保上述废弃代码和旧逻辑绝对不会通过分支合并“死灰复燃”，项目在 `package.json` 的 `architecture:check` 命令中强制绑定了如下校验：
1. `check-legacy-zone-boundaries.mjs`
2. `check-no-direct-provider-fetch-in-ui.mjs`
3. `check-no-legacy-canvas-import.mjs`
4. `check-provider-route-engine-required.mjs`
任何新开发的分支代码若违背上述规则，在提交 Husky 校验或 CI 构建时将被强行拦截。
