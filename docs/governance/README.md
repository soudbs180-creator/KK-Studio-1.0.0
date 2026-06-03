# 项目治理规范 (docs/governance/README.md)

本目录包含 KK Studio 项目的**治理、安全性以及规范性准则**。此处的文件定义了在开发过程中必须严守的底线，具有最高的约束力，与项目根目录下的 `AGENTS.md` 规范强关联。

## 📁 目录文件清单

1. **[ENCODING_AND_POWERSHELL.md](ENCODING_AND_POWERSHELL.md) —— 编码与乱码规则**
   - **职责**：强制要求所有新增、修改的文本文件和脚本遵循 `UTF-8 without BOM` 编码及 `LF` 换行符。规范 PowerShell 显式指定编码（`utf8NoBOM`），杜绝 GBK 等字符集产生的乱码。
   - **适用场景**：执行任何文件读写、创建新脚本或配置文件的任务。

2. **[SECURITY_AND_BACKLOG.md](SECURITY_AND_BACKLOG.md) —— 安全与后端整改**
   - **职责**：规定敏感密钥的安全隔离、CORS Origin 白名单规则、JWT 中间件校验、 Stipe Webhook 验签、以及用户积分原子扣减与退款审计逻辑。
   - **适用场景**：修改鉴权、Session、Stripe 支付、API Proxy 转发、积分流水或管理员模型定价等高风险业务。

3. **[PROJECT_STATE_AND_VALIDATION.md](PROJECT_STATE_AND_VALIDATION.md) —— 项目状态与验证**
   - **职责**：记录项目的历史版本迭代、测试覆盖率以及必须执行的自动化/人工验证指令清单（如 `npm run verify:changes` 等）。
   - **适用场景**：发布新版本、提交 PR 或验证当前代码行为是否正确。

## ⚠️ 治理红线

- **严禁乱码**：所有提交严禁带有 BOM 或使用 GBK/ANSI 编码。
- **密钥零泄露**：严禁在日志、提示词或代码库中泄露真实 API Key 或 Stripe Secret。
- **财务审计闭环**：积分扣减必须基于后端权威，严禁绕过积分系统。
