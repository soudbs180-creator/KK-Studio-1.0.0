# KK Studio 当前环境与发布指南

Status: reference 这是 `apps/web/`、`services/api/` 和 VPS PostgreSQL 的部署说明；
旧托管数据库/边缘函数指南已归档，不得作为当前运行入口。

## 1. 前置条件

- Node 与 npm 版本遵循根 `package.json` 的 `engines` 和 `packageManager`。
- PostgreSQL 由部署环境提供，结构变更只执行 `infrastructure/database/migrations/` 中经过审查的
  SQL。
- 生产环境必须提供认证、数据库、Provider 和支付所需的环境变量。变量名
 见 `.env.example`；值由部署平台或本机外部密钥管理器注入。

## 2. 本地启动

```bash
npm install
npm run build -w packages/shared
npm run build -w packages/ui
npm run build -w packages/api-client
npm run dev:start
```

本地 API 调试可使用 `npm run api:dev`。不要在浏览器中填写 Provider
密钥后直接请求供应商；Web 与 Mobile 都通过 `packages/api-client` 调用
`services/api/`。

## 3. VPS 发布顺序

1. 在部署平台设置环境变量和允许的 Web Origin。
2. 安装依赖并构建共享包、UI 包、API Client 与 Web。
3. 以受控发布流程执行 `infrastructure/database/migrations/`，记录迁移版本和备份标识。
4. 启动 `services/api/`，检查健康端点、数据库连接、Provider 路由和 Stripe
   webhook 验签。
5. 运行 `npm run governance:check`、`npm run architecture:check`、
   `npm run typecheck` 和 `npm run build`，再执行目标 smoke。

## 4. 配置和回滚

配置缺失、版本不匹配或迁移失败时停止发布，不回退到已删除的根目录或
旧支付服务。回滚应由发布平台恢复上一个已验证构建，并按数据库迁移的
回滚策略处理；不要在业务路由中临时执行 DDL。

## 5. 相关文档

- [项目状态与验证](../governance/PROJECT_STATE_AND_VALIDATION.md)
- [API 文档中心](../api/README.md)
- [版本发布规范](../governance/VERSION_AND_RELEASE.md)
