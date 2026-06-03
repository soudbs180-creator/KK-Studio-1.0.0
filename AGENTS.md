# AGENTS.md — KK Studio v1.5.2 项目总规范与 Agent 黄金法则

<!-- AGENTS.md - AI Agent 项目总指导文件 -->

Last updated: 2026-06-03
Project version: **KK Studio v1.5.2**
Primary companion: [`AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`](./AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md)

> 本文件是 KK Studio v1.5.2 的最高优先级开发规约。Codex、Antigravity、Claude、Cursor、人工开发者及任何自动化 Agent 在修改项目之前必须先读取本文件。任何旧文档、旧提示词、历史计划、临时代码与本文件冲突时，以本文件和当前源码为准。

---

## 0. 不可改错的当前项目事实

1. **项目名与版本**：项目为 `KK Studio`，当前稳定版本必须写作 **v1.5.2**。版本事实以 `config/release-manifest.json` 为第一来源，`package.json` 与各 workspace package 只能作为同步投影。
2. **仓库名**：`soudbs180-creator/nano-banana-KK-`。
3. **技术栈**：Web 端为 Vite + React 19 + TypeScript + Tailwind + AntD / Lobe UI Bridge；主要运行目录为 `apps/web/`。后端存在 `server/` Express / VPS 运行时与相关代理路由。共享逻辑位于 `packages/shared/`、统一 API 客户端位于 `packages/api-client/`、设计系统适配位于 `packages/ui/`。
4. **Node 与包管理器**：以根 `package.json` 的 `engines.node` 与 `packageManager` 为准，当前为 Node 24.x 与 npm 11.x。
5. **核心产品定位**：KK Studio 是面向 AI 创作、无限画布、多模型路由、用户自主密钥、多端同步与商业化计费审计的多模态工作台。
6. **当前 AI 助手雏形**：`apps/web/src/features/ai-takeover/` 已存在 LocalBrain、LLMBrain、IntentGate、ActionExecutor、SafetyPolicy、ConfirmationPolicy、ProjectContextBuilder 等前端接管能力。后续必须在此基础上升级，不得绕开并另起一套互相竞争的助手系统。
7. **当前画布事实**：画布状态由 `CanvasContext` / `canvasContextState` 管理，包含 `activeCanvasId`、`selectedNodeIds`、`viewportCenter`、画布列表、历史、组、图像节点、提示词节点等。无限画布组件 `InfiniteCanvas` 已暴露实时 transform、视口矩形、缩放、复位和全览能力。
8. **生成结果事实**：`GeneratedImage` 同时可能拥有 `url`、`originalUrl`、`apiResultUrl`、`storageId`、`mimeType`、`sourceTaskId` 等字段。下载原图必须优先解析 `originalUrl`，其次 `apiResultUrl`，再次 `url`，最后才走本地存储恢复。
9. **当前文档事实**：仓库中存在部分历史文档口径不一致，例如旧迁移文档可能仍提到 `src/`、Netlify、1.4.x 或未来目标目录。Agent 必须以当前源码、`package.json`、`config/release-manifest.json`、测试脚本与本文件为准，并在相关工作中修正文档漂移。
10. **根目录允许的治理文件**：`AGENTS.md`、`AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`、`plans.md`、`implement.md`、`status.md`、`validation.md`、`README.md`、`REPO_AUDIT.md`、`OPTIMIZATION_PROMPTS.md` 可存在于根目录。历史 `OPTIMIZATION_PROMPTS.md` 只能作为参考，不得覆盖本文件与 AI 助手优化方案。

---

## 1. Agent 工作总原则

### 1.1 先读项目，后动代码

任何 AI 编程工具接手任务时，必须按顺序读取：

1. `AGENTS.md`
2. `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`
3. `package.json`
4. `config/release-manifest.json`
5. 与任务相关的源码目录
6. `docs/development/session-handoff.md`、`status.md`、`implement.md`、`validation.md` 中与任务有关的部分

禁止凭记忆、旧提示词或猜测修改项目。

### 1.2 冲突解决顺序

当文档、源码、测试、历史记录互相冲突时，按以下优先级判断：

```text
当前源码和类型定义
  > package.json / release-manifest / 构建脚本
  > 自动化测试与治理脚本
  > AGENTS.md
  > AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md
  > docs/ 下的当前文档
  > 历史归档、旧计划、旧提示词
```

