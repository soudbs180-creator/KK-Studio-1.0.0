# AI Assistant Runbooks — KK Studio v1.6.0

Last updated: 2026-07-19
Primary rules: `AGENTS.md`  
Detailed roadmap: `docs/ai-assistant/AI_ASSISTANT_ROADMAP.md`

## Source evidence

- ZIP originals tool: `apps/web/src/features/assets/zipOutputs.ts`
- Batch generate tool: `apps/web/src/hooks/useImageGeneration.ts`
- Arrange cards: `apps/web/src/context/canvasAutoArrange.ts`

---

## 0. Runbook 使用规则

Runbook 是给 AI 助手、Codex、Claude、Cursor、Antigravity 和人工开发者共同使用的可执行流程手册。

每个 Runbook 必须包含：

```text
Trigger        用户如何表达
Preconditions 需要哪些上下文、权限、数据
Tools          使用哪些 ToolRegistry 工具
Steps          严格步骤
Safety         权限、确认、脱敏、成本、禁止事项
Validation     如何验证
Knowledge      完成后更新哪些知识文件
```

新增 Tool、修改 Flow、修改 UI 入口、修改画布状态结构、修改批量生成或下载逻辑时，必须同步更新本文件或拆分到 `docs/ai-assistant/skills/*.md`。

所有确认型步骤都必须使用用户看到的预览快照：授权精确绑定 owner、Run、Plan、Step、输入、幂等键、页面、项目、画布、选区、模型与可变配置摘要。Run 状态、恢复流程或父工作流不能扩展该范围；执行前范围发生变化时必须重新确认。

---

## 1. Runbook: download-selected-originals

### Trigger

```text
下载选择的卡片
把这些图打包
下载我框选的图片
下载当前选区原图
把这些卡片的原图导出
```

### Preconditions

- 已存在 `CanvasRuntimeState`。
- 当前画布有 `activeCanvasId`。
- 当前选区可从 `selectedNodeIds` 读取。
- `GeneratedImage` 可能包含 `originalUrl`、`apiResultUrl`、`url`、`storageId`。

### Tools

```text
canvas.getState
canvas.getSelectedNodes
assets.resolveOriginals
assets.zipOriginals
knowledge.recordChange
```

### Steps

```text
1. 调用 canvas.getState 获取 CanvasRuntimeState。
2. 读取 selection.selectedNodeIds，并把去重后的 ID 冻结到确认预览和 `assets.zipOriginals` 输入。
3. 调用 canvas.getSelectedNodes 获取选区 Prompt 与 Image 节点。
4. 对 Image 节点直接加入下载列表。
5. 对 Prompt 节点解析 childImageIds 并加入下载列表。
6. 同时选中 Prompt 与其子图时按 image node id 去重。
7. 对每张图调用 assets.resolveOriginals。
8. 按 originalUrl -> apiResultUrl -> url -> storageId -> failedItems 解析原图。
9. 用户确认冻结范围后，调用 assets.zipOriginals 生成 ZIP；执行时不得替换为新的实时选区。
10. ZIP 内写入 manifest.json。
11. 返回下载结果。
```

### Safety

- `assets.zipOriginals` 属于 `confirm`；下载会产生本地文件副作用，必须展示数量、范围和失败处理，并绑定冻结选区。
- 范围不明确时默认当前选区。
- 没有选区且用户未指定范围时，不自动下载整个画布。
- ZIP manifest 不写入密钥、完整用户隐私、完整 base64。

### Validation

必须覆盖：

```text
tests/unit/zip-selected-originals.test.ts
```

测试点：

- 只选 Image 节点 -> 下载该图。
- 只选 Prompt 节点 -> 下载子图。
- 同时选 Prompt 与子图 -> 去重。
- 优先使用 originalUrl。
- url / storageId fallback 正确。
- 无可下载图片时明确报错。
- failedItems 写入 manifest。

### Knowledge Updates

更新：

```text
docs/ai-assistant/flow-map.md
docs/ai-assistant/tool-registry.md
docs/ai-assistant/skills.md
docs/ai-assistant/session-memory.md
```

