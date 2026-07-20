# AI Assistant Roadmap - Historical Sprint Record - KK Studio v1.6.0

> Status: historical planning record. Do not use unchecked Sprint items,
> legacy tool aliases, or proposed file lists as current implementation facts.
> Current behavior is defined by `tool-registry.md`,
> `site-capability-matrix.md`, `canvas-runtime-state.md`, the source code, and
> active OpenSpec changes. New work belongs in an OpenSpec change rather than
> another parallel roadmap.

Last updated: 2026-06-26  
Primary rules: `AGENTS.md`

## 0. 文档定位

本文件保留 AI 助手 / 画布 Agent 的历史工程路线。`AGENTS.md` 定义最高规则和边界；本文件中的 Sprint、目标文件、类型结构和验收项只用于追溯，不能覆盖当前代码与 active OpenSpec。

Agent 处理以下任务时必须读取本文件：

- `CanvasRuntimeState`
- `ToolRegistry`
- `DurableGenerationQueue`
- 选中卡片原图下载
- 批量生成与自动布局
- 项目知识库 / Skills / Runbooks
- 中断续跑与 Agent 记忆

---

## 0. 最终效果

### 0.1 下载选中卡片原图

```text
用户在画布框选卡片
  -> AI 读取 CanvasRuntimeState
  -> AI 知道当前画布、选区、视口、输入框、最近事件
  -> 用户说“下载选择的卡片”
  -> AI 不模拟点击，不在输入框输入
  -> 直接调用 assets.zipOriginals(selected image nodes)
  -> 打包原图与 manifest.json
  -> 返回下载结果
```

### 0.2 批量生成并自动整理

```text
用户说“批量生成 30 张商品主图，整理成卡片组”
  -> AI 识别批量生成意图
  -> 生成 BatchGenerationPlan
  -> 创建持久化队列任务
  -> 按速率调用生成能力
  -> 保存原图、缩略图、任务日志
  -> 在画布创建卡片
  -> 自动整齐排列并打 batch / automation tag
  -> 记录知识库和 Skills
```

### 0.3 UI 和流程变化保持最新

```text
用户或开发者改了 UI 位置、按钮、面板或流程
  -> 代码变更完成后更新 ui-map / flow-map / tool-registry
  -> 下次 AI 助手知道新入口、新选择器、新流程
  -> Codex / Antigravity 中断后可从 handoff 继续
```

第一阶段不要追求真正微调模型。所谓“像训练出一个小模型”，在本项目里先通过工程系统实现：

```text
项目知识库 + 画布运行态 + 工具调用 + 持久队列 + 记忆 + Skills/Runbooks + 自动验证
```

---

## 1. 当前项目观察

### 1.1 AI 接管雏形

现有基础目录：

```text
apps/web/src/features/ai-takeover/
├── context/AITakeoverContext.tsx
├── core/actionExecutor.ts
├── core/confirmationPolicy.ts
├── core/intentGate.ts
├── core/llmBrain.ts
├── core/localBrain.ts
├── core/projectContextBuilder.ts
├── core/safetyPolicy.ts
└── types.ts
```

已有能力：

1. `IntentGate` 可识别提示词优化、生成、批量文件夹生成、下载、定位卡片、配置引导、发送输入框、切换模式等。
2. `LocalAssistantBrain` 可以用本地规则生成 `AssistantPlan`。
3. `LLMBrain` 可以生成 JSON Plan。
4. `ActionExecutor` 可以执行填充提示词、定位卡片、打开设置、ZIP 下载、开始生成、批量生成、切换模式、提交输入框等动作。
5. `SafetyPolicy` 与 `ConfirmationPolicy` 已具备基础安全拦截和确认层。
6. `ProjectContextBuilder` 已构造脱敏项目上下文，包含画布节点摘要、输入框、资源摘要、错误、配置等。

结论：后续不要另起一套完全独立助手。必须以 `ai-takeover` 为兼容入口，把底层逐步升级为 `AgentRuntime + ToolRegistry + DurableQueue + KnowledgeSync`。

### 1.2 画布能力

关键文件：

```text
apps/web/src/context/CanvasContext.tsx
apps/web/src/context/canvasContextState.ts
apps/web/src/context/canvasAutoArrange.ts
apps/web/src/context/canvasArrangeSelection.ts
apps/web/src/app/useCanvasSelectionBox.ts
apps/web/src/components/canvas/InfiniteCanvas.tsx
apps/web/src/utils/generatedImageLayout.ts
```

已有能力：

1. `CanvasState` 已有 `activeCanvasId`、`selectedNodeIds`、`viewportCenter`、`history`、`canvases`。
2. `CanvasContextType` 已提供添加、更新、删除 Prompt / Image 节点、选择节点、移动选区、排列节点、分组、tag、工作流节点等能力。
3. `InfiniteCanvas` 已暴露实时 transform 和画布矩形能力，可以补齐 viewport。
4. `useCanvasSelectionBox` 已支持框选画布上的 Prompt 和 Image 节点。
5. `resolveCanvasAutoArrangePositions` 已支持标准、错误、电商、PPT、automation 轨道整理。
6. `arrangeSingleSelectedPromptChildren`、`arrangeSelectedGroupedNodes`、`arrangeSelectedRootNodes` 已支持不同选区整理策略。