若发现冲突，不要静默沿用旧口径。必须在本次变更中修正或记录到 handoff。

### 1.3 工具优先，不模拟用户界面

AI 助手、Agent Runtime 和自动化工作流不得模拟人在输入框里逐条输入、点击、发送来完成批量任务。只要项目已有或应有直接函数、Context API、服务接口或 Tool API，就必须直接调用能力。

错误方式：

```text
循环 30 次：填输入框 -> 点发送 -> 等结果
```

正确方式：

```text
generation.createBatchJob(prompts, options)
canvas.createPromptCards(batch)
canvas.arrangeNodes(cardIds, layout)
assets.zipOriginals(selectedImageNodeIds)
```

### 1.4 AI 不是无限权限执行器

LLM 只能负责理解、规划、生成结构化动作。真正执行必须经过：

```text
Intent Gate -> Planner -> Tool Registry -> Permission Policy -> Executor -> Verification -> Memory / Knowledge Update
```

不得让 LLM 直接读写密钥、生产数据库、任意文件系统、付款状态、积分余额或部署环境。

### 1.5 每次改动都必须可恢复

Codex / Antigravity 可能中断。任何复杂任务必须留下可恢复信息：

- 已修改文件
- 未完成步骤
- 当前设计决策
- 已运行测试
- 未运行测试与原因
- 下一步最小操作

优先写入 `docs/development/session-handoff.md` 或任务相关的 `docs/ai-assistant/*` 文档；根目录 `implement.md/status.md/validation.md` 只记录里程碑级事实。

---

## 2. 当前目录职责

```text
nano-banana-KK-/
├── apps/
│   ├── web/                         # 桌面 Web 主运行时，Vite + React + TypeScript
│   │   └── src/
│   │       ├── app/                 # 应用级 hooks、运行态编排、响应式入口
│   │       ├── components/          # UI 组件，含 canvas/layout/mobile/ecommerce
│   │       ├── context/             # Canvas/Auth/Billing/Startup 等 React Context
│   │       ├── features/
│   │       │   ├── ai-takeover/     # 当前 AI 接管雏形，后续 AI 助手升级必须基于这里演进
│   │       │   └── assets/          # 资源池、ZIP 输出、敏感文件扫描
│   │       ├── hooks/               # 生成、任务恢复、UI 状态 hooks
│   │       ├── services/            # LLM、存储、认证、账单、API、系统日志等服务
│   │       ├── types/               # 主要业务类型，GeneratedImage/PromptNode/Canvas 等
│   │       ├── utils/               # 画布布局、模型展示、图像恢复、PPT/电商工具
│   │       └── workflow/            # 实验性工作流图能力
│   └── mobile/                      # Expo 移动端。若工作区未完全接入，仍不得在 Web 引入 RN API
├── packages/
│   ├── shared/                      # 跨端纯 TS 共享契约和领域逻辑
│   ├── api-client/                  # 统一 HTTP 客户端
│   └── ui/                          # 设计令牌与 UI 适配层
├── server/                          # Express / VPS 后端与过渡代理路由
├── migrations/                      # PostgreSQL DDL 唯一合法来源
├── docs/                            # 项目文档、架构记录、开发交接
├── scripts/                         # CI、治理、发布、测试与维护脚本
├── tests/                           # 单元、集成、契约、E2E 测试
├── config/                          # release manifest 与项目配置
└── AGENTS.md                        # 本文件
```

### 2.1 模块边界硬规则

