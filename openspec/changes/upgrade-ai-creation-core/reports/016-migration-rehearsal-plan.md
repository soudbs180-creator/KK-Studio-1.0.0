# 016 迁移受控 PostgreSQL 演练计划

> Status: planned / ready to execute
> Related OpenSpec: `upgrade-ai-creation-core` Phase 0
> Migration file: `migrations/016_ai_assistant_user_scope.sql`
> Last updated: 2026-07-21

---

## 1. 目标

在隔离的 PostgreSQL 环境中演练 `migrations/016_ai_assistant_user_scope.sql`，验证：
1. 幂等性：多次执行不产生错误或数据损坏。
2. 兼容性：从 001 到 015 按序迁移后执行 016 成功。
3. 约束正确性：`user_id` 和 `owner_scope` 最终非空，索引生效。
4. 旧数据策略：无 `user_id` 的历史记录被正确标记为 `legacy`。
5. 回滚能力：演练后可快速重置环境。

---

## 2. 前提条件

- PostgreSQL 14+ 实例（建议与生产同大版本）。
- 可创建独立数据库的权限（如 `kkstudio_016_rehearsal`）。
- `psql` 或等效客户端。
- 已配置 `DATABASE_URL` 环境变量指向演练数据库。
- 数据库中**无真实生产数据**。

---

## 3. 演练步骤

### 3.1 创建隔离数据库

```bash
psql -U postgres -c "CREATE DATABASE kkstudio_016_rehearsal;"
export DATABASE_URL="postgres://postgres:****@localhost:5432/kkstudio_016_rehearsal"
```

### 3.2 按序执行 001–015 迁移

```bash
for f in migrations/001_*.sql migrations/002_*.sql ... migrations/015_*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

> 注意：001–015 也需要按 `NNN_*.sql` 的字典序执行，确保表结构已存在。

### 3.3 注入模拟历史数据

在 `016` 之前插入若干没有 `user_id` / `owner_scope` 的测试行，模拟真实历史数据：

```sql
INSERT INTO public.agent_runs (run_id, status, plan, created_at, updated_at)
VALUES ('run-legacy-001', 'completed', '{}', now(), now());

INSERT INTO public.knowledge_documents (id, content, created_at, updated_at)
VALUES ('doc-legacy-001', 'legacy doc', now(), now());

INSERT INTO public.agent_skills (id, name, definition, created_at, updated_at)
VALUES ('skill-legacy-001', 'legacy skill', '{}', now(), now());
```

### 3.4 执行 016 迁移

```bash
psql "$DATABASE_URL" -f migrations/016_ai_assistant_user_scope.sql
```

### 3.5 验证幂等性：再次执行

```bash
psql "$DATABASE_URL" -f migrations/016_ai_assistant_user_scope.sql
```

两次执行都应返回 `COMMIT` 且无错误。

### 3.6 验证数据约束

```sql
-- 所有旧数据必须被标记为 legacy
SELECT count(*) FROM public.agent_runs WHERE user_id = 'legacy';
SELECT count(*) FROM public.knowledge_documents WHERE owner_scope = 'legacy';
SELECT count(*) FROM public.agent_skills WHERE owner_scope = 'legacy';

-- 所有 user_id 必须非空
SELECT count(*) FROM public.agent_runs WHERE user_id IS NULL;
-- 期望 0

-- 索引存在
SELECT indexname FROM pg_indexes WHERE tablename = 'agent_runs';
-- 期望包含 agent_runs_user_updated_idx

-- 列类型检查（timestamptz 转换）
SELECT data_type FROM information_schema.columns
WHERE table_name = 'agent_runs' AND column_name = 'created_at';
-- 期望 timestamptz
```

---

## 4. 回滚/重置

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS kkstudio_016_rehearsal;"
```

---

## 5. 验收标准

- [ ] 001–015 按序执行无错误。
- [ ] 016 首次执行成功。
- [ ] 016 第二次执行成功（幂等）。
- [ ] 旧 `agent_runs`、`knowledge_documents`、`agent_skills` 记录被标记为 `legacy`。
- [ ] `user_id` 列无 NULL，`owner_scope` 列无 NULL。
- [ ] `agent_runs_user_updated_idx` 索引存在。
- [ ] 时区列从 `timestamp without time zone` 升级到 `timestamptz`（若原类型为无时区）。

---

## 6. 环境说明

> 本演练需要真实 PostgreSQL 环境。当前开发/AI 会话环境未安装 `psql`，也未连接可写数据库实例，因此无法在此自动执行。
> 本计划文件作为执行脚本，请在受控 PostgreSQL 环境中按步骤运行，并将结果记录到本目录下同名 `.result.md` 文件。

---

## 7. 建议自动化

完成首次演练后，建议将本计划固化为：

```bash
scripts/ci/rehearse-migration-016.sh
```

接入 CI  nightly，每次变更迁移文件时自动运行，防止幂等性回归。
