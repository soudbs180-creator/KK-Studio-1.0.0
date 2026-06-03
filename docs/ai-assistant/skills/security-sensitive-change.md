# 安全敏感修改防护 Skill (security-sensitive-change)

- **适用场景**: 对 API Key、JWT 校验、计费与退款逻辑、数据库 Schema 及生产 VPS 部署环境进行任何改动时。
- **调用工具**:
  - `fillApiKey`
- **强规则 (Hard Boundaries)**:
  - **绝对禁止**: 绝对禁止 AI 助手在运行日志中保存明文密钥，严禁在前端直接读取或提交用户的 JWT 令牌、密码哈希与 Stripe 支付 Secret。
  - **隔离执行**: 任何对数据库表结构的修改必须仅通过 `migrations/` 目录下的 DDL SQL 文件完成，不能在普通运行时逻辑里执行 DDL。
  - **二次确认**: 凡属 `dangerous` 权限的工具操作，必须通过 `confirmationPolicy` 拉起前端对话框提供二次确认，说明影响范围后方能执行。