| 模块 | 必须遵守 | 禁止事项 |
|---|---|---|
| `apps/web/` | 只写浏览器 Web 逻辑，通过 `packages/api-client` 或服务层访问后端 | 禁止引入 React Native / Expo API；禁止直接写数据库；禁止直接读取密钥 |
| `apps/web/src/features/ai-takeover/` | 作为现有 AI 接管能力的升级入口 | 禁止再新建一套平行 AI 助手导致状态分裂 |
| `apps/web/src/context/` | 管理画布、认证、账单等运行态 | 禁止把高频 runtime state 全部塞进 LLM prompt；必须脱敏摘要化 |
| `apps/web/src/services/llm/` | 模型路由、Provider 能力、用户密钥路由、系统代理 | 禁止浏览器直连受保护 Provider；禁止明文日志密钥 |
| `packages/shared/` | 纯 TS 契约、DTO、领域规则 | 禁止 DOM、window、localStorage、React、RN、Node 专属 API |
| `packages/api-client/` | HTTP API 边界 | 禁止平台专属存储硬编码；需要依赖注入 |
| `packages/ui/` | UI token、基础组件、适配器 | 禁止业务状态和模型调用逻辑 |
| `server/` | 后端路由、积分、代理、Webhook、文件落盘 | 禁止引入前端组件；禁止使用弱默认密钥 |
| `migrations/` | 数据库结构变更 | 禁止业务逻辑；禁止非幂等破坏性 DDL |

---

## 3. AI 助手与画布 Agent 目标架构

KK Studio 的最终助手不是聊天机器人，而是项目级、画布级、任务级 Agent。目标链路如下：

```text
用户自然语言
  -> CanvasRuntimeState 当前画布/选区/视口/输入框/最近事件
  -> ProjectKnowledge 项目模块/代码/流程/规范/历史任务
  -> IntentGate 意图识别
  -> Planner 结构化计划
  -> ToolRegistry 工具选择
  -> PermissionPolicy 权限与确认
  -> Executor 直接调用项目能力
  -> JobQueue 批量任务/限速/重试/恢复
  -> Canvas / Assets / Generation 更新
  -> Memory & Knowledge Sync 自动更新知识库和 Skills
```

### 3.1 已有基础必须复用

当前已有这些基础，不得重复造轮子：

- `LocalAssistantBrain`：本地规则脑
- `LLMBrain`：云端大模型规划器
- `analyzeIntent`：意图门控
- `executeAction`：动作执行器
- `safetyPolicy`：安全策略
- `confirmationPolicy`：确认策略
- `buildSanitizedProjectContext`：脱敏上下文构建器
- `useAssetStore`：资产池
- `zipOutputs`：ZIP 输出雏形
- `CanvasContext`：画布增删改查、选择、排列、历史、持久化
- `useTaskRecovery` / `taskPersistence`：生成任务恢复雏形

升级时必须从这些点演进为 `AgentRuntime + ToolRegistry + DurableQueue + KnowledgeSync`，而不是新增互相割裂的助手。

### 3.2 必须补齐的核心缺口

1. **项目知识库**：当前助手只能看到脱敏画布摘要，不能真正理解项目代码、模块、接口、流程。必须增加项目知识索引、模块地图、流转地图、规范索引。
2. **画布运行态**：当前上下文缺少完整 viewport、transform、active tool、recent events、选区对象详情、UI 布局签名。必须补齐。
3. **Tool Registry**：当前 action 是前端 switch-case。必须升级为可声明、可权限控制、可审计、可测试的工具注册表。
4. **批量任务队列**：当前 AI 接管队列是前端内存数组且默认并发 3。必须支持持久化、限速、幂等、暂停、恢复、失败重试。
5. **下载选中原图**：当前 ZIP 工具对 selected scope 和 originalUrl 优先级不完整。必须实现真实选区过滤与原图解析。
6. **知识自更新**：每次调试、UI 位置变化、流程变化、工具新增后，必须自动或半自动写入知识库、Skills/Runbooks、handoff，保持最新。

---

## 4. 画布运行态协议

AI 助手理解“我在画布干嘛”必须依赖结构化运行态，而不是猜测用户意图。

必须建设并保持如下概念：

```ts
type CanvasRuntimeState = {
  projectVersion: '1.5.2';
  userId?: string;
  canvasId: string;
  canvasName?: string;
  viewport: {
    x: number;
    y: number;
    scale: number;
    rect?: { width: number; height: number };
    center?: { x: number; y: number };
  };
  selection: {
    selectedNodeIds: string[];
    promptNodeIds: string[];
    imageNodeIds: string[];
    groupIds: string[];
    count: number;
  };
  promptBarInput?: {
    prompt: string;
    mode: string;
    referenceImagesCount: number;
  };
  activeTool?: 'select' | 'pan' | 'generate' | 'edit' | 'redraw' | 'unknown';
  recentEvents: Array<{
    type: string;
    targetIds?: string[];
    timestamp: number;
    summary?: string;
  }>;
};
```

