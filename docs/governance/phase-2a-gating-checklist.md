# Phase 2a 外部门禁检查清单

> 版本：1.0 | 创建：2026-07-24 | 状态：待执行（环境受限）
>
> 本清单不得跳过任何步骤。门禁未通过的，禁止进入 Phase 2b 和 Phase 4-6。本地 Fake/characterization 不得代替真实 PostgreSQL 和浏览器证据。

---

## 0. 前置条件

- [ ] 受控 PostgreSQL 实例可连接（非生产库）
- [ ] `psql` 客户端可用
- [ ] 真实浏览器（Chrome/Edge 最新稳定版）可用
- [ ] 脚本 `scripts/ops/postgres/rehearse-migration-001-019.sh` 可执行
- [ ] 环境变量 `CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE` 默认 `off`
- [ ] 1K 测试媒体素材已准备（图片/视频/音频，覆盖 jpg/png/webp/mp4/mp3/wav）

---

## 1. Migration 演练

### 1.1 空库首次执行

```
KK_MIGRATION_DATABASE_URL="postgresql://..." KK_MIGRATION_REHEARSAL_MODE="fresh" \
  bash scripts/ops/postgres/rehearse-migration-001-019.sh
```

- [ ] 全部 19 个 migration 通过（exit 0）
- [ ] 核心表全部存在：generation_quotes, generation_jobs, generation_job_items, ledger_entries, provider_connections, capability_bindings, asset_lineage_relations, generation_image_worker_leases
- [ ] RLS 策略：3 条（provider_connections, capability_bindings, asset_lineage_relations）
- [ ] capability_bindings 唯一约束：1（user_id, connection_id, model_id, capability_id, channel, request_profile）
- [ ] capability_bindings 外键：1（→ provider_connections ON DELETE CASCADE）

### 1.2 重复执行（幂等性）

同一数据库上再跑一次：

```
KK_MIGRATION_DATABASE_URL="postgresql://..." KK_MIGRATION_REHEARSAL_MODE="repeat" \
  bash scripts/ops/postgres/rehearse-migration-001-019.sh
```

