Status: historical

# Change Proposal: expand-ai-site-capabilities

## Motivation

KK Studio 已经具备统一的 ToolRegistry、CanvasRuntimeState、DurableGenerationQueue 和可审计执行控制面，但当前 Agent 能力仍主要集中在画布、生成、资源打包与旧 `ui.*` 入口。项目切换、工作区状态、历史、偏好、导出能力和账户只读摘要没有统一的类型化领域边界，Planner 也无法稳定完成“打开项目到下载原图”的全旅程。

## Outcome

- 用领域工具覆盖 `navigation.*`、`workspace.*`、`project.*`、`canvas.*`、`generation.*`、`assets.*`、`export.*`、`history.*` 和 `preferences.*`。
- 账户与计费仅提供脱敏只读摘要；充值、支付确认、余额修改与密钥操作不进入自治工具集。
- 项目、历史、偏好和资源读取通过 `AssistantExecutionContext` 的实时类型化端口调用业务能力，不模拟按钮点击或 CSS selector。
- 固定验收旅程能够从项目打开、上下文读取、确认计划，经过持久生成队列和画布导入/排版，最终验证失败项并生成原图 ZIP。
- 刷新、页面切换和助手折叠继续复用同一个 DurableGenerationQueue 与 AgentRunStore，不创建第二套任务状态，也不重复提交已具有相同幂等键的生成任务。
- 生成 UI/业务能力覆盖矩阵，明确哪些能力允许自治、哪些需要确认、哪些仅属于本地 UI、哪些禁止自治。

## Scope

本变更覆盖 Web Assistant 执行上下文、ToolRegistry 领域工具、Planner 白名单与本地规划器、ChatSidebar 到 CanvasContext 的类型化宿主端口、固定旅程测试、能力矩阵和阶段交接文档。

## Non-goals

- 不为菜单开关、面板折叠、筛选标签和拖拽位置等纯 UI 状态创建 Agent 工具。
- 不新增第二套助手、Queue、Run Store、画布状态或项目状态。
- 不在本阶段重做工作台视觉系统；视觉与 TaskCenter 重构留给 `modernize-ai-first-workspace-ui`。
- 不开放账户写入、支付、充值、密钥、数据库或 Shell 能力。

## Compatibility

保留 `ui.navigateToSurface`、`openSettings`、`zipOutputs`、`startBatchGeneration` 等旧名称作为兼容别名；新计划优先使用领域名称。`generation.createBatchJob`、`assets.zipOriginals` 和 `CanvasRuntimeState` 保持稳定。