### 4.1 选区解释规则

- 用户说“这些卡片”“选中的卡片”“我框选的卡片”，必须解析为 `selectedNodeIds`。
- 下载图片时，只能下载选区里的图片节点；如果选区包含 Prompt 节点，必须解析其子图像节点。
- 用户说“刚刚生成的图”，优先使用 recentEvents 中的 generation completed/batch id，其次用 imageNodes timestamp。
- 用户说“当前画布”，范围是 `activeCanvasId` 对应的画布，而不是所有画布。
- 用户说“整理一下”，默认整理当前选区；没有选区时才整理当前画布。

### 4.2 视口与 UI 位置变更规则

任何 UI 位置、面板布局、画布坐标系、按钮入口变化都要同步更新：

- 运行态字段
- 相关选择器或 action handler
- 帮助文案
- `docs/ai-assistant/ui-map.md` 或同类知识文档
- 回归测试中的选择器

不得只改 UI，不改助手知识；否则助手会继续“知道旧位置”。

---

## 5. Tool Registry 黄金规范

### 5.1 工具命名

工具名必须使用命名空间：

```text
canvas.getState
canvas.getSelectedNodes
canvas.createPromptCards
canvas.createImageCards
canvas.updateNodes
canvas.arrangeNodes
canvas.locateNodes
assets.resolveOriginals
assets.zipOriginals
generation.createBatchJob
generation.getJobStatus
generation.pauseJob
generation.resumeJob
knowledge.searchProject
knowledge.recordChange
skills.upsertSkill
ui.recordLayoutChange
```

### 5.2 工具声明结构

```ts
type AgentToolDefinition = {
  name: string;
  description: string;
  permission: 'safe' | 'confirm' | 'dangerous' | 'forbidden';
  inputSchema: unknown;
  outputSchema: unknown;
  handler: (input: unknown, ctx: AgentExecutionContext) => Promise<unknown>;
};
```

所有工具调用都必须记录：

```ts
type AgentToolCallLog = {
  id: string;
  runId: string;
  toolName: string;
  inputSummary: string;
  outputSummary?: string;
  status: 'success' | 'failed' | 'blocked';
  error?: string;
  startedAt: string;
  completedAt?: string;
  idempotencyKey?: string;
};
```

### 5.3 权限规则

| 权限 | 示例 | 是否自动执行 |
|---|---|---|
| `safe` | 读画布状态、定位卡片、整理非破坏性布局、下载已有文件 | 可以 |
| `confirm` | 批量生成、上传资源、扣积分、覆盖输出、读取文件内容 | 必须确认 |
| `dangerous` | 删除卡片、清空画布、发布、部署、批量替换 | 必须二次确认并显示影响范围 |
| `forbidden` | 读取/填写/上传 API 密钥、记录密码、绕过积分、直接改生产账单 | 永远禁止 |

---

## 6. 必须跑通的核心业务流

### 6.1 下载选中卡片原图

用户说：

```text
下载选择的卡片
我要打包这些图
把我框选的卡片原图下载
```

必须执行：

```text
canvas.getState
  -> canvas.getSelectedNodes
  -> 解析 Prompt 子图与 Image 节点
  -> assets.resolveOriginals
  -> assets.zipOriginals
  -> 返回下载结果 / 浏览器保存
```

原图解析优先级：

```text
image.originalUrl
  -> image.apiResultUrl
  -> image.url
  -> image.storageId 对应 IndexedDB / OPFS / 本地文件恢复
  -> 标记 failedItems 写入 manifest.json
```

ZIP 必须包含：

- 原图文件
- `manifest.json`
- 每个文件的 `nodeId`、`parentPromptId`、`prompt` 摘要、`model`、`createdAt`、失败原因

### 6.2 批量生图并整齐放入画布

用户说：

```text
批量生成 30 张头像，整理成卡片组
对这个文件夹每张图都生成一个商品主图
```

不得循环模拟输入框。必须一次创建批量任务：

```text
IntentGate
  -> Planner 生成 BatchGenerationPlan
  -> confirmationPolicy 确认成本/上传/数量
  -> generation.createBatchJob
  -> JobQueue 按并发与速率执行
  -> 结果保存 originalUrl/storageId
  -> canvas.createImageCards / addImageNodes
  -> canvas.arrangeNodes
  -> group/tag 标记 batchId
  -> knowledge.recordChange
```