- [ ] 全部 19 个 migration 仍然通过（exit 0），无 "already exists" 以外的错误
- [ ] 表结构、约束、索引数量与首次执行后完全一致
- [ ] `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 不产生新列或重复列

### 1.3 存量数据保留（migration 018 关键验证）

在 populated 模式下（需先有存量数据），验证重复执行 migration 018 后：

- [ ] `provider_connections` 行数不变（包括 `secret_ref` 字段）
- [ ] `capability_bindings` 行数不变（包括 status/constraints_json）
- [ ] `asset_lineage_relations` 行数不变
- [ ] RLS 策略未被删除或重复创建
- [ ] **migration 018/019 数据绝对不得丢失**（禁止以迁移脚本 "修复" 任何数据）

| 验证项 | 预期 | 实际 |
|--------|------|------|
| provider_connections 行数 | 不变 | |
| capability_bindings 行数 | 不变 | |
| asset_lineage_relations 行数 | 不变 | |
| RLS 策略数 | 3 | |
| secret_ref 不为空（若有存量） | 不变 | |

---

## 2. 灰度放量（admission flag）

> **admission flag 与 execution flag 必须分离**。admission 控制新任务准入，execution 控制已准入任务的执行。回滚时先关 admission，execution 保持至 lease drain 完成。

| 阶段 | `CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE` | 预期行为 | 观察窗口 |
|------|----------------------------------------|---------|---------|
| off | `off` | 所有 Connection-backed 生成被拒（404 FEATURE_DISABLED），legacy 路由不变 | ≥ 1h |
| internal | `internal` | 仅 whitelist 用户可提交 Connection-backed 生成，其他用户 404 | ≥ 4h |
| invited | `invited` | invited users 可提交，其他用户 404 | ≥ 24h |
| full | `full` | 所有用户可提交 Connection-backed 生成，legacy 仍并行（双读未切流） | ≥ 48h |
| rollback | `off` | 新任务准入立即关闭，已运行任务执行不中断（lease drain） | 直到 lease 清空 |

### 2.1 每阶段必观察指标（通过 `/v1/metrics` 采集）

| 指标 | 来源 | 说明 |
|------|------|------|
| `generationV3.imageProviderSliceAdmission.allowed` | generationV3Metrics | 准入通过数 |
| `generationV3.imageProviderSliceAdmission.blocked` | generationV3Metrics | 准入拒绝数 |
| `providerConnectionDualRead.selected` | dualRead metrics | 新投影命中数 |
| `providerConnectionDualRead.fallbackNoMatch` | dualRead metrics | 无匹配回退数 |
| `providerConnectionDualRead.fallbackStorageUnavailable` | dualRead metrics | 存储不可用回退数 |
| `providerConnectionDualRead.blockedSecretUnavailable` | dualRead metrics | secret 缺失拒绝数 |

- [ ] off 阶段：blocked > 0, allowed = 0
- [ ] internal 阶段：allowed 仅来自 whitelist
- [ ] invited 阶段：allowed 仅来自 invited + whitelist
- [ ] full 阶段：所有用户 allowed，blocked = 0（无 secret 缺失场景）
- [ ] 每阶段 `fallbackNoMatch` + `fallbackStorageUnavailable` 稳定且不增长

### 2.2 admission / execution flag 分离验证

当前只有一个 flag `CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE` 控制 admission（`assertImageProviderSliceAdmission`）。

- [ ] 确认 `assertImageProviderSliceAdmission` 仅影响 `/v1/generate` 提交路径
- [ ] 确认已入队的 Job（已 `submitted`/`running`）不受 flag 变更影响
- [ ] 执行 `off` 回滚后，已入队 Job 继续运行至完成
- [ ] 回滚后 `blocked` 递增、`allowed` 不变
- [ ] **确认不存在第二个 flag 用于 execution 控制**——如 Phase 2b 需引入，必须在 tasks.md 另立条目

---

## 3. 业务指标验证

### 3.1 核心生命周期

在 `internal` 及以上阶段，用 whitelist 用户完成 3 次完整生成流程：

- [ ] submit (admission 通过 → quote 生成 → job 创建 → item 创建 → lease 分配)
- [ ] poll (lease 状态轮询：queued → leased → running/polling → completed)
- [ ] cancel (cancel_requested_at 写入 → status → cancelled)
- [ ] 每次生成 ledger 正确落账（reserve → charge，状态 committed）

### 3.2 退款与重复结算

- [ ] cancel 后 ledger 出现 refund 条目（type=refund, status=committed）
- [ ] 同一笔 quote 不会产生重复 charge（idempotency_key 去重）
- [ ] 同一 job 执行中切换 flag 不会触发重复结算

### 3.3 计费一致性（provider_connections → generation_quotes → ledger_entries）

- [ ] quote.channel 与 capability_bindings.channel 一致
- [ ] quote.cost_credits / cost_provider_quota 金额正确
- [ ] ledger_entries.amount 与 quote 匹配
- [ ] 所有 status=committed 的 ledger 条目有对应的 quote/item/job 外键

---

## 4. 真实浏览器验证

> 必须使用真实浏览器（非 headless test），验证以下场景。

### 4.1 正常流程

- [ ] 打开 KK Studio Web，登录 whitelist 用户
- [ ] 发起 AI 生成（image），确认提交成功
- [ ] 轮询状态更新正常显示（queued → running → completed）
- [ ] 完成后画布显示生成结果
- [ ] 生成历史可查看（Job 投影正常）

### 4.2 关闭浏览器后恢复

- [ ] 提交一个生成任务
- [ ] 立即关闭浏览器标签页
- [ ] 等待 30 秒以上
- [ ] 重新打开标签页、登录同一用户
- [ ] **SSE 重连成功**，正在运行的 Job 状态自动恢复轮询
- [ ] 已完成的任务在画布/历史中可见

### 4.3 第二设备恢复

- [ ] 在设备 A 上提交生成任务
- [ ] 在设备 B 上登录同一用户
- [ ] 设备 B 上 SSE 连接建立后：
  - [ ] 正在运行的 Job 状态自动投影
  - [ ] 已完成的任务可查看
  - [ ] 不会产生重复的 Job 或重复结算

### 4.4 Session 过期后登录重连

- [ ] 等待 session 自然过期（或手动 revoke）
- [ ] 重新登录后 SSE 恢复
- [ ] 之前提交的 Job 状态继续轮询

---

## 5. 媒体输入 Benchmark

> 目标：1K 真实媒体输入，确认内存和性能不退化。

### 5.1 测试素材

| 类型 | 数量 | 格式 |
|------|------|------|
| 图片 | 500 | jpg (150), png (150), webp (100), gif (50), svg (50) |
| 视频 | 300 | mp4 (200), webm (50), mov (50) |
| 音频 | 200 | mp3 (100), wav (50), ogg (30), m4a (20) |

### 5.2 验证项

- [ ] 所有素材成功上传到浏览器内存（Blob/File）
- [ ] object URL 正确创建并可撤销（无内存泄漏）
- [ ] 上传后 `revokeObjectURL` 调用正常释放
- [ ] 1000 文件顺序上传耗时 < 60s（不含网络传输）
- [ ] 上传过程浏览器内存峰值 < 512MB（超过则记录并分析）
- [ ] 无控制台错误或未捕获异常

### 5.3 性能基线

| 指标 | v1.5 基线 | v1.6 Phase 2a | 变化 |
|------|----------|---------------|------|
| 100 图上传内存峰值 | TBD | | |
| 1000 文件上传耗时 | TBD | | |
| object URL 泄漏数（1000 文件） | TBD | | |
| SSE 重连延迟 | TBD | | |

> 热点 baseline **只能下降不能提高**。

---

## 6. 回滚协议

### 6.1 回滚触发条件

以下任一条件满足即触发回滚：

- [ ] 任一 migration 在真实 PostgreSQL 上失败
- [ ] dual-read metrics `fallback*` 异常增长（> 基线 2x）
- [ ] 真实浏览器任一 SSE/Job 恢复场景失败
- [ ] `blockedSecretUnavailable` > 0（在 full 阶段预期为 0）
- [ ] 重复结算或退款丢失
- [ ] 内存/性能退化

### 6.2 回滚步骤

1. [ ] 🔴 第一步：`CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE=off` — 关闭新任务 admission
2. [ ] 🟡 第二步：等待所有已入队 Job 完成或 lease 过期（`generation_image_worker_leases` 中 status 为 `running`/`polling` 的全部变更为终态）
3. [ ] 🟢 第三步：确认 `generation_image_worker_leases` 无常驻租约，`ledger_entries` 无未提交条目
4. [ ] ⚪ 第四步（可选）：如 Phase 2b 已启动，关闭 `CAPABILITY_GRAPH_VIDEO_AUDIO_WORKER`
5. [ ] 📋 **不得删除 migration 018/019 数据**

### 6.3 回滚验证

- [ ] 关闭 admission 后，新请求返回 404 FEATURE_DISABLED
- [ ] 已运行的 Job 继续执行至完成
- [ ] 所有 ledger 条目正确 closed（退款或结算）
- [ ] legacy 路由继续正常服务
- [ ] `/v1/metrics` 中 `providerConnectionDualRead.enabled` 仍为 true（dual-read 不影响已有数据，关闭 flag 不关闭 metrics）

---

## 7. 门禁签署

| 角色 | 检查项 | 状态 | 签名/备注 |
|------|--------|------|-----------|
| 开发者 | 1. Migration 演练 | | |
| 开发者 | 2. 灰度放量 | | |
| 开发者 | 3. 业务指标 | | |
| 开发者 | 4. 浏览器验证 | | |
| 开发者 | 5. Media Benchmark | | |
| 审核者 | 6. 回滚协议确认 | | |

签署完成后，在 `tasks.md` 中将 Phase 2a 所有门禁项标记为 `[x]`，方可进入 Phase 2b。
