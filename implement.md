# 实施细节记录 (implement.md)

本文件是 AGENTS 明确规定的根目录例外文件。记录每个里程碑的开发与代码调整细节。

## 里程碑 1 执行细节
- 创建 `plans.md`、`implement.md`、`status.md`、`validation.md`。
- 清理非规范文件，确认 `docs/` 下各文档归位，合并/删除 `docs/docs`。
- 重构 `scripts/governance/check-agent-docs.mjs`，去除已不存在的 `.agent` 依赖，将硬编码文件指向 `docs` 目录。
- 重构 `scripts/governance/check-version-consistency.mjs`，更新 `versionTargets`，支持把 `readme` 绑定 to `docs/README.md`，剔除 `.agent` 相关逻辑。
- 修正 `scripts/architecture/check-import-boundaries.mjs` 和 `check-legacy-zone-boundaries.mjs`，排除遗留的根目录 `src` 检查，收敛到新结构。
- 更新 `config/release-manifest.json`，确保配置不含敏感密钥并映射正确的路径。

## 里程碑 2 执行细节 (2026-05-25)
- **代码物理合并与清理**：
  - 合并 `@kk/contracts` 与 `@kk/domain` 模块的所有代码到 `packages/shared/src/contracts` 和 `packages/shared/src/domain`，在 `packages/shared/src/index.ts` 重新导出，并彻底删除了旧包目录。
  - 全局替换 `apps/web/src` 和其他配置文件中对 `@kk/contracts` 的引用，重定向至 `@kk/shared`。
  - 升级 `packages/ui` 拥有真实的独立 `package.json` 工作区，同步版本为 `1.4.8`，导出安全设计令牌。
  - 物理清理已废弃的过渡目录 `apps/api`、`apps/admin`、`apps/payment-sidecar`、根 `billing/`。
- **部署脚本与测试路径重组**：
  - 迁移 `deploy` 至 `config/deploy`，同步重构了 vps 部署脚本 and 部署断言测试中的指向别名。
  - 修复 `tests/unit/` 中因废弃包删除、路径迁移等引发的 TSC 编译及路径报错（涉及 `user-api-profile-storage-local-only`、`google-auth-service`、`ecommerce-group-export-runtime-contract` 等测试）。
  - 在 `tests/unit` 对 `readSource` 进行了拦截封装，使其在检测到以 `src/` 或 `packages/contracts/` 开头时自动重定向至 `apps/web/src/` 或 `packages/shared/src/contracts/`，保证测试代码加载的稳健性。
- **治理与规约兼容**：
  - 更新 `docs/architecture/COMPATIBILITY_LAYER_REGISTRY.json` 中已废弃的回归测试映射到现存的测试文件。
  - 重构 `scripts/architecture/check-spec-structure.mjs`，移除已物理清理的目录定义，替换为规范工作区的 package.json 和 index.ts 检测。
- **移动端补齐**：
  - 初始化了 `apps/mobile` 作为 Expo Managed + expo-router 独立工作区，提供 `app.json`、`tsconfig.json` 并在 `package.json` 中配置了共享依赖，建立了最小应用的路由入口 `src/app/_layout.tsx` 和主页。
  - 执行 `npm install` 刷新 monorepo 子工作区软链接。

## 里程碑 3 & 4 执行细节 (2026-05-25)
- **Netlify 无服务器后端重构**：
  - 新增 Netlify 函数公共库 `netlify/lib/`，包括 `db.ts`（支持事务和连接池单例）、`jwt.ts`（HMAC-SHA256 签发/验签）、`response.ts`（统一跨域、编码及 nosniff 头部设置）以及 `billing-plans.ts`（服务端套餐明细定义）。
  - 创建了 6 个 API 端点：`auth.ts`（带密码 Hash 与 token 刷新）、`generate-image.ts`（Gemini 扣除积分后生成）、`openai-chat.ts`（OpenAI 对话扣分）、`billing.ts`（读取套餐方案并创建 checkout 会话）、`user.ts`（防篡改个人信息更新）与 `generations.ts`（获取生成历史记录）。
- **支付与数据库硬化**：
  - 编写了前进数据库迁移 `migrations/003_strict_agents_schema.sql`，安全支持账单、充值与扣费机制。
  - 重构了 `payment-server`：下线了旧兼容支付路由，只提供经过签名校验的安全 Stripe Webhook `/webhook/stripe`，防范假冒 Session 越权。
  - 修复了 `App.tsx`、`PromptBar.tsx`、`ProjectManager.tsx` 和 `notificationService.ts` 中的 `Timeout` 类型冲突。
  - 修复了 `tests/unit/workspace-auth-gate.test.ts` 中废弃 `src` 的引用路径。