默认限速策略：

```text
defaultConcurrency = 3
maxConcurrency = 8
maxBatchSize = 100
retryAttempts = 3
retryBackoffMs = 2000
requireIdempotencyKey = true
```

### 6.3 整理卡片

- 当前选区存在时，只整理选区。
- 选中单个 Prompt 且有子图时，调用 `arrangeSingleSelectedPromptChildren`。
- 选中多个组或多张卡片时，调用 `arrangeSelectedGroupedNodes` 或 `arrangeSelectedRootNodes`。
- 整个画布整理时，调用 `resolveCanvasAutoArrangePositions`。
- 自动化批量输出必须打 `automation` tag，进入自动化轨道，避免与用户手动创作区混在一起。

### 6.4 帮我发送 / 帮我运行

如果用户只是要发送当前输入框，允许调用 `submitPromptComposer` 或未来的 `generation.submitComposer`。但批量任务不允许逐条发送；必须转成 Batch Job。

### 6.5 优化提示词

“优化提示词”“润色提示词”“给我提示词”默认不生成图片。只有用户明确说“生成、出图、跑图、发送”时，才可进入生成流程。

---

## 7. 项目知识库与 Skills 自更新规范

### 7.1 不是微调优先

本项目所谓“像训练出一个小模型”，第一阶段不通过不透明微调实现，而通过以下机制实现：

```text
项目代码索引 + 模块地图 + 流程地图 + 画布运行态 + 工具注册表 + 长短期记忆 + Skills/Runbooks
```

只有在积累足够脱敏、高质量、可授权的任务样本后，才允许考虑微调或蒸馏。

### 7.2 知识库目录建议

后续必须逐步建立：

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

必要时新增：

```text
apps/web/src/features/ai-assistant-runtime/
├── runtime/
├── tools/
├── knowledge/
├── memory/
├── queue/
└── __tests__/
```

### 7.3 每次变更后的知识更新

任何满足以下条件的变更，都必须更新知识库：

- 新增或修改 AI 助手动作
- 新增或修改画布操作
- 新增或修改 UI 入口、按钮、面板位置
- 新增或修改生成流程、批量流程、下载流程
- 新增 Provider、模型能力、限速策略
- 修改资产存储、原图恢复、ZIP 导出
- 修复用户调试中发现的关键行为

更新内容至少包括：

```text
变更点
影响模块
新工具或新流程
旧行为是否废弃
验证方式
下一次 Agent 如何使用这个信息
```

---

## 8. 安全、密钥、积分与隐私

1. AI 永远不得读取、填写、上传、记录 API Key、JWT、Cookie、Password、Stripe Secret、Webhook Secret、数据库连接串。
2. Prompt、错误信息、日志、上下文发送给 LLM 前必须脱敏。
3. 文件上传给大模型前必须经过确认；敏感文件必须物理隔离。
4. 系统积分扣减、退款、余额、支付状态必须以后端权威结果为准。
5. 本地用户 API 与系统积分模型必须明确区分；禁止用“免费/无限”等文案误导用户。
6. 浏览器端不得直连受保护 Provider；用户自有 API 也必须走项目规定的 secure proxy / local user route。
7. 任何 destructive 操作必须确认并列出影响范围。
8. 下载已有原图是 safe 操作，但范围不明确时必须先澄清或默认当前选区。

---

## 9. 数据库与迁移规范

1. Schema 变更只能写入 `migrations/`。
2. 迁移文件必须幂等，命名格式 `NNN_<description>.sql`。
3. 不得在前端、脚本或普通业务路由中执行 DDL。
4. 新增 AI 助手持久化表时，必须覆盖：
   - agent_runs
   - agent_tool_calls
   - agent_memory
   - knowledge_documents
   - knowledge_chunks
   - canvas_runtime_snapshots
   - agent_skills
5. 如果暂时用 localStorage/IndexedDB 作为过渡，必须注明它是 projection / cache，不得当作长期权威存储。

---

## 10. UI 与设计系统规范

