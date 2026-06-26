# 本地开发与发布部署指南

本目录只保留 KK Studio v1.5.9 当前运行链路的环境、部署 and 本地调试说明。支付方向以 Stripe checkout/webhook 与 `/api/v1/billing/recharge-submissions` 人工审核充值为准。

## 当前文档

1. [GUIDE.md](GUIDE.md) - VPS、自建 PostgreSQL、Nginx、端口和服务进程的部署手册。
2. [ADMIN.md](ADMIN.md) - 管理员账号初始化、权限和后台运维配置。
3. [SUPABASE_CLI.md](SUPABASE_CLI.md)、[SUPABASE.md](SUPABASE.md)、[SUPABASE_BASELINE.md](SUPABASE_BASELINE.md) - Supabase 本地调试和历史迁移参考；当前数据事实以 `server/` 与 `migrations/` 为准。
4. [AUTO_UPDATE_AND_DEPLOY.md](AUTO_UPDATE_AND_DEPLOY.md) - 自动更新与发布脚本说明。

已退役的 Alipay MCP 接入文档和脚本不再属于当前主链路。历史支付资料只能进入 `docs/archive/`，不能重新被 setup、OpenAPI、服务端路由或发布包引用。

## 部署验证

- 部署完成后，在服务器上验证 Express 服务、PostgreSQL 连接、Stripe webhook 配置和静态资源版本。
- 环境变量必须来自 `.env` 或部署平台配置，禁止把生产密钥、Webhook Secret、数据库凭据或用户隐私文件写入前端和文档。