结论：AI 助手不要模拟 UI。它应该直接调用这些现有画布能力。

### 1.3 资产与下载能力

关键文件：

```text
apps/web/src/features/assets/assetStore.ts
apps/web/src/features/assets/zipOutputs.ts
apps/web/src/services/storage/imageStorage.ts
apps/web/src/types.ts
```

已有能力：

1. `GeneratedImage` 已包含 `url`、`originalUrl`、`apiResultUrl`、`storageId`、`mimeType` 等字段。
2. `assetStore` 已保存导入图片、文件、输出资产、集合摘要。
3. `zipOutputs` 已可打包输出图片并写入 `manifest.json`。

缺口：

1. `zipOutputs` 对 `selected_cards` scope 不完整。
2. 当前下载逻辑没有充分解析 selected Prompt 的子图。
3. 原图优先级需要明确为：`originalUrl -> apiResultUrl -> url -> storageId -> failedItems`。

### 1.4 生成与恢复能力

关键文件：

```text
apps/web/src/hooks/useImageGeneration.ts
apps/web/src/hooks/useTaskRecovery.ts
apps/web/src/services/persistence/taskPersistence.ts
apps/web/src/services/llm/LLMService.ts
server/routes/generate-image.js
```

已有能力：

1. `useImageGeneration` 负责生成执行、保存原图、恢复任务、写入画布图片节点。
2. `useTaskRecovery` 会在页面加载、回前台、网络恢复时恢复 pending / processing 任务。
3. `taskPersistence` 当前以本地任务缓存记录 taskId、taskType、status、prompt、model、resultUrls、resultStorageIds 等。
4. `LLMService` 已有 Provider 能力、密钥路由、用户路由代理、系统代理等复杂逻辑。
5. `server/routes/generate-image.js` 已有服务器端图像生成、积分扣除、限流、失败退款和静态文件落盘逻辑。

落地状态：批量生成队列已完全从旧 React 内存状态升级为 `DurableGenerationQueue`。它作为一个持久化异步生图任务队列，支持断线自动重跑、限制最大并发、并通过 UI 的 TaskCenterTray 允许用户进行暂停/恢复/重试等。

### 1.5 v1.6.0 核心功能落地状态
- **DurableGenerationQueue**：全面落地，负责画布上所有的批量出图和单图异步排队任务，支持基于 idempotencyKey 的防重生成、网络断线自动重试与恢复。
- **TaskCenterTray**：前端任务中心托盘，可视化展示当前的 queued、running、paused、completed 和 failed 任务列表，允许用户实时暂停、恢复、取消或重试。
- **GenerationError & ProviderRouteEngine**：实现错误分级和多模型智能路由引擎，自动适配不同的绘图后端，在 API 异常或额度不足时自动回退，并向用户渲染友好具体的错误信息。
- **research_to_canvas**：用户口头输入研究指令（如“研究咖啡品牌风格”）时，系统自动通过 LocalBrain 推导 `research_to_canvas` 意图，将格式化好的深度研究报告（Research Brief）作为专属节点插入画布，并与其批量生图任务紧密联动。

---

## 2. 总体升级架构

目标链路：

```text
AI Takeover UI
  -> AITakeoverProvider
  -> AgentRuntime
  -> CanvasRuntimeState
  -> KnowledgeRetriever
  -> IntentGate / LLM Planner
  -> ToolRegistry
  -> PermissionPolicy
  -> DurableJobQueue
  -> Canvas / Generation / Assets / Knowledge / Skills Tools
  -> AuditLog + KnowledgeSync + SessionHandoff
```

建议新增目录：

```text
apps/web/src/features/ai-assistant-runtime/
├── index.ts
├── runtime/
├── context/
├── tools/
├── queue/
├── knowledge/
├── memory/
└── __tests__/
```

---

## 3. Sprint 1：CanvasRuntimeState

### 3.1 目标

让 AI 知道用户当前画布状态，而不是只靠对话猜测。

新增：

```text
apps/web/src/features/ai-assistant-runtime/context/buildCanvasRuntimeState.ts
```

核心类型：

```ts
export interface CanvasRuntimeState {
  projectVersion: '1.6.0';
  currentPage: 'canvas' | 'settings' | 'agent' | 'unknown';
  canvas: {
    id: string;
    name: string;
    promptCount: number;
    imageCount: number;
    groupCount: number;
    lastModified?: number;
  };
  viewport: {
    x: number;
    y: number;
    scale: number;
    center: { x: number; y: number };
    rect?: { width: number; height: number };
  };
  selection: {
    selectedNodeIds: string[];
    promptNodeIds: string[];
    imageNodeIds: string[];
    childImageNodeIdsFromSelectedPrompts: string[];
    groupIds: string[];
    count: number;
  };
  selectedNodes: {
    prompts: Array<{
      id: string;
      prompt: string;
      status: 'idle' | 'queued' | 'generating' | 'failed' | 'done';
      childImageIds: string[];
      tags?: string[];
    }>;
    images: Array<{
      id: string;
      parentPromptId?: string;
      urlPresent: boolean;
      originalUrlPresent: boolean;
      apiResultUrlPresent: boolean;
      storageIdPresent: boolean;
      tags?: string[];
    }>;
  };
  promptBarInput?: {
    prompt: string;
    mode: string;
    referenceImagesCount: number;
  };
  recentEvents: Array<{
    id: string;
    type: string;
    targetIds?: string[];
    timestamp: number;
    summary: string;
  }>;
}
```