1. 保持 KK Studio 既有 Glassmorphism、柔和层级、卡片质感与无限画布视觉语言。
2. 业务代码不得直接依赖 `@lobehub/ui`，必须走 `packages/ui` 或项目现有 Bridge。
3. 新增 AI 助手面板、确认卡、任务队列面板、知识更新提示必须支持暗色和浅色主题。
4. 画布批量输出必须整齐排列，不得随机堆叠。
5. 移动端不得直接使用 DOM/BOM 专属逻辑；Web 不得引入 RN/Expo。
6. UI 位置变更必须同步更新 AI 助手的 `ui-map` 与测试选择器。

---

## 11. 测试与验证

### 11.1 标准全量验证

完成代码变更后优先运行：

```bash
npm run verify:changes
```

此命令包含架构边界、治理、安全、类型检查、OpenAPI/spec、构建、测试、关键冒烟和编码检查。

### 11.2 允许的分阶段验证

若任务很小或环境无法跑全量，至少运行相关子集，并在 handoff 中说明未跑全量的原因：

```bash
npm run architecture:check
npm run governance:check
npm run typecheck
npm run test:unit
npm run test:contract
npm run build
npm run check:encoding
```

### 11.3 AI 助手专项测试必须补齐

后续新增 AI 助手能力时，必须增加或更新：

- `tests/unit/ai-takeover-intentGate.test.ts`
- `tests/unit/ai-takeover-safetyPolicy.test.ts`
- `tests/unit/ai-takeover-confirmationPolicy.test.ts`
- 新增 `tests/unit/ai-assistant-tool-registry.test.ts`
- 新增 `tests/unit/zip-selected-originals.test.ts`
- 新增 `tests/unit/agent-knowledge-sync.test.ts`
- 必要时新增浏览器冒烟测试验证选区下载、批量生图、整理卡片

---

## 12. Codex / Antigravity 连续开发协议

每次开始任务时：

```text
1. 读取 AGENTS.md
2. 读取 AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md
3. 确认版本仍为 v1.5.2
4. 搜索相关源码和测试
5. 输出简短计划
6. 小步修改
7. 跑验证
8. 更新知识库 / handoff
9. 提交清晰 commit 或 PR 说明
```

中断恢复时：

```text
1. 查看 git diff / 最近提交
2. 查看 docs/development/session-handoff.md
3. 查看 status.md / implement.md / validation.md 是否有任务记录
4. 重新运行最小相关验证
5. 从未完成的最小下一步继续
```

禁止：

- 新开大分支后长期不合并
- 同时重构多个无关模块
- 把测试改到“适应错误行为”
- 删除安全检查绕过失败
- 复制旧目录生成重复代码
- 只改 UI 不更新 AI 知识

---

## 13. 完成定义

一个 AI 助手能力改造任务只有同时满足以下条件才算完成：

1. 用户自然语言能被正确识别为 intent。
2. Planner 输出结构化计划。
3. Tool Registry 能直接调用项目能力。
4. 安全策略和确认策略生效。
5. 画布或资产状态真实更新。
6. 批量任务可限速、可重试、可恢复。
7. 选区、视口、UI 位置被运行态感知。
8. 结果整齐排列或正确打包下载。
9. 知识库和 Skills/Runbooks 更新。
10. 测试或验证记录完成。
11. 中断后下一次 Codex / Antigravity 可继续。

---

## 14. 当前最高优先级整改顺序

1. 固化本文件与 `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md` 为双入口。
2. 建立 `docs/ai-assistant/` 知识目录。
3. 扩展 `SanitizedProjectContext` 为完整 CanvasRuntimeState。
4. 把 `ActionExecutor` 拆为 Tool Registry + Executor。
5. 修复 `selected_cards` ZIP 逻辑，优先下载原图。
6. 把 AI 接管内存队列升级为持久化 Batch Job Queue。
7. 建立知识索引与自动更新机制。
8. 为批量生成、下载选区、整理卡片补齐测试。
9. 清理旧文档中与 v1.5.2 冲突的版本和运行时描述。
10. 再考虑更高级的模型微调或蒸馏。

---

**严格结论：KK Studio v1.5.2 的 AI 助手必须从“前端接管雏形”升级为“项目知识库 + 画布运行态 + 工具调用 + 持久队列 + 自更新记忆”的工程系统。任何实现都必须遵守本文件。**
