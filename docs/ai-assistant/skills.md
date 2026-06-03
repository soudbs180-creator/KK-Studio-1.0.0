# Agent 可执行手册 (Skills)

本文件归档了 AI 助手在执行任务时的标准流程手册 (Runbooks)。

---

## 1. 批量重绘生图 Skill (batch-generate-to-canvas)

- **触发词**: “批量生成 30 张商品主图，整理成卡片组”
- **前置条件**: 用户在接管菜单连结了包含多张参考图的文件夹。
- **调用工具**:
  - `generation.createBatchJob`
  - `canvas.arrangeNodes`
- **执行步骤**:
  1. 获取 `assetsSummary` 中已导入文件夹内的图片列表。
  2. 生成 `BatchGenerationPlan`，配置参考图连结和生图参数。
  3. 计算积分估计，将 `requiresConfirmation` 置为 `true`。
  4. 用户确认后，将任务加入持久化队列。
  5. 轮询并驱动任务，每次生成成功后在画布上建立 ImageNode 并连结至 Prompt 节点。
  6. 自动调用 `canvas.arrangeNodes` 对生成的卡片组进行 grid 布局整理。
  7. 为这批卡片打上 `automation` 和 `batch:jobId` 标签。
- **任务控制机制 (Queue Controls)**:
  - **暂停 (Pause)**: 调用 `generation.pauseJob(jobId)` 挂起任务，重置正在运行的子任务为 `queued`，暂不占用并发配额。
  - **恢复 (Resume)**: 调用 `generation.resumeJob(jobId)` 将任务状态改回 `queued`，自动触发队列调度恢复处理。
  - **取消 (Cancel)**: 调用 `generation.cancelJob(jobId)` 取消任务，处于排队或运行中的子任务全部标记为 `failed` 且原因为用户取消。

---

## 2. 框选原图打包 Skill (download-selected-originals)

- **触发词**: “下载选择的卡片” / “打包我框选的图片”
- **前置条件**: 画布处于框选状态且有选中的卡片。
- **调用工具**:
  - `assets.zipOriginals`
- **执行步骤**:
  1. 通过 `CanvasRuntimeState` 获取选中的 `selectedNodeIds`。
  2. 如果 `selectedNodeIds` 为空，明确报错“当前没有选中的卡片，请在画布上进行选择”。
  3. 识别节点类型，如果包含 PromptNode，则将其子图像节点 `childImageIds` 全部收集。
  4. 调用原图解析引擎，按照 `originalUrl -> apiResultUrl -> url -> storageId (IndexedDB)` 优先级依次尝试拉取。
  5. 打包成功的文件存入 ZIP，失败的文件归档在 `failedItems` 并写入 `manifest.json`。
  6. 触发浏览器保存下载。
## 3. Implementation update - 2026-06-03

- Implementation files: `apps/web/src/features/assets/resolveOriginalAssets.ts`, `apps/web/src/features/assets/zipOutputs.ts`, and `apps/web/src/features/ai-takeover/core/toolRegistry.ts`.
- Scope rule: `selected_cards` uses the current `selectedNodeIds`; it never expands to all canvases or all images.
- Prompt rule: selected Prompt cards expand to child images by `childImageIds` and `parentPromptId`, then de-dupe by image node id.
- Source priority: `originalUrl -> apiResultUrl -> url -> storageId -> localFile`.
- ZIP rule: always include `manifest.json`; if all downloads fail, return a manifest-only archive with `failedItems`.
- Test coverage: `tests/unit/zip-selected-originals.test.ts`.

## 4. Implementation update - durable batch queue - 2026-06-03

- Implementation file: `apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts`.
- Queue limits: `maxBatchSize=100`, default concurrency `3`, max concurrency `8`, retry attempts `3` after the initial attempt, retry backoff `2000ms`.
- Idempotency rule: `generation.createBatchJob` may pass an explicit `idempotencyKey`; otherwise the queue derives a stable key from `canvasId`, prompts, and options.
- Node/test safety: queue import does not touch `localStorage` unless browser storage is available.
- Test coverage: `tests/unit/durable-generation-queue.test.ts`.

## 5. Implementation update - KnowledgeSync projection - 2026-06-03

- Implementation file: `apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts`.
- Tools: `knowledge.searchProject`, `knowledge.recordChange`, `ui.recordLayoutChange`, `skills.upsertSkill`, and `assets.resolveOriginals`.
- Safety: only redacted summaries are recorded; browser `localStorage` is a projection/cache, not authoritative long-term storage.
- Required after assistant, UI, canvas, generation, download, or queue changes: call or manually mirror `knowledge.recordChange`, update `docs/ai-assistant/*`, and record validation in `docs/development/session-handoff.md`.
- Test coverage: `tests/unit/agent-knowledge-sync.test.ts` and `tests/unit/ai-assistant-tool-registry.test.ts`.

---

## 6. 单图绘图 Skill (generation.start)

- **触发词**: “生成一张可爱的猫咪图片”
- **前置条件**: 用户指定了绘图的主体。
- **调用工具**:
  - `generation.start`
- **执行步骤**:
  1. 通过输入提取出提示词和生成数量。
  2. 调用 `generation.start` 工具，提交任务。