### 3.2 接入点

修改：

```text
apps/web/src/features/ai-takeover/types.ts
apps/web/src/features/ai-takeover/core/projectContextBuilder.ts
apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx
```

`SanitizedProjectContext` 增加：

```ts
runtime?: CanvasRuntimeState;
```

保持旧字段兼容，不要一次删除 `canvas.selectedNodeIds` 等已有结构。

### 3.3 测试

新增：

```text
tests/unit/canvas-runtime-state-builder.test.ts
```

测试点：

- 选中图片节点时，`selection.imageNodeIds` 正确。
- 选中 Prompt 节点时，能推导其子图 `childImageNodeIdsFromSelectedPrompts`。
- 不暴露敏感凭证、完整 base64、长随机串。
- viewport 从 transform 正确构建。

---

## 4. Sprint 2：ActionExecutor 升级为 ToolRegistry

### 4.1 目标

把现在的 action switch-case 迁移为可声明、可权限控制、可审计、可测试的工具注册表。

新增：

```text
apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts
```

核心结构：

```ts
export type ToolPermission = 'safe' | 'confirm' | 'dangerous' | 'forbidden';

export interface AgentToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  permission: ToolPermission;
  inputSchema: unknown;
  outputSchema: unknown;
  handler: (input: Input, ctx: AgentToolContext) => Promise<Output>;
}
```

第一批工具：

```text
canvas.getState
canvas.getSelectedNodes
canvas.arrangeNodes
canvas.locateNodes
canvas.createPromptCards
assets.resolveOriginals
assets.zipOriginals
generation.createBatchJob
knowledge.recordChange
ui.recordLayoutChange
skills.upsertSkill
```

### 4.2 迁移策略

不要一次删除 `executeAction`。先做兼容层：

```text
AssistantAction
  -> actionToToolCall(action)
  -> ToolRegistry.execute(toolCall)
```

示例：

```text
zipOutputs(selected_cards)
  -> assets.zipOriginals({ scope: 'selected_cards' })

startBatchGeneration(plan)
  -> generation.createBatchJob(plan)

locateCard(keyword)
  -> canvas.locateNodes({ keyword })
```

### 4.3 权限矩阵

| 权限 | 示例 | 是否自动执行 |
|---|---|---|
| `safe` | 读画布状态、定位卡片、整理布局、下载已有图片 | 可以 |
| `confirm` | 单图/批量生成、上传资源、扣积分、覆盖输出 | 必须确认 |
| `dangerous` | 删除、清空、发布、部署、批量替换 | 二次确认 |
| `forbidden` | 凭证、支付、账务等高敏操作 | 永远禁止 |

### 4.4 测试

新增：

```text
tests/unit/ai-assistant-tool-registry.test.ts
```

测试点：重复工具名报错、safe 自动执行、confirm 触发确认、forbidden 永远拦截、legacy action 可映射到 tool call。

---

## 5. Sprint 3：下载选中卡片原图

### 5.1 目标

用户在画布框选卡片后，在 AI 助手里说：

```text
下载选择的卡片
把这些卡片原图打包
下载我框选的图片
```

AI 必须直接执行：

```text
canvas.getState
  -> canvas.getSelectedNodes
  -> 解析 Prompt 子图与 Image 节点
  -> assets.resolveOriginals
  -> assets.zipOriginals
  -> 返回 ZIP 下载结果
```

### 5.2 新增文件

```text
apps/web/src/features/assets/resolveOriginalAssets.ts
apps/web/src/features/ai-assistant-runtime/tools/assetTools.ts
```

核心函数：

```ts
export function resolveImageNodesForDownload(params: {
  activeCanvas: Canvas;
  selectedNodeIds: string[];
  scope: 'selected_cards' | 'latest_batch' | 'all_canvas_outputs';
}): GeneratedImage[];

export function resolveOriginalSource(image: GeneratedImage): {
  nodeId: string;
  sourceUrl?: string;
  storageId?: string;
  filename: string;
  mimeType: string;
  sourceKind: 'originalUrl' | 'apiResultUrl' | 'url' | 'storageId' | 'missing';
};
```

### 5.3 选区解析规则

```text
选中 image node -> 直接下载该 image
选中 prompt node -> 下载该 prompt.childImageIds 对应图片
同时选中 prompt 和其子图 -> 去重
scope=selected_cards 且无可下载图片 -> 抛出“当前没有选中的图片卡片或可下载子图”
```

### 5.4 原图优先级

```text
1. image.originalUrl
2. image.apiResultUrl
3. image.url
4. image.storageId -> 本地恢复路径
5. failedItems
```

### 5.5 ZIP manifest

ZIP 必须附带：

