# 过时与历史文档归档区 (docs/archive/README.md)

⚠️ **重要警告 (AI / Agent & Developer WARNING)**
**本目录下的所有文档皆为旧版本历史归档。它们所涉及的数据库 Schema、API 路由、支付方式、安全架构等描述均已过时废弃，与当前 v1.5.5 事实存在严重冲突。在编写和修改当前代码时，AI 助手和开发人员绝对禁止将本目录下的文档作为参考依据！**

---

## 📁 归档文件说明

为了维护核心文档库的整洁和认知“护城河”，以下类别的历史文档已被移入本目录：

1. **老版 Supabase 数据库与安全机制**：
   - `API_KEY_SECURITY_ARCHITECTURE.md`
   - `DATABASE_SCHEMA_SUPABASE.md`
   - `DATABASE_STRUCTURE_SUPABASE.md`
   - `CREDITS_SYSTEM.md`
   - 这些文档详细描述了旧版基于 Supabase RLS、RPC 和 Supabase Auth 的逻辑。在当前版本下，数据库已被 VPS PostgreSQL 自建 Auth 和 DDL 取代，此部分完全作废。

2. **旧版临时修复与 Cors Fix**：
   - `DEPLOYMENT_CORS_FIX.md`、`SUPABASE_CONNECTION_FIX.md`、`SETTINGS_FIX.md` 等。
   - 这些是在老版本迭代中为了解决特定临时故障而留下的脚本说明，其事实早已整合进代码库。

3. **旧版 docs 引导页及 plans 历史**：
   - `README.md`（旧 docs 总控）
   - `plans.md`、`implement.md`、`status.md`、`validation.md` 等历史步骤记录。

## 🚫 AI 行为守则

当 AI 助手执行 `grep` 搜索或查找相关 API 与 Schema 规范时，如果匹配到了本目录中的文件：
- **必须无视本目录中的匹配结果**；
- 必须回退并查找 [docs/architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md)、[docs/architecture/DATABASE_STRUCTURE.md](../architecture/DATABASE_STRUCTURE.md) 以及顶层 [AGENTS.md](../../AGENTS.md) 中的最新规范；
- 绝不能依据本目录中的 SQL 样例、Supabase rpc 调用或 pg_cron 设置来修改当前的业务层代码。