---

## 2. Runbook: batch-generate-to-canvas

### Trigger

```text
批量生成 30 张头像
批量生成商品主图并整理成卡片组
对这个文件夹每张图都生成一张图
帮我把这个文件夹里面的图片全部修改成紧凑的排版布局，比例改成4:5
把这些 prompt 都跑一遍
```

### Preconditions

- 用户明确要求生成 / 出图 / 跑图 / 执行。
- 已获取模型、尺寸、比例、数量、参考图范围。
- 涉及上传、扣积分、批量生成时必须确认。

### Tools

```text
canvas.getState
generation.createBatchJob
ecommerce.createBatchTransformJob
generation.getJobStatus
generation.pauseJob
generation.resumeJob
generation.retryJob
generation.cancelJob
canvas.createPromptCards
canvas.arrangeNodes
knowledge.recordChange
```

### Steps

```text
1. IntentGate 识别批量生成意图。
2. 提取 `taskDomain`、`aspectRatio`、`layoutPreset` 和 `outputGroup`。
3. Planner 输出 BatchGenerationPlan。
4. 计算成本、数量、上传范围、模型和比例。
5. 对电商/商品图批量转换调用 `ecommerce.createBatchTransformJob`；通用批量调用 `generation.createBatchJob`。
6. ConfirmationPolicy 展示确认卡。
7. 用户确认后写入 DurableGenerationQueue。
8. DurableGenerationQueue 写入 idempotencyKey 和 outputGroup。
9. 按 defaultConcurrency=3 执行，最大不超过 maxConcurrency=8。
10. 每个 item 创建 queued PromptNode，并记录 promptNodeId。
11. 调用现有 useImageGeneration / executeGeneration 路径，不复制生成 API。
12. 成功后保存 originalUrl / storageId。
13. 创建 Image 节点并关联 Prompt，记录 resultImageNodeIds。
14. 执行 `canvas.arrangeNodes({ nodeIds, preset })`，只整理本 job 节点。
15. 创建或更新一个 `CanvasGroup`，默认 `color: '#ffffff'`。
16. 打 automation 和 batch:<jobId> tag。
17. 若部分子项失败且用户要求重试，先由 AgentRuntime 在当前 owner 的 Queue 中把相对语义解析为具体 Job，再把 `jobId`、Job `updatedAt` 与可重试 failed Prompt ID 集合冻结到确认计划。`generation.retryJob` 只接受该快照；目标变化时要求重新预览，不重选其他任务。
18. 写入 ToolCallLog、AgentRunRecord、KnowledgeSync。
```

### Safety

- 批量生成是 `confirm`。
- 恢复和重试可能继续消耗 Provider 配额或积分，属于 `confirm`；取消不可撤销，也属于 `confirm`。
- 暂停是可恢复的局部队列控制，可作为 `safe` 执行；执行后仍必须验证 Job 的实时 `paused` 状态。
- 上传文件是 `confirm`。
- 大批量、覆盖、清空旧结果是 `dangerous`。
- 不允许循环模拟输入框逐条发送。
- 不允许绕过积分或成本确认。

### Default Limits

```text
defaultConcurrency = 3
maxConcurrency = 8
maxBatchSize = 100
retryAttempts = 3
retryBackoffMs = 2000
requireIdempotencyKey = true
```

### Layout And Group Defaults

```text
compact-grid -> layout=grid, columns=min(4,count), gap=24
outputGroup.color = '#ffffff'
outputGroup.includePromptNodes = true
outputGroup.tags includes automation and batch:<jobId>
```

“文件夹里面的图片”当前默认指已导入资源池或图片集合。未来接本地目录选择器时，必须新增文件系统权限确认，不得让 LLM 直接读取任意本地目录。

### Validation

必须覆盖：

```text
tests/unit/durable-generation-queue.test.ts
tests/unit/generation-batch-idempotency.test.ts
tests/unit/ai-takeover-intentGate.test.ts
tests/unit/ai-assistant-tool-registry.test.ts
tests/unit/canvas-runtime-state-builder.test.ts
```