```ts
interface ZipManifest {
  projectName: string;
  canvasId: string;
  scope: string;
  createdAt: string;
  count: number;
  failedCount: number;
  items: Array<{
    nodeId: string;
    parentPromptId?: string;
    filename: string;
    sourceKind: string;
    promptSummary?: string;
    model?: string;
    originalUrlUsed: boolean;
  }>;
  failedItems: Array<{
    nodeId: string;
    reason: string;
  }>;
}
```

### 5.6 改造 zipOutputs

`zipOutputs` 保持旧调用兼容，但扩展参数：

```ts
export async function zipOutputs(
  scope: ZipScope,
  params: ZipParams & {
    selectedNodeIds?: string[];
    promptNodes?: PromptNode[];
    preferOriginal?: boolean;
  }
): Promise<{ count: number; failedCount: number }>;
```

### 5.7 测试

新增：

```text
tests/unit/zip-selected-originals.test.ts
```

测试点：

- 只选图片节点 -> 打包对应原图。
- 只选 Prompt 节点 -> 打包子图。
- 同时选 Prompt 与子图 -> 去重。
- 优先使用 `originalUrl`。
- 无选区时明确报错。
- 下载失败写入 `failedItems`。

---

## 6. Sprint 4：持久化批量生成队列

### 6.1 目标

批量生成不得像人一样慢慢在输入框输入。必须一次创建 batch job，由系统稳定执行。

### 6.2 新增文件

```text
apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts
apps/web/src/features/ai-assistant-runtime/queue/queuePersistence.ts
apps/web/src/features/ai-assistant-runtime/queue/rateLimiter.ts
apps/web/src/features/ai-assistant-runtime/queue/idempotency.ts
```

核心类型：

```ts
export interface GenerationBatchJob {
  id: string;
  idempotencyKey: string;
  canvasId: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdBy: 'assistant' | 'user';
  prompts: Array<{
    id: string;
    prompt: string;
    referenceImageNodeId?: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    promptNodeId?: string;
    resultImageNodeIds?: string[];
    error?: string;
    retryCount: number;
  }>;
  options: {
    modelId: string;
    aspectRatio: string;
    imageSize: string;
    countPerPrompt: number;
    concurrency: number;
    layout: 'grid' | 'row' | 'column';
    columns?: number;
    gap?: number;
  };
  createdAt: number;
  updatedAt: number;
}
```

### 6.3 默认限制

```ts
const QUEUE_LIMITS = {
  defaultConcurrency: 3,
  maxConcurrency: 8,
  maxBatchSize: 100,
  retryAttempts: 3,
  retryBackoffMs: 2000,
  requireConfirmationAboveCount: 1,
};
```

### 6.4 与现有生成路径集成

不要复制生成 API。队列执行必须调用现有能力：

```text
DurableGenerationQueue
  -> 创建 queued PromptNode
  -> 调用 executeGeneration(node)
  -> useImageGeneration 保存任务与原图
  -> 图片完成后 addImageNodes
  -> 更新 job item result ids
  -> canvas.arrangeNodes
```

### 6.5 自动整理

批量任务完成或部分完成时：

```text
collect created prompt/image node IDs
  -> canvas.arrangeNodes({ ids, layout: grid, columns })
  -> setNodeTags(ids, ['automation', `batch:${jobId}`])
  -> create group if group feature supports it
```

### 6.6 测试

新增：

```text
tests/unit/durable-generation-queue.test.ts
tests/unit/generation-batch-idempotency.test.ts
```

---

## 7. Sprint 5：项目知识库、模块地图、流程地图

### 7.1 目录

新增：

```text
docs/ai-assistant/
├── README.md
├── module-map.md
├── flow-map.md
├── tool-registry.md
├── canvas-runtime-state.md
├── ui-map.md
├── skills.md
├── safety-policy.md
└── session-memory.md
```

### 7.2 初始模块地图

必须覆盖：

```text
Canvas Module
  - CanvasContext
  - canvasContextState
  - canvasAutoArrange
  - canvasArrangeSelection
  - useCanvasSelectionBox
  - InfiniteCanvas

AI Takeover Module
  - AITakeoverContext
  - LocalAssistantBrain
  - LLMBrain
  - IntentGate
  - ActionExecutor
  - SafetyPolicy
  - ConfirmationPolicy
  - ProjectContextBuilder

Generation Module
  - useImageGeneration
  - useTaskRecovery
  - LLMService
  - taskPersistence
  - server/routes/generate-image.js

Assets Module
  - assetStore
  - zipOutputs
  - imageStorage

Provider / Route Module
  - LLMService
  - keyManager
  - providerCapabilities
  - secureModelProxy

Ecommerce / PPT / Redraw Modules
  - 先索引核心入口，后续细化
```

### 7.3 索引脚本

新增：

```text
scripts/ai-assistant/build-knowledge-index.mjs
scripts/ai-assistant/check-skills-consistency.mjs
```

输出：

