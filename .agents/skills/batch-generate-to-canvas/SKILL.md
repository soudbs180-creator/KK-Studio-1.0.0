Status: reference

---
name: batch-generate-to-canvas
description: 批量图片、视频与音频生成及队列控制技能，支持电商紧凑排版、图生视频、异步调度、暂停、恢复、取消和失败子项重试。
---

# 批量重绘生图 Skill (batch-generate-to-canvas)

- **触发词**: “批量生成 30 张商品主图，整理成卡片组” / “帮我把这个文件夹里面的图片全部修改成紧凑的排版布局，比例改成4:5”
- **前置条件**: 用户已导入包含多张参考图的资源池图片或图片集合；连接本地目录选择器时必须先走文件系统权限确认。
- **调用工具**:
  - `generation.createBatchJob`
  - `generation.createVideoJob`
  - `generation.createAudioJob`
  - `ecommerce.createBatchTransformJob`
  - `canvas.arrangeNodes`
  - `generation.pauseJob`
  - `generation.resumeJob`
  - `generation.retryJob`
  - `generation.cancelJob`
- **执行步骤**:
  1. 获取 `assetsSummary` 中已导入文件夹内的图片列表。
  2. 生成 `BatchGenerationPlan`，配置参考图连接、生图参数、`taskDomain`、`aspectRatio`、`layoutPreset` 和 `outputGroup`。
  3. 计算积分估计，将 `requiresConfirmation` 置为 `true`。
  4. 电商/商品图批量转换调用 `ecommerce.createBatchTransformJob`；通用批量调用 `generation.createBatchJob`。
  5. 用户确认后，将任务加入持久化队列。
  6. 轮询并驱动任务，每次生成成功后记录 `promptNodeId`、在画布上建立 ImageNode 并连接至 Prompt 节点。
  7. 自动调用 `canvas.arrangeNodes({ nodeIds, preset })`，只整理本 job 生成的节点。
  8. 创建或更新一个 `CanvasGroup`，默认 `color:'#ffffff'`，包含本会话/job 的 Prompt 与 Image 卡片。
  9. 为这批卡片自动打上 `automation` 和 `batch:<jobId>` 标签。
  10. 图生视频直接调用 `generation.createVideoJob`，传入 `referenceImageNodeId`、`durationSeconds`、`resolution`、`motion` 等显式参数；不得依赖 UI 模式切换后的 React 状态。
  11. 音频生成直接调用 `generation.createAudioJob`，统一进入 `DurableGenerationQueue`，不得绕过队列直连 Provider。

## ⚙️ 任务控制机制 (Queue Controls)
- **暂停 (Pause)**: 调用 `generation.pauseJob(jobId)` 挂起任务，重置正在运行的子任务为 `queued`，暂不占用并发配额。
- **恢复 (Resume)**: 调用 `generation.resumeJob(jobId)` 将任务状态改回 `queued`，自动触发队列调度恢复处理；未完成项可能继续消耗 Provider 配额或积分，必须先确认。
- **重试失败项 (Retry failed)**: `generation.retryJob` 只把冻结 Job 中的失败子项重置为 `queued`，不重复提交已完成的 Prompt/Image 输出。若用户只说“重试最近失败批次”，AgentRuntime 必须在确认卡出现前解析具体 `jobId`，同时冻结 Job `updatedAt` 与可重试 Prompt ID 集合；执行层不接受动态 latest/current selector。重试会再次产生 Provider 调用，必须先确认。
- **取消 (Cancel)**: 调用 `generation.cancelJob(jobId)` 取消任务，Job 进入 `cancelled`；处于排队或运行中的子任务标记为不可重试的 `failed/cancelled`。取消不可撤销，必须绑定明确 Job 并先确认。

## 🛠️ 实现规约与规则
- **限速与并发**: 图片默认并发 `3`、最大 `8`、批量上限 `100`；视频默认 `1`、最大 `2`、批量上限 `20`；音频默认 `2`、最大 `4`、批量上限 `50`。
- **确认授权**: `generation.createBatchJob`、`ecommerce.createBatchTransformJob`、`generation.createVideoJob`、`generation.createAudioJob`、`generation.resumeJob`、`generation.retryJob` 与 `generation.cancelJob` 都是有效权限为 `confirm` 的工具。授权必须精确绑定 owner、Run、Plan、Step、Job/输入、画布、选区、模型和配置快照；`generation.pauseJob` 是可恢复的 `safe` 局部控制。
- **能力声明**: 视频/音频参数必须根据 Provider 能力注册表判断，不得通过模型名称字符串猜测 T2V、I2V、首尾帧、音频或时长能力。
- **执行后验证**: 工具返回后校验任务 `schemaVersion=2`、`taskType`、队列持久化记录和画布输出；验证失败不得写入 Memory 或 KnowledgeStore。
- **队列状态验证**: pause/resume/retry/cancel 必须读取 `DurableGenerationQueue` 的实时 Job 状态；不得用幂等缓存中的旧输出替代领域状态。
- **幂等防护**: `generation.createBatchJob` 必须支持幂等密钥 `idempotencyKey`，如果用户未传入则根据 `canvasId` 和参数哈希计算稳定 Key，防止网络波动重复提交。
- **电商紧凑布局**: `compact-grid` 映射为 `layout='grid'`、`columns=min(4,count)`、`gap=24`，比例从用户指令写入 `aspectRatio`，例如 `4:5`。
- **打组与标签 (Group output)**: 每次批量生成任务完成后，需在画布上创建一个统一的 `CanvasGroup` 包裹住所有的 Prompt/Image 节点，默认边框发光颜色为 `#ffffff`，并为子节点打上 `automation` 标签。

## 🧪 测试覆盖
- 单元测试: `tests/unit/durable-generation-queue.test.ts`
- 统一媒体队列: `tests/unit/unified-media-generation-queue.test.ts`
- 授权与验证: `tests/unit/agent-tool-execution-boundary.test.ts`
- 意图识别: `tests/unit/ai-takeover-intentGate.test.ts`
- 运行态摘要: `tests/unit/canvas-runtime-state-builder.test.ts`