验证：

- 幂等 key 防重复。
- 失败重试。
- 暂停 / 恢复。
- `outputGroup` 持久化。
- `promptNodeId` 和结果图片节点写入。
- 结果自动目标布局。
- tag 写入和一个 job 一个分组。
- 中断后可恢复。

### Knowledge Updates

更新：

```text
docs/ai-assistant/flow-map.md
docs/ai-assistant/tool-registry.md
docs/ai-assistant/skills.md
docs/development/session-handoff.md
```

---

## 3. Runbook: arrange-selected-cards

### Trigger

```text
整理一下
把这些卡片排整齐
把当前画布整理一下
整理我选中的卡片
```

### Preconditions

- 有 CanvasRuntimeState。
- 能读取选区、Prompt 子图、组、当前画布。

### Tools

```text
canvas.getState
canvas.getSelectedNodes
canvas.arrangeNodes
knowledge.recordChange
```

### Steps

```text
1. 读取当前选区。
2. 如果 selectedNodeIds 非空，只整理选区。
3. 如果选中单个 Prompt 且有子图，调用 arrangeSingleSelectedPromptChildren。
4. 如果选中多个组或多张卡片，调用 arrangeSelectedGroupedNodes 或 arrangeSelectedRootNodes。
5. 如果无选区且用户明确说当前画布，调用 resolveCanvasAutoArrangePositions。
6. 自动化批量输出使用 automation 轨道。
7. 保留用户手动创作区，不随机堆叠。
```

### Safety

- 非破坏性整理属于 `safe`。
- 覆盖用户手动布局、删除节点、清空画布属于 `dangerous`。

### Validation

- 选区存在时不影响选区外节点。
- Prompt 子图排列正确。
- 自动化轨道不混入手动创作区。
- 画布级整理需要明确范围。

### Knowledge Updates

UI 或布局算法变化时更新：

```text
docs/ai-assistant/ui-map.md
docs/ai-assistant/flow-map.md
```

---

## 4. Runbook: optimize-prompt-without-generation

### Trigger

```text
优化提示词
润色 prompt
帮我写提示词
把这个提示词变专业
```

### Preconditions

- 用户没有明确要求“生成 / 出图 / 跑图 / 发送 / 执行”。

### Tools

```text
prompt.optimizeInput
fillInputPrompt
knowledge.recordChange
```

### Steps

```text
1. IntentGate 判断为 prompt optimization。
2. 不调用 generation 工具。
3. 输出优化后的 prompt 文本。
4. 如用户要求填入输入框，调用 fillInputPrompt。
5. 如用户继续说“发送 / 生成”，再进入生成流程。
```

### Safety

- 不扣积分。
- 不上传文件。
- 不调用 Provider 生成图片。

### Validation

- “优化提示词”不会触发生成。
- “优化并发送”才触发 submit / generation。

---

## 5. Runbook: add-new-agent-tool

### Trigger

```text
新增一个助手能力
让 AI 能执行某个项目动作
把这个 action 接入 ToolRegistry
```

### Preconditions

- 已确认现有能力是否存在。
- 已确认该工具属于 safe / confirm / dangerous / forbidden。
- 已确认对应模块归属。

### Tools

```text
knowledge.searchProject
knowledge.recordChange
skills.upsertSkill
ui.recordLayoutChange
```

### Steps

```text
1. 搜索现有 ai-takeover、CanvasContext、services、assets、generation 能力。
2. 不重复造轮子。
3. 定义 AgentToolDefinition。
4. 编写 inputSchema / outputSchema。
5. handler 只调用已有项目能力或最小新增能力。
6. 添加 ToolCallLog。
7. 加入 PermissionPolicy。
8. 如 legacy action 仍存在，添加 actionToToolCall 兼容映射。
9. 新增或更新测试。
10. 更新 tool-registry、flow-map、skills。
```

### Safety

- 任何读取密钥、改账务、绕过权限的工具标记为 `forbidden`。
- 任何扣积分、上传文件、覆盖输出的工具必须 `confirm`。
- 删除、清空、发布、部署为 `dangerous`。