```text
docs/ai-assistant/generated/project-index.json
docs/ai-assistant/generated/module-map.json
docs/ai-assistant/ge---

## 11. Sprint 7：多模态路由与媒体生成

### 11.1 路由契约与工具更新
- 多模态路由：`provider.getModelCapabilities` 必须在生图或提示词处理前，判定当前所处文本模型是否支持多模态输入（image understanding）。若不支持，自动拦截 Base64 或二进制数据块并向用户预警降级，规避 API 失败。
- 音频卡片：支持创建 `audio` 卡片，包含 `originalUrl` 与 `mimeType`，以及 HTML5 音频控制 UI（播放/暂停、播放条）。播放卡片 A 时，主线程拦截并通知其他正在播放的卡片进行 `PAUSE`，实现并发排他。
- 视频/Suno 等多媒体：对齐 `@aitu` 多媒体输入流，保证其存储和下载在 Assets 模块收口。

### 11.2 新增工具
```text
provider.getModelCapabilities
canvas.createAudioCard
audio.playbackControl
```

---

## 12. Sprint 8：智能 CDN 与工具箱多实例

### 12.1 Service Worker 与 CDN 智能降级
- 离线回退：Service Worker 拦截资源。对于核心入口（`index.html`、`sw.js` 等）强同源优先，不经过 CDN。
- 超时与脏缓存清理：对版本化资源进行 `Cache First` 校验，未命中走 CDN。任一 CDN 超时或故障时，在 200ms 内触发 `fetchWithFallback` 快速降级回源站拉取，并对该 CDN 降级 5 分钟。
- 偏好持久化：主线程测速后，向 SW 广播 `SW_CDN_SET_PREFERENCE` 持久化节点偏好，下次刷新时无需重新测速即可使用。

### 12.2 工具箱 Iframe 共享运行时
- 统一运行模型：iframe 辅助工具与内部 React 工具共享统一属性定义（如 `autoPinOnOpen`）。
- 多实例管理：如果定义声明了 `multiInstance: true`，右键点击图标允许新开窗口，分配新 `instanceId`，并各自由 WindowManager 维护位置和尺寸，互不相干。

### 12.3 新增工具
```text
ui.openToolWindow
ui.pinTool
ui.updateWindowLayout
```

---

## 13. Codex / Antigravity 实施顺序

### Sprint 0：文档与治理固化

1. 确认 `AGENTS.md` 和本文件存在，且都写明 **KK Studio v1.6.0**。
2. 修改 `scripts/governance/check-agent-docs.mjs`，把本文件加入必检。
3. 检查 token：`KK Studio v1.6.0`、`ToolRegistry`、`CanvasRuntimeState`。
4. 搜索旧文档中明显错误的 `1.4.x`、`1.5.0`、`1.5.1` 或与 `1.5.4` 冲突的描述，只修正文档，不改业务代码。
5. 运行 `npm run governance:check`。
6. 更新 `docs/development/session-handoff.md`，记录下一步 Sprint 1。

### Sprint 1：CanvasRuntimeState

1. 新增 `buildCanvasRuntimeState.ts`。
2. 扩展 `SanitizedProjectContext`。
3. 修改 `projectContextBuilder` 和 `AITakeoverContext`。
4. 新增测试。
5. 运行 `npm run typecheck` 与相关单测。

### Sprint 2：ToolRegistry 兼容层

1. 新增 `ToolRegistry`。
2. 注册 canvas/assets/generation 最小工具.
3. 写 `actionToToolCall` 适配器。
4. 保持现有 AI 助手 UI 不破。
5. 新增单测。

### Sprint 3：选中卡片原图 ZIP

1. 实现 `resolveImageNodesForDownload`。
2. 实现 `resolveOriginalSource`。
3. 升级 `zipOutputs`。
4. 接入 `assets.zipOriginals`。
5. 新增测试。

### Sprint 4：持久批量生成队列

1. 新增 `DurableGenerationQueue`。
2. 新增 `queuePersistence`。
3. 使用 idempotencyKey 防重复。
4. 接入 `startBatchGeneration`。
5. 批量结果自动打 `automation` 和 `batch:<jobId>` tag。
6. 自动整理。
7. 新增测试。

### Sprint 5：知识库与模块地图

1. 新增 `docs/ai-assistant/`。
2. 新增 module-map、flow-map、tool-registry、ui-map、skills。
3. 新增 `build-knowledge-index.mjs`。
4. 新增 `knowledge.recordChange`。
5. 新增一致性测试。

### Sprint 6：Skills 自更新与 UI Map 同步

1. 建立 Skill 模板。
2. 新增 5 个基础 Skill。
3. 新增 `ui.recordLayoutChange`。
4. 新增 `skills.upsertSkill`。
5. 新增 `check-skills-consistency.mjs`。
6. 加入 `governance:check` 或 `verify:changes`。

### Sprint 7：多模态路由与媒体生成

1. 实现 `provider.getModelCapabilities` 工具。
2. 新增多模态降级校验与拦截警告逻辑。
3. 创建音频卡片节点类型及自定义 UI 播放组件。
4. 在主线程实现音频卡片播放的排他 `PAUSE` 机制。
5. 新增单测验证。

### Sprint 8：智能 CDN 与工具箱多实例

1. 升级 Service Worker，添加 `index.html` 等同源优先路由规则。
2. 实现 `fetchWithFallback` 快速回源与故障 CDN 降级（5分钟）。
3. 主线程 CDN 测速并通过 `SW_CDN_SET_PREFERENCE` 消息广播。
4. 统一 iframe 工具和内部 React 组件配置，在 WindowManager 中支持多实例。
5. 新增测试。

---

## 14. 关键文件清单

### 14.1 新增文件

```text
AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md

