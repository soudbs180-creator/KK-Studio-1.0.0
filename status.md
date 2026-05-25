# 状态跟踪 (status.md)

本文件是 AGENTS 明确规定的根目录例外文件。记录项目收敛与各阶段验证状态。

## 整体进度 (截至 2026-05-25)
- [x] 里程碑 1：治理与文档基线 (已完成)
- [x] 里程碑 2：目录与包结构收敛 (已完成)
- [x] 里程碑 3：Netlify 后端与 API 边界 (已完成)
- [x] 里程碑 4：数据库与支付安全 (已完成)
- [ ] 里程碑 5：api-client 与前端安全重构 (已启动)
- [ ] 里程碑 6：测试与验证路径迁移 (未开始)
- [ ] 里程碑 7：移动端补齐 (未开始)

## 当前状态
- **里程碑 3 & 4 (Netlify 后端 API & 数据库支付安全)** 已于 2026-05-25 100% 完成：
  - 新增了数据库前进迁移文件 `migrations/003_strict_agents_schema.sql`，建立了可信的支付和充值表结构与初始方案。
  - 在 `netlify/functions` 编写了 `auth`、`generate-image`、`openai-chat`、`billing`、`user` 和 `generations` 的 6 个 API 端点。
  - 引入了 `netlify/lib` 模块化工具库，统一响应编码和 headers，拦截并使用英文提示前端。
  - 重构了 `payment-server` 以严格校验 Stripe webhook 签名，按 `stripe_session_id` 查询订单额度入库。
  - 修复了 `NodeJS.Timeout` 类型冲突以及 `tests/unit` 中的路径报错，使 typecheck 全绿通过。
- **里程碑 5 (api-client 与前端安全重构)** 已启动。