### Validation

```text
tests/unit/ai-assistant-tool-registry.test.ts
```

测试：重复工具名、权限拦截、schema 验证、审计日志、legacy 映射。

---

## 6. Runbook: update-ui-map-after-layout-change

### Trigger

```text
改了按钮位置
移动了 AI 面板
改了画布入口
改了工具栏
```

### Preconditions

- UI 入口、按钮、面板、选择器或画布坐标系发生变化。

### Tools

```text
ui.recordLayoutChange
knowledge.recordChange
skills.upsertSkill
```

### Steps

```text
1. 修改 UI 代码。
2. 同步更新 selector / action handler。
3. 更新 docs/ai-assistant/ui-map.md。
4. 更新相关 flow-map。
5. 更新测试 selector。
6. 如用户可见入口变化，更新帮助文案。
```

### Safety

- 不允许只改 UI 不改助手知识。
- 不允许让 Agent 继续使用旧按钮、旧 selector、旧坐标系。

### Validation

- UI 测试 / 冒烟测试能找到新入口。
- Agent 执行计划引用新入口或新工具。

---

## 7. Runbook: recover-interrupted-agent-task

### Trigger

```text
继续上次任务
刚才中断了，接着做
恢复未完成的批量任务
```

### Preconditions

- 存在 AgentRunRecord、GenerationBatchJob、taskPersistence 或 session-handoff。

### Tools

```text
generation.getJobStatus
generation.resumeJob
generation.retryJob
canvas.getState
knowledge.searchProject
knowledge.recordChange
```

### Steps

```text
1. 读取 pending AgentRunRecord。
2. 读取 pending GenerationBatchJob。
3. 读取 taskPersistence pending / processing tasks。
4. 重建 CanvasRuntimeState。
5. 对比画布节点与 job item 状态。
6. 只读状态检查可自动恢复；不得从持久 Run 状态合成确认授权。
7. 暂停状态的任务只有在用户确认明确 Job、未完成项和后续费用后，才调用 `generation.resumeJob`。
8. 若任务已结束但存在 failed 子项，用户确认后调用 `generation.retryJob` 只重试失败项；恢复语境中没有明确 jobId 时，必须在确认预览生成前解析并冻结具体 Job/版本/失败项集合，禁止把 latest/current 动态选择器写入 Pending Run。
9. Runtime 内部补偿只能依据已开始步骤的 recovery ledger 与幂等键精确取消对应 Durable Job，不得签发或接受通用 `runtime-recovery` grant。
10. 涉及扣积分、上传、覆盖、删除或取消的操作重新确认。
11. 写入新的 handoff。
```

### Safety

- 不重复扣积分。
- 不重复提交已完成生成。
- 使用 idempotencyKey 去重。
- 不自动执行危险操作。
- 账号、画布、选区、模型或配置在预览后改变时停止恢复并要求重新确认。

### Validation

- 页面刷新后 pending job 可恢复。
- 网络恢复后 processing task 可继续。
- 部分失败可重试，已完成项不重复。

---

## 8. Runbook: security-sensitive-change

### Trigger

```text
修 CORS
修 JWT
修密钥
修积分
修 Stripe Webhook
改 Provider 调用
改生成接口
```

### Preconditions

- 已读取 `docs/governance/SECURITY_AND_BACKLOG.md`。
- 已确认当前事实是 `services/api/` Express / VPS。
- 严禁引入已废弃的旧部署与支付逻辑，仅以当前 `services/api/` 后端为准。

### Steps

```text
1. 搜索现有实现与测试。
2. 标记风险等级。
3. 先写或更新测试。
4. 小步修改。
5. 不使用硬编码 fallback。
6. 不输出真实密钥。
7. 运行 governance:security、typecheck、相关测试。
8. 更新 validation / handoff。
```

### Validation

至少运行：

```bash
npm run governance:security
npm run typecheck
npm run check:encoding
```

涉及代码时补充相关单测 / 集成测试。