docs/ai-assistant/README.md
docs/ai-assistant/module-map.md
docs/ai-assistant/flow-map.md
docs/ai-assistant/tool-registry.md
docs/ai-assistant/canvas-runtime-state.md
docs/ai-assistant/ui-map.md
docs/ai-assistant/skills.md
docs/ai-assistant/safety-policy.md
docs/ai-assistant/session-memory.md

apps/web/src/features/ai-assistant-runtime/index.ts
apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts
apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts
apps/web/src/features/ai-assistant-runtime/runtime/AgentPermissionPolicy.ts
apps/web/src/features/ai-assistant-runtime/runtime/AgentAuditLog.ts
apps/web/src/features/ai-assistant-runtime/context/buildCanvasRuntimeState.ts
apps/web/src/features/ai-assistant-runtime/context/recentCanvasEvents.ts
apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts
apps/web/src/features/ai-assistant-runtime/tools/canvasTools.ts
apps/web/src/features/ai-assistant-runtime/tools/assetTools.ts
apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts
apps/web/src/features/ai-assistant-runtime/tools/knowledgeTools.ts
apps/web/src/features/ai-assistant-runtime/tools/uiTools.ts
apps/web/src/features/ai-assistant-runtime/tools/skillTools.ts
apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts
apps/web/src/features/ai-assistant-runtime/queue/queuePersistence.ts
apps/web/src/features/ai-assistant-runtime/queue/rateLimiter.ts
apps/web/src/features/ai-assistant-runtime/queue/idempotency.ts
apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts
apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeRetriever.ts
apps/web/src/features/ai-assistant-runtime/knowledge/knowledgeSync.ts
apps/web/src/features/ai-assistant-runtime/memory/AgentMemoryStore.ts
apps/web/src/features/ai-assistant-runtime/memory/handoffWriter.ts

apps/web/src/features/assets/resolveOriginalAssets.ts

scripts/ai-assistant/build-knowledge-index.mjs
scripts/ai-assistant/check-skills-consistency.mjs

tests/unit/canvas-runtime-state-builder.test.ts
tests/unit/ai-assistant-tool-registry.test.ts
tests/unit/zip-selected-originals.test.ts
tests/unit/durable-generation-queue.test.ts
tests/unit/generation-batch-idempotency.test.ts
tests/unit/agent-knowledge-index-contract.test.ts
```

### 14.2 必须修改文件

```text
scripts/governance/check-agent-docs.mjs
apps/web/src/features/ai-takeover/types.ts
apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx
apps/web/src/features/ai-takeover/core/projectContextBuilder.ts
apps/web/src/features/ai-takeover/core/llmBrain.ts
apps/web/src/features/ai-takeover/core/localBrain.ts
apps/web/src/features/ai-takeover/core/actionExecutor.ts
apps/web/src/features/ai-takeover/core/intentGate.ts
apps/web/src/features/ai-takeover/core/confirmationPolicy.ts
apps/web/src/features/ai-takeover/core/safetyPolicy.ts
apps/web/src/features/assets/zipOutputs.ts
apps/web/src/context/CanvasContext.tsx
apps/web/src/context/canvasContextState.ts
apps/web/src/components/canvas/InfiniteCanvas.tsx
```

不要一次性全改。按 Sprint 小步提交。

---

## 15. 治理脚本更新

修改：

```text
scripts/governance/check-agent-docs.mjs
```

新增：

```js
const files = {
  ...,
  agents: 'AGENTS.md',
  assistantPlan: 'AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md',
};

expectIncludes(assistantPlan, files.assistantPlan, 'KK Studio v1.6.0');
expectIncludes(assistantPlan, files.assistantPlan, 'ToolRegistry');
expectIncludes(assistantPlan, files.assistantPlan, 'CanvasRuntimeState');
```

后续新增：

```json
{
  "scripts": {
    "ai-assistant:check": "node scripts/ai-assistant/check-skills-consistency.mjs"
  }
}
```

再并入 `governance:check` 或 `verify:changes`。

---

## 16. 给 Codex / Antigravity 的首条提示词

```text
请严格读取并遵守 AGENTS.md 与 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md。当前项目版本必须保持 KK Studio v1.6.0，不要改错版本。

本轮只执行 Sprint 0：
1. 检查 AGENTS.md 与 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md 是否存在。
2. 修改 scripts/governance/check-agent-docs.mjs，把 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md 加入必检文件，并检查 token：KK Studio v1.6.0、ToolRegistry、CanvasRuntimeState。
3. 搜索旧文档中明显错误的 1.4.x、1.5.x 或与 v1.6.0 冲突的描述，只修正文档，不改业务代码。
4. 运行 npm run governance:check。
5. 若失败，只修复与文档检查相关的问题。
6. 更新 docs/development/session-handoff.md，记录本轮结果和下一步 Sprint 1。

