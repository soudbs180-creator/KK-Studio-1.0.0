# 批量重绘生图 Skill (batch-generate-to-canvas)

- **触发词**: “批量生成 30 张商品主图，整理成卡片组”
- **前置条件**: 用户在接管菜单连接了包含多张参考图的文件夹。
- **调用工具**:
  - `generation.createBatchJob`
  - `canvas.arrangeNodes`
  - `generation.pauseJob`
  - `generation.resumeJob`
  - `generation.cancelJob`
- **执行步骤**:
  1. 获取 `assetsSummary` 中已导入文件夹内的图片列表。
  2. 生成 `BatchGenerationPlan`，配置参考图连接和生图参数。
  3. 计算积分估计，将 `requiresConfirmation` 置为 `true`。
  4. 用户确认后，将任务加入持久化队列。
  5. 轮询并驱动任务，每次生成成功后在画布上建立 ImageNode 并连接至 Prompt 节点。
  6. 自动调用 `canvas.arrangeNodes` 对生成的卡片组进行 grid 布局整理。
  7. 为这批卡片自动打上 `automation` 和 `batch:<jobId>` 标签。

## ⚙️ 任务控制机制 (Queue Controls)
- **暂停 (Pause)**: 调用 `generation.pauseJob(jobId)` 挂起任务，重置正在运行的子任务为 `queued`，暂不占用并发配额。
- **恢复 (Resume)**: 调用 `generation.resumeJob(jobId)` 将任务状态改回 `queued`，自动触发队列调度恢复处理。
- **取消 (Cancel)**: 调用 `generation.cancelJob(jobId)` 取消任务，处于排队或运行中的子任务全部标记为 `failed` 且原因为用户取消。

## 🛠️ 实现规约与规则
- **限速与并发**: 批量任务默认并发配额为 `3`，最大并发为 `8`。每个 batch 最大容量限制为 `100`。
- **幂等防护**: `generation.createBatchJob` 必须支持幂等密钥 `idempotencyKey`，如果用户未传入则根据 `canvasId` 和参数哈希计算稳定 Key，防止网络波动重复提交。

## 🧪 测试覆盖
- 单元测试: `tests/unit/durable-generation-queue.test.ts`
