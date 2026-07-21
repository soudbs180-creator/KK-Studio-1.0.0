Status: reference

# KK Studio 当前部署与本地运行

本目录只描述 KK Studio v1.6.0 当前的 `apps/web/` + `services/api/` + VPS
PostgreSQL 运行链路。版本事实来自 `config/release-manifest.json`，数据库
结构变更来自 `infrastructure/database/migrations/`；浏览器和文档都不得直接连接 Provider、数据库
或支付系统。

## 当前入口

- [GUIDE.md](GUIDE.md)：本地启动、VPS 环境和发布前检查。
- [ADMIN.md](ADMIN.md)：服务端管理员初始化与运维边界。
- [AUTO_UPDATE_AND_DEPLOY.md](AUTO_UPDATE_AND_DEPLOY.md)：发布和更新脚本。
- [../governance/PROJECT_STATE_AND_VALIDATION.md](../governance/PROJECT_STATE_AND_VALIDATION.md)：
  当前事实与验证命令。

## 历史资料

以下文件保留名称以便旧链接平稳迁移，但内容只作历史索引，不能执行：

- `SUPABASE.md`
- `SUPABASE_CLI.md`
- `SUPABASE_BASELINE.md`
- `SUPABASE_AUTH_SECURITY.md`

它们不包含项目地址、客户端环境变量、访问令牌、默认密码或可复制的旧
迁移命令。需要了解历史迁移时，只读 `docs/archive/` 中明确标记的记录，
并以当前源码和 `infrastructure/database/migrations/` 为准。

## 安全边界

- 生产密钥、数据库 URL、会话令牌和管理员凭据只能通过部署环境注入。
- 账户、计费和 Provider 写操作必须经过认证的 `services/api/` API；Agent 只能
  读取脱敏摘要或请求用户确认。
- 缺少必需环境变量时服务应 fail closed，不得使用默认值启动。