禁止进行大规模重构。禁止改生成逻辑。禁止改 UI。
```

第二轮提示词：

```text
请继续严格遵守 AGENTS.md 与 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md。当前项目版本仍为 KK Studio v1.6.0。

本轮执行 Sprint 1：实现 CanvasRuntimeState。
1. 新增 apps/web/src/features/ai-assistant-runtime/context/buildCanvasRuntimeState.ts。
2. 从 activeCanvas、selectedNodeIds、canvas transform、promptBarInput 构建脱敏 CanvasRuntimeState。
3. 扩展 apps/web/src/features/ai-takeover/types.ts 的 SanitizedProjectContext，新增 runtime?: CanvasRuntimeState，保持旧字段兼容。
4. 修改 projectContextBuilder 和 AITakeoverContext，让 AI 助手能收到 runtime 摘要。
5. 不要泄露敏感凭证、长随机串、完整 base64 或大 URL。
6. 新增 tests/unit/canvas-runtime-state-builder.test.ts。
7. 运行 npm run typecheck 和相关单测。
8. 更新 docs/development/session-handoff.md。
```

---

## 17. 最终验收清单

- [ ] `AGENTS.md` 与本文件均明确 v1.6.0。
- [ ] `governance:check` 会检查两份文件。
- [ ] AI 助手上下文包含 CanvasRuntimeState。
- [ ] 画布选区、Prompt 子图、图片节点可被工具准确解析。
- [ ] “下载选择的卡片”可直接打包选区原图，不模拟 UI。
- [ ] 批量生成走 DurableGenerationQueue，不循环输入框。
- [ ] 批量生成结果自动整齐排列并打 batch / automation tag。
- [ ] ToolRegistry 有权限、审计、测试。
- [ ] confirm / dangerous / forbidden 权限生效。
- [ ] 新增或修改助手能力后，会更新 docs/ai-assistant 知识库和 Skills。
- [ ] UI 位置变化会更新 ui-map。
- [ ] 中断后可通过 AgentRunStore、queuePersistence、taskPersistence、session-handoff 继续。
- [ ] `npm run verify:changes` 或分阶段验证通过。

---

## 18. 重要提醒

1. 不要把本方案实现成“聊天模型自己乱操作”。必须是结构化工具调用。
2. 不要把所有状态塞给 LLM。必须脱敏、摘要、按需检索。
3. 不要把本地缓存当权威数据库。
4. 不要绕过现有 `CanvasContext`、`useImageGeneration`、`LLMService`。
5. 不要把用户凭证或私密会话信息写入知识库或日志。
6. 不要忘记更新知识库、Skills 和 handoff；这是助手保持“最新认知”的关键。
7. 不要把版本写错；本项目当前是 **KK Studio v1.6.0**。

---

**结论：本文件定义的是一条可执行工程路线。先把现有 AI 接管雏形接入 CanvasRuntimeState 与 ToolRegistry，再跑通选区原图下载和持久批量生成，最后建立知识库、Skills 与中断续跑机制。完成后，KK Studio 的 AI 助手就能成为项目内可靠执行层，而不是慢速模拟用户操作的聊天框。**time/tools/ToolRegistry.ts
apps/web/src/features/ai-assistant-runtime/tools/canvasTools.ts
apps/web/src/features/ai-assistant-runtime/tools/assetTools.ts
apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts
apps/web/src/features/ai-assistant-runtime/tools/knowledgeTools.ts
apps/web/src/features/ai-assistant-runtime/tools/uiTools.ts
apps/web/src/features/ai-assistant-runtime/tools/skillTools.ts
apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts
apps/web/src/features/ai-assistant-runtime/queue/queuePersistence.ts
apps/web/src/features/ai-assistant-runtime/queue/rateLimiter.ts
apps/web/src/features/ai-assistant-runtime/queue/idempotency.ts
apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts
apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeRetriever.ts
apps/web/src/features/ai-assistant-runtime/knowledge/knowledgeSync.ts
apps/web/src/features/ai-assistant-runtime/memory/AgentMemoryStore.ts
apps/web/src/features/ai-assistant-runtime/memory/handoffWriter.ts

apps/web/src/features/assets/resolveOriginalAssets.ts

scripts/ai-assistant/build-knowledge-index.mjs
scripts/ai-assistant/check-skills-consistency.mjs

tests/unit/canvas-runtime-state-builder.test.ts
tests/unit/ai-assistant-tool-registry.test.ts
tests/unit/zip-selected-originals.test.ts
tests/unit/durable-generation-queue.test.ts
tests/unit/generation-batch-idempotency.test.ts
tests/unit/agent-knowledge-index-contract.test.ts
```

### 12.2 必须修改文件

```text
scripts/governance/check-agent-docs.mjs
apps/web/src/features/ai-takeover/types.ts
apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx
apps/web/src/features/ai-takeover/core/projectContextBuilder.ts
apps/web/src/features/ai-takeover/core/llmBrain.ts
apps/web/src/features/ai-takeover/core/localBrain.ts
apps/web/src/features/ai-takeover/core/actionExecutor.ts
apps/web/src/features/ai-takeover/core/intentGate.ts
apps/web/src/features/ai-takeover/core/confirmationPolicy.ts
apps/web/src/features/ai-takeover/core/safetyPolicy.ts
apps/web/src/features/assets/zipOutputs.ts
apps/web/src/context/CanvasContext.tsx
apps/web/src/context/canvasContextState.ts
apps/web/src/components/canvas/InfiniteCanvas.tsx
```

不要一次性全改。按 Sprint 小步提交。

---

## 13. 治理脚本更新

修改：

```text
scripts/governance/check-agent-docs.mjs
```

新增：

```js
const files = {
  ...,
  agents: 'AGENTS.md',
  assistantPlan: 'AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md',
};

expectIncludes(assistantPlan, files.assistantPlan, 'KK Studio v1.6.0');
expectIncludes(assistantPlan, files.assistantPlan, 'ToolRegistry');
expectIncludes(assistantPlan, files.assistantPlan, 'CanvasRuntimeState');
```

后续新增：

```json
{
  "scripts": {
    "ai-assistant:check": "node scripts/ai-assistant/check-skills-consistency.mjs"
  }
}
```

再并入 `governance:check` 或 `verify:changes`。

---

## 14. 给 Codex / Antigravity 的首条提示词

```text
请严格读取并遵守 AGENTS.md 与 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md。当前项目版本必须保持 KK Studio v1.6.0，不要改错版本。

本轮只执行 Sprint 0：
1. 检查 AGENTS.md 与 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md 是否存在。
2. 修改 scripts/governance/check-agent-docs.mjs，把 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md 加入必检文件，并检查 token：KK Studio v1.6.0、ToolRegistry、CanvasRuntimeState。
3. 搜索旧文档中明显错误的 1.4.x、1.5.x 或与 v1.6.0 冲突的描述，只修正文档，不改业务代码。
4. 运行 npm run governance:check。
5. 若失败，只修复与文档检查相关的问题。
6. 更新 docs/development/session-handoff.md，记录本轮结果和下一步 Sprint 1。

禁止进行大规模重构。禁止改生成逻辑。禁止改 UI。
```

第二轮提示词：

```text
请继续严格遵守 AGENTS.md 与 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md。当前项目版本仍为 KK Studio v1.6.0。

本轮执行 Sprint 1：实现 CanvasRuntimeState。
1. 新增 apps/web/src/features/ai-assistant-runtime/context/buildCanvasRuntimeState.ts。
2. 从 activeCanvas、selectedNodeIds、canvas transform、promptBarInput 构建脱敏 CanvasRuntimeState。
3. 扩展 apps/web/src/features/ai-takeover/types.ts 的 SanitizedProjectContext，新增 runtime?: CanvasRuntimeState，保持旧字段兼容。
4. 修改 projectContextBuilder 和 AITakeoverContext，让 AI 助手能收到 runtime 摘要。
5. 不要泄露敏感凭证、长随机串、完整 base64 或大 URL。
6. 新增 tests/unit/canvas-runtime-state-builder.test.ts。
7. 运行 npm run typecheck 和相关单测。
8. 更新 docs/development/session-handoff.md。
```

---

## 15. 最终验收清单

- [ ] `AGENTS.md` 与本文件均明确 v1.6.0。
- [ ] `governance:check` 会检查两份文件。
- [ ] AI 助手上下文包含 CanvasRuntimeState。
- [ ] 画布选区、Prompt 子图、图片节点可被工具准确解析。
- [ ] “下载选择的卡片”可直接打包选区原图，不模拟 UI。
- [ ] 批量生成走 DurableGenerationQueue，不循环输入框。
- [ ] 批量生成结果自动整齐排列并打 batch / automation tag。
- [ ] ToolRegistry 有权限、审计、测试。
- [ ] confirm / dangerous / forbidden 权限生效。
- [ ] 新增或修改助手能力后，会更新 docs/ai-assistant 知识库和 Skills。
- [ ] UI 位置变化会更新 ui-map。
- [ ] 中断后可通过 AgentRunStore、queuePersistence、taskPersistence、session-handoff 继续。
- [ ] `npm run verify:changes` 或分阶段验证通过。

---

## 16. 重要提醒

1. 不要把本方案实现成“聊天模型自己乱操作”。必须是结构化工具调用。
2. 不要把所有状态塞给 LLM。必须脱敏、摘要、按需检索。
3. 不要把本地缓存当权威数据库。
4. 不要绕过现有 `CanvasContext`、`useImageGeneration`、`LLMService`。
5. 不要把用户凭证或私密会话信息写入知识库或日志。
6. 不要忘记更新知识库、Skills 和 handoff；这是助手保持“最新认知”的关键。
7. 不要把版本写错；本项目当前是 **KK Studio v1.6.0**。

---

**结论：本文件定义的是一条可执行工程路线。先把现有 AI 接管雏形接入 CanvasRuntimeState 与 ToolRegistry，再跑通选区原图下载和持久批量生成，最后建立知识库、Skills 与中断续跑机制。完成后，KK Studio 的 AI 助手就能成为项目内可靠执行层，而不是慢速模拟用户操作的聊天框。**
