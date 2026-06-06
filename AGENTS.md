# AGENTS.md — KK Studio v1.5.5 AI / Agent 最高执行规范
<!-- CI Tokens: AGENTS.md - AI Agent 项目总指导文件, KK Studio v1.5.5, AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md, ToolRegistry, CanvasRuntimeState -->

Last updated: 2026-06-04  
Project version: **KK Studio v1.5.5**

> 本文件是 Codex、Claude、Cursor、Antigravity、自动化 Agent 与任何 AI 编程工具修改本项目之前必须读取的最高优先级规则入口。

---

## 0. 文档路由总表

Agent 接到任务后，先用下表判断需要读取哪些文档。不要把所有规则塞进 prompt 后凭感觉执行；必须按任务类型进入对应规则。

| 任务类型 | 必读文档 | 继续读取 | 输出要求 |
|---|---|---|---|
| 任意代码修改 | `AGENTS.md` | `package.json`、`config/release-manifest.json`、相关源码与测试 | 简短计划、最小变更、验证记录、交接说明 |
| 新增/修改核心能力 (Capability) | `AGENTS.md` §20 | `openspec/project.md`、对应 specs 与 changes | 遵循 OpenSpec 三阶段工作流，创建 proposal 与 tasks，校验并归档 |
| AI 助手 / 画布 Agent | `AGENTS.md` | `docs/ai-assistant/AI_ASSISTANT_ROADMAP.md`、`docs/ai-assistant/RUNBOOKS.md` | ToolRegistry、CanvasRuntimeState、权限、测试、知识更新 |
| 下载选中卡片 / 打包原图 | `AGENTS.md` §8、§9 | `docs/ai-assistant/RUNBOOKS.md` 中 `download-selected-originals` | 调用工具，不模拟 UI；ZIP manifest 完整 |
| 批量生成 / 自动整理 | `AGENTS.md` §9 | `AI_ASSISTANT_ROADMAP.md` Sprint 4、`RUNBOOKS.md` | DurableQueue、限速、幂等、确认、自动布局 |
| 多模态路由/多实例/音视频/智能CDN | `AGENTS.md` §8、§9 | `docs/ai-assistant/skills/` 目录下相关规约文件 | 精确降级/多实例独立窗口/播放器排他/SW回退 |
| 安全 / 密钥 / CORS / JWT / 计费 | `AGENTS.md` §6、§12 | `docs/governance/SECURITY_AND_BACKLOG.md` | 不泄露密钥；不绕过账务；有迁移 / 测试 / 审计 |
| 数据库结构变更 | `AGENTS.md` §13 | `migrations/`、相关测试、`SECURITY_AND_BACKLOG.md` | 只写 migrations；幂等；验证 SQL 与业务使用 |
| 文档、状态、验证整理 | `AGENTS.md` | `docs/governance/PROJECT_STATE_AND_VALIDATION.md` | 修正文档漂移；记录已验证 / 未验证 |
| 编码、乱码、PowerShell | `AGENTS.md` §15 | `docs/governance/ENCODING_AND_POWERSHELL.md` | UTF-8 without BOM、LF、显式编码、检查脚本 |


---

## 1. 不可改错的当前项目事实

1. 项目名：`KK Studio`。
2. 当前稳定版本：`v1.5.5`。
3. 版本事实第一来源：`config/release-manifest.json`。
4. 仓库名：`soudbs180-creator/nano-banana-KK-`。
5. Web 主运行时：`apps/web/`。
6. Mobile：`apps/mobile/`。
7. 共享契约：`packages/shared/`。
8. 统一 HTTP Client：`packages/api-client/`。
9. 设计系统适配：`packages/ui/`。
10. 后端运行时：`server/` Express / VPS。
11. 数据库迁移唯一合法目录：`migrations/`。
12. AI 接管雏形：`apps/web/src/features/ai-takeover/`。
13. 画布状态：`CanvasContext` / `canvasContextState`，包含 `activeCanvasId`、`selectedNodeIds`、`viewportCenter`、历史、画布列表、组、Prompt 节点、Image 节点。
14. 无限画布：`InfiniteCanvas` 暴露 transform、视口矩形、缩放、复位、全览能力。
15. `GeneratedImage` 可能包含 `url`、`originalUrl`、`apiResultUrl`、`storageId`、`mimeType`、`sourceTaskId`。
16. 下载原图解析优先级：`originalUrl -> apiResultUrl -> url -> storageId -> failedItems`。
17. 历史文档可能包含过期事实，例如 `src/`、Netlify、`payment-server`、`1.4.x`、`1.5.0`、`1.5.1`。遇到冲突时，以当前源码、`package.json`、`config/release-manifest.json`、测试脚本和本文件为准。

---

## 2. 事实优先级与冲突处理

事实优先级：

```text
当前源码和类型定义
  > package.json / config/release-manifest.json / 构建脚本
  > 自动化测试与治理脚本
  > AGENTS.md
  > docs/ai-assistant/AI_ASSISTANT_ROADMAP.md
  > README.md
  > docs/ 下的当前文档
  > 历史归档、旧计划、旧审计、旧提示词
```

冲突处理步骤：

1. 明确指出冲突文件和冲突字段。
2. 使用高优先级事实继续执行。
3. 小范围修正文档漂移，或记录到 `docs/development/session-handoff.md`。
4. 不得自行编造折中事实。
5. 高风险事项不确定时停止扩展，先交代假设与风险。

高风险事项包括：密钥、积分、退款、支付、Stripe Webhook、JWT、CORS、Provider 直连、数据库迁移、生产部署、用户隐私文件。

---

## 3. Agent 工作协议

### 3.1 开始任务

每次开始任务必须执行：

```text
1. 读取 AGENTS.md 并检查 openspec/ 目录下与当前任务相关的核心能力 (Specs) 与待决变更 (Changes)
2. 按文档路由总表读取相关细则与已有功能规格书
3. 读取 package.json 和 config/release-manifest.json
4. 搜索相关源码和测试
5. 判断模块归属
6. 若涉及行为或能力变更，按 §20 要求初始化 OpenSpec 变更目录，输出包含 proposal.md 与 tasks.md 的简短计划
7. 获得用户批准后开始执行，小步修改
8. 运行相关验证，包括 openspec validate [change-id] --strict
9. 更新知识库 / handoff / 状态文档 / 归档变更
10. 给出完成范围、验证结果、未完成风险
```

### 3.2 最小变更原则

Agent 只能修改与当前任务直接相关的文件。

禁止：

- 借小问题做大重构
- 同时修改多个无关模块
- 擅自更换技术栈、状态管理、构建工具、目录结构
- 删除功能、删除测试、绕过治理脚本
- 为通过编译而降低类型安全
- 为通过测试而改测试适配错误行为
- 提交临时调试代码、真实密钥、个人路径、机器相关配置
- 用大范围格式化掩盖逻辑变更

### 3.3 工具优先，不模拟 UI

AI 助手、Agent Runtime 和自动化工作流不得模拟人在输入框逐条输入、点击、等待来完成批量任务。

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

只要项目已有或应有函数、Context API、服务接口或 Tool API，就必须直接调用能力。

### 3.4 LLM 权限边界

LLM 只能负责：

```text
理解意图 -> 生成计划 -> 输出结构化工具调用 -> 总结结果
```

执行必须经过：

```text
IntentGate -> Planner -> ToolRegistry -> PermissionPolicy -> Executor -> Verification -> Memory / Knowledge Update
```

LLM 永远不得直接读写密钥、生产数据库、付款状态、积分余额、Webhook Secret、任意文件系统或部署环境。

### 3.5 可恢复性

复杂任务必须留下：

- 已修改文件
- 当前设计决策
- 已运行验证
- 未运行验证及原因
- 未完成步骤
- 下一步最小操作

对于规范驱动开发（OpenSpec），复杂变更必须留存 `openspec/changes/<change-id>/tasks.md`，并在每次会话结束时同步已完成的任务状态（标记为 `- [x]`），未完成的任务保持 `- [ ]` 或者是 `- [/]`。

优先写入：

```text
docs/development/session-handoff.md
docs/ai-assistant/session-memory.md
openspec/changes/<change-id>/tasks.md
```

根目录 `implement.md`、`status.md`、`validation.md` 只记录里程碑级事实；如果迁移到 `docs/governance/`，同步更新引用。

---

## 4. 修改前归属判断

| 需求 | 应修改位置 | 禁止事项 |
|---|---|---|
| Web 页面、桌面端交互、无限画布 | `apps/web/` | 禁止引入 RN / Expo；禁止直接写数据库 |
| 移动端原生交互 | `apps/mobile/` | 禁止直接调用 DOM / BOM 专属 API |
| 类型、DTO、枚举、共享契约 | `packages/shared/` | 禁止 React、DOM、RN、Node 专属 API |
| HTTP 请求、鉴权、Session、跨端 API | `packages/api-client/` | 禁止平台存储硬编码；必须依赖注入 |
| 设计 Token、基础组件、UI Bridge | `packages/ui/` | 禁止业务状态和模型调用逻辑 |
| API 代理、计费、Stripe、数据库访问 | `server/` | 禁止引入前端组件；禁止弱默认密钥 |
| 数据库结构变化 | `migrations/` | 禁止在业务代码中执行 DDL |
| AI 接管能力 | `apps/web/src/features/ai-takeover/` 或 `apps/web/src/features/ai-assistant-runtime/` | 禁止另起平行助手 |
| AI 知识、流程、Runbook | `docs/ai-assistant/` | 禁止只改 UI 不更新知识 |
| 状态、验证、审计、编码 | `docs/governance/` | 禁止用历史事实覆盖当前事实 |

跨层需求顺序：

```text
shared 契约 -> api-client -> server -> app 层 -> tests -> docs / handoff
```

---

## 5. 目录职责与模块边界

```text
nano-banana-KK-/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/                 # 应用级 hooks、运行态编排、响应式入口
│   │       ├── components/          # UI 组件，含 canvas/layout/mobile/ecommerce
│   │       ├── context/             # Canvas/Auth/Billing/Startup 等 React Context
│   │       ├── features/
│   │       │   ├── ai-takeover/     # 当前 AI 接管雏形，必须兼容演进
│   │       │   └── assets/          # 资源池、ZIP 输出、敏感文件扫描
│   │       ├── hooks/               # 生成、任务恢复、UI 状态 hooks
│   │       ├── services/            # LLM、存储、认证、账单、API、系统日志等服务
│   │       ├── types/               # GeneratedImage / PromptNode / Canvas 等
│   │       ├── utils/               # 布局、模型展示、图像恢复、PPT、电商工具
│   │       └── workflow/            # 实验性工作流图能力
│   └── mobile/                      # Expo 移动端
├── packages/
│   ├── shared/                      # 跨端纯 TS 共享契约和领域逻辑
│   ├── api-client/                  # 统一 HTTP 客户端
│   └── ui/                          # 设计令牌与 UI 适配层
├── server/                          # Express / VPS 后端与代理路由
├── migrations/                      # PostgreSQL DDL 唯一合法来源
├── docs/                            # 项目文档、架构记录、开发交接
├── scripts/                         # CI、治理、发布、测试与维护脚本
├── tests/                           # 单元、集成、契约、E2E 测试
├── config/                          # release manifest 与项目配置
├── AGENTS.md                        # 本文件
└── README.md                        # 项目入口说明
```

硬规则：

- `packages/shared` 必须保持平台无关。
- `packages/api-client` 只能定义 HTTP / Session 边界，不直接绑定某平台存储。
- `server` 是计费、退款、Stripe、Provider 代理、文件落盘的权威执行层。
- `migrations` 是 Schema 变更唯一入口。
- `apps/web/src/features/ai-takeover` 是现有助手兼容入口，不能绕开重建竞争系统。

---

## 6. 安全、密钥、积分与隐私红线

### 6.1 永远禁止

Agent 永远不得：

```text
读取 / 记录 / 上传 / 复述 API Key
读取 / 记录 JWT、Cookie、Password、Stripe Secret、Webhook Secret、数据库连接串
填写用户密钥
把用户密钥放入日志、Prompt、Knowledge、Runbook、测试快照
绕过积分扣减
绕过退款审计
绕过 Stripe Webhook 验签
直接修改生产账单或余额
浏览器端直连受保护 Provider
```

### 6.2 LLM 上下文脱敏

发送给 LLM 的内容必须脱敏、摘要、按需检索。不得把完整 base64、长随机串、用户凭证、私密文件、完整 Provider 配置塞进 prompt。

### 6.3 积分与支付

系统积分扣减、退款、余额、支付状态以后端权威结果为准。

标准链路：

```text
预扣积分 -> 调用 AI -> 成功结算 / 失败退款 -> 写入审计
```

规则：

- 文生图、图生图、对话等成本常量必须集中定义。
- 余额扣减必须原子化，防止并发负数。
- Stripe Webhook 必须使用原始请求体验签。
- 失败退款不能 silent catch。
- 积分流水应可用于客服追查。

---

## 7. AI 助手目标架构

KK Studio 的最终助手是项目级、画布级、任务级 Agent。

目标链路：

```text
用户自然语言
  -> CanvasRuntimeState
  -> ProjectKnowledge
  -> IntentGate
  -> Planner
  -> ToolRegistry
  -> PermissionPolicy
  -> Executor
  -> DurableJobQueue
  -> Canvas / Assets / Generation 更新
  -> Memory / KnowledgeSync / Skills
```

### 7.1 已有基础必须复用

```text
LocalAssistantBrain
LLMBrain
analyzeIntent
executeAction
safetyPolicy
confirmationPolicy
buildSanitizedProjectContext
useAssetStore
zipOutputs
CanvasContext
useTaskRecovery
taskPersistence
```

升级方向：

```text
ai-takeover -> AgentRuntime -> ToolRegistry -> DurableQueue -> KnowledgeSync
```

### 7.2 必须补齐

1. 项目知识库：模块地图、流程地图、工具索引、规范索引。
2. 画布运行态：viewport、transform、active tool、recent events、选区对象详情、UI 布局签名。
3. ToolRegistry：声明式、权限化、审计化、可测试。
4. 持久批量任务队列：限速、幂等、暂停、恢复、重试。
5. 选中卡片原图下载：真实选区过滤、Prompt 子图解析、原图优先级。
6. 知识自更新：UI、Flow、Tool、调试结论变化后更新 docs / Skills / handoff。

详细 Sprint 见 `docs/ai-assistant/AI_ASSISTANT_ROADMAP.md`。

---

## 8. CanvasRuntimeState 协议

AI 助手理解“我在画布干嘛”必须依赖结构化运行态。

```ts
type CanvasRuntimeState = {
  projectVersion: '1.5.5';
  currentPage?: 'canvas' | 'settings' | 'agent' | 'unknown';
  userId?: string;
  canvasId: string;
  canvasName?: string;
  canvas?: {
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
    center?: { x: number; y: number };
    rect?: { width: number; height: number };
  };
  selection: {
    selectedNodeIds: string[];
    promptNodeIds: string[];
    imageNodeIds: string[];
    childImageNodeIdsFromSelectedPrompts?: string[];
    groupIds: string[];
    count: number;
  };
  selectedNodes?: {
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
  activeTool?: 'select' | 'pan' | 'generate' | 'edit' | 'redraw' | 'unknown';
  recentEvents: Array<{
    id?: string;
    type: string;
    targetIds?: string[];
    timestamp: number;
    summary?: string;
  }>;
};
```

选区解释：

- “这些卡片”“选中的卡片”“我框选的卡片”“当前选区” => `selectedNodeIds`。
- 下载图片时只下载选区内图片节点。
- 选区包含 Prompt 节点时，解析其子图像节点。
- 同时选中 Prompt 与子图时去重。
- “刚刚生成的图”优先 recentEvents，其次 imageNodes timestamp。
- “当前画布”指 `activeCanvasId` 对应画布，不是所有画布。
- “整理一下”默认当前选区；无选区时才整理当前画布。

UI 位置变化时必须同步：运行态字段、selector、action handler、帮助文案、`docs/ai-assistant/ui-map.md`、回归测试。

---

## 9. ToolRegistry 规范

### 9.1 命名空间

```text
canvas.getState
canvas.getSelectedNodes
canvas.createPromptCards
canvas.createImageCards
canvas.createAudioCard
canvas.updateNodes
canvas.arrangeNodes
canvas.locateNodes
assets.resolveOriginals
assets.zipOriginals
generation.createBatchJob
generation.getJobStatus
generation.pauseJob
generation.resumeJob
generation.submitComposer
provider.getModelCapabilities
audio.playbackControl
ui.openToolWindow
ui.pinTool
ui.updateWindowLayout
knowledge.searchProject
knowledge.recordChange
skills.upsertSkill
ui.recordLayoutChange
```

### 9.2 工具声明

```ts
type ToolPermission = 'safe' | 'confirm' | 'dangerous' | 'forbidden';

type AgentToolDefinition<Input = unknown, Output = unknown> = {
  name: string;
  description: string;
  permission: ToolPermission;
  inputSchema: unknown;
  outputSchema: unknown;
  handler: (input: Input, ctx: AgentExecutionContext) => Promise<Output>;
};
```

### 9.3 调用日志

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

日志必须脱敏，不得记录密钥、JWT、Cookie、Password、Stripe Secret、Webhook Secret、数据库连接串、完整用户隐私原文、完整 base64。

### 9.4 权限矩阵

| 权限 | 示例 | 执行规则 |
|---|---|---|
| `safe` | 读状态、定位、非破坏性整理、下载已有文件 | 可自动执行 |
| `confirm` | 批量生成、上传、扣积分、覆盖输出、读取文件内容 | 必须确认 |
| `dangerous` | 删除、清空、发布、部署、批量替换 | 必须二次确认并显示影响范围 |
| `forbidden` | 读取/填写/上传密钥、绕过积分、直接改生产账单 | 永远拦截 |

---

## 10. 核心业务流规则

### 10.1 下载选中卡片原图

触发表达：

```text
下载选择的卡片
我要打包这些图
把我框选的卡片原图下载
下载当前选区原图
```

执行链路：

```text
canvas.getState
  -> canvas.getSelectedNodes
  -> 解析 Prompt 子图与 Image 节点
  -> assets.resolveOriginals
  -> assets.zipOriginals
  -> 返回下载结果
```

原图优先级：

```text
image.originalUrl -> image.apiResultUrl -> image.url -> image.storageId -> failedItems
```

ZIP 必须包含原图文件与 `manifest.json`，manifest 至少包含：`nodeId`、`parentPromptId`、`promptSummary`、`model`、`createdAt`、`sourceKind`、失败原因。

### 10.2 批量生图并放入画布

触发表达：

```text
批量生成 30 张头像，整理成卡片组
对这个文件夹每张图都生成一个商品主图
```

执行链路：

```text
IntentGate
  -> Planner 生成 BatchGenerationPlan
  -> ConfirmationPolicy 确认成本 / 上传 / 数量
  -> generation.createBatchJob
  -> DurableJobQueue 按并发与速率执行
  -> 保存 originalUrl / storageId
  -> canvas.createImageCards / addImageNodes
  -> canvas.arrangeNodes
  -> group / tag 标记 batchId
  -> knowledge.recordChange
```

默认限制：

```text
defaultConcurrency = 3
maxConcurrency = 8
maxBatchSize = 100
retryAttempts = 3
retryBackoffMs = 2000
requireIdempotencyKey = true
```

### 10.3 整理卡片

- 有选区：只整理选区。
- 选中单个 Prompt 且有子图：调用 `arrangeSingleSelectedPromptChildren`。
- 选中多个组或多张卡片：调用 `arrangeSelectedGroupedNodes` 或 `arrangeSelectedRootNodes`。
- 整个画布整理：调用 `resolveCanvasAutoArrangePositions`。
- 自动化批量输出：打 `automation` tag，进入自动化轨道。

### 10.4 优化提示词

“优化提示词”“润色提示词”“给我提示词”“帮我改 prompt”默认只输出文本，不生成图片。

只有用户明确说“生成”“出图”“跑图”“发送”“执行”时，才可进入生成流程。

---

## 11. 知识库、Runbooks 与自更新

第一阶段不是微调，而是工程化知识系统：

```text
项目代码索引 + 模块地图 + 流程地图 + 画布运行态 + 工具注册表 + 记忆 + Skills / Runbooks
```

建议目录：

```text
docs/ai-assistant/
├── README.md
├── AI_ASSISTANT_ROADMAP.md
├── RUNBOOKS.md
├── module-map.md
├── flow-map.md
├── tool-registry.md
├── canvas-runtime-state.md
├── ui-map.md
├── skills.md
├── safety-policy.md
└── session-memory.md
```

以下变化必须更新知识库或 handoff：

- 新增 / 修改 AI 助手动作
- 新增 / 修改 Tool
- 修改画布操作、UI 入口、按钮、面板位置
- 修改生成、批量、下载、整理流程
- 新增 Provider 或修改模型能力
- 修改限速策略、资产存储、原图恢复、ZIP 导出
- 修复用户调试中发现的关键行为

更新内容至少包括：变更点、影响模块、新工具或新流程、旧行为是否废弃、验证方式、下一次 Agent 如何使用。

---

## 12. 后端、安全与计费整改入口

安全与后端整改细节统一进入：

```text
docs/governance/SECURITY_AND_BACKLOG.md
```

执行优先级：

1. 去除旧后端 / 旧部署残留，收口到当前 `server/` Express / VPS 事实。
2. 移除所有硬编码密钥 fallback，缺失必需 env 时拒绝启动。
3. CORS 使用 Origin 白名单，不使用 `Access-Control-Allow-Origin: *` 搭配 Authorization。
4. 统一积分成本和 `server/lib/credits`。
5. 修复 Gemini `aspectRatio` 参数位置与 `Modality` 枚举。
6. 增加 rate limit、JWT middleware、统一 logger、信用流水测试。
7. 数据库迁移全部走 `migrations/`。

---

## 13. 数据库与迁移

1. Schema 变更只能写入 `migrations/`。
2. 迁移必须幂等。
3. 推荐命名格式：`NNN_<description>.sql`。
4. 不得在前端、普通脚本或业务路由中执行 DDL。
5. AI 助手持久化表应规划：

```text
agent_runs
agent_tool_calls
agent_memory
knowledge_documents
knowledge_chunks
canvas_runtime_snapshots
agent_skills
```

6. localStorage / IndexedDB 只能作为 projection / cache，不得当长期权威存储。

---

## 14. UI 与设计系统

1. 保持 Glassmorphism、柔和层级、卡片质感、无限画布视觉语言。
2. 业务代码不得直接绕开 `packages/ui` 或项目 UI Bridge。
3. 新增 AI 助手面板、确认卡、任务队列面板、知识更新提示必须支持暗色 / 浅色主题。
4. 批量输出必须整齐排列，不得随机堆叠。
5. 移动端不得直接使用 DOM / BOM 专属逻辑。
6. Web 不得引入 RN / Expo。
7. UI 入口或布局变化必须同步更新 `ui-map` 与测试 selector。

---

## 15. 编码与乱码防护

完整规则见：

```text
docs/governance/ENCODING_AND_POWERSHELL.md
```

硬规则：

```text
默认编码：UTF-8 without BOM
默认换行：LF
禁止：GBK / GB2312 / Big5 / ANSI / UTF-16 / UTF-8 BOM / 乱码
例外：.bat / .cmd 可 CRLF；兼容 Windows PowerShell 5.1 且含中文的 .ps1 可 UTF-8 BOM，但必须说明原因
```

PowerShell 写文本必须显式编码：

```powershell
Set-Content -Path $Path -Value $Content -Encoding utf8NoBOM
Add-Content -Path $Path -Value $Content -Encoding utf8NoBOM
Export-Csv -Path $Path -InputObject $Data -NoTypeInformation -Encoding utf8NoBOM
```

禁止依赖默认重定向或默认 `Out-File` / `Set-Content` 写入持久文件。

---

## 16. 验证要求

优先运行：

```bash
npm run verify:changes
```

分阶段验证：

```bash
npm run architecture:check
npm run governance:check
npm run governance:security
npm run typecheck
npm run test:unit
npm run test:contract
npm run build
npm run check:encoding
```

AI 助手专项测试：

```text
tests/unit/ai-takeover-intentGate.test.ts
tests/unit/ai-takeover-safetyPolicy.test.ts
tests/unit/ai-takeover-confirmationPolicy.test.ts
tests/unit/ai-assistant-tool-registry.test.ts
tests/unit/canvas-runtime-state-builder.test.ts
tests/unit/zip-selected-originals.test.ts
tests/unit/durable-generation-queue.test.ts
tests/unit/generation-batch-idempotency.test.ts
tests/unit/agent-knowledge-sync.test.ts
```

未运行全量验证时，必须写明：已运行什么、未运行什么、原因、风险、下一步如何补验。

---

## 17. 完成定义

AI 助手能力改造任务只有同时满足以下条件才算完成：

1. 用户自然语言能被正确识别为 intent。
2. Planner 输出结构化计划。
3. ToolRegistry 能直接调用项目能力。
4. 安全策略生效。
5. 确认策略生效。
6. 画布或资产状态真实更新。
7. 批量任务可限速、可重试、可恢复。
8. 选区、视口、UI 位置被运行态感知。
9. 结果整齐排列或正确打包下载。
10. 知识库和 Skills / Runbooks 更新。
11. 测试或验证记录完成。
12. 中断后下一次 Agent 可继续。
13. 对于核心能力变更，完成 OpenSpec 规范的所有阶段（创建、执行、校验和归档），`tasks.md` 中所有任务均已标记为已完成 `[x]`，并通过 `openspec validate` 严格校验。

缺任一项，不得声称完成，只能声称部分完成。

---

## 18. 当前最高优先级整改顺序

1. 固化文档体系：`README.md`、`AGENTS.md`、`docs/ai-assistant/*`、`docs/governance/*`。
2. 建立 `docs/ai-assistant/` 知识目录。
3. 扩展 `SanitizedProjectContext` 为完整 `CanvasRuntimeState`。
4. 将 `ActionExecutor` 迁移为 `ToolRegistry + Executor` 兼容层。
5. 修复 `selected_cards` ZIP，优先下载原图。
6. 将 AI 接管内存队列升级为持久化 Batch Job Queue。
7. 建立知识索引与自动更新机制。
8. 建立项目核心能力（Capabilities）的基线规格书，并固化在 `openspec/specs/` 中。
9. 为批量生成、下载选区、整理卡片补齐测试。
10. 清理旧文档中与 v1.5.5 冲突的版本、目录、后端和部署描述。
11. 再考虑微调、蒸馏或专用模型训练。


---

## 19. 最终执行指令

```text
先读规则。
再读源码。
识别任务类型。
进入对应文档。
小步修改。
直接调用能力。
不模拟 UI。
不绕过安全。
不泄露密钥。
不乱改架构。
不提交乱码。
跑验证。
更新知识。
明确交接。
```

---

## 20. 规范驱动开发 (OpenSpec) 规范

KK Studio 引入规范驱动开发 (OpenSpec) 机制。对于涉及项目核心功能与行为的复杂变更，AI 助手必须采用 Spec-Driven 模式，确保开发质量与向后兼容性。

### 20.1 核心理念与 Quick Checklist
- **不要重复造轮子**：在新增任何功能规格前，必须首先在 `openspec/specs/` 中搜索并检查是否已有相似的能力 (Capability)。使用 `rg` 或是项目内置命令，严禁创建重复的能力定义。
- **挑选唯一 Change-ID**：使用小写连字符形式的动词引导 ID，例如 `add-canvas-minimap`、`update-generation-queue` 等。
- **模板与脚手架**：在 `openspec/changes/<change-id>/` 目录下创建 `proposal.md`、`tasks.md`、以及受影响的规格书 Delta。
- **书写 Delta 规范**：使用 `## ADDED Requirements`、`## MODIFIED Requirements` 等标志；每个 Requirement 下必须附带至少一个基于场景驱动的 `#### Scenario:` 定义。
- **从不跳过 Approval**：在 `proposal.md` 未得到用户明确批准前，严禁修改任何业务代码。

### 20.2 三阶段工作流

#### Stage 1: 创建变更提案 (Creating Changes)
- **触发条件**：当任务属于“添加新功能”、“对已有接口/Schema 进行破坏性修改”、“重大架构/设计模式重构”或“涉及安全/计费机制变更”时，必须触发该阶段。
- **豁免条件**：对于纯粹的 Bug 修复（恢复原定逻辑）、排版/格式/注释优化、非破坏性依赖升级、仅修改测试用例以覆盖现有行为等微小任务，可免除创建 OpenSpec 变更。
- **操作步骤**：
  1. 检索 `openspec/project.md` 确认项目开发共识。
  2. 生成 Change-ID，并在 `openspec/changes/<change-id>/` 创建 `proposal.md` (说明动机、影响、技术抉择) 与 `tasks.md` (任务 TODO 列表)。
  3. 执行 `openspec validate <change-id> --strict` 检验规范草案。

#### Stage 2: 执行变更 (Implementing Changes)
- **工作顺序**：
  1. 研读 `proposal.md` 与 `design.md`（如有），明确最终目标与设计约束。
  2. 研读 `tasks.md` 建立分步开发认知。
  3. 严防并发：完成任务中的单项后，及时标记为已完成 `[x]`。不得在所有工作做完前提前修改任务状态。
  4. 绝不跨过批准门槛：必须等待 Proposal 状态为 approved。

#### Stage 3: 归档变更 (Archiving Changes)
- **工作顺序**：
  1. 部署与验证完成（通过 `openspec validate --strict` 校验）。
  2. 归档变更：将 `changes/<change-id>/` 移动至 `changes/archive/YYYY-MM-DD-<change-id>/`。
  3. 将修改后的能力规范合入 `specs/` 目录下的全局真实规格书中。

### 20.3 规范目录结构与规范要求

核心能力均按照下述目录布局在项目根目录下维护：

```text
openspec/
├── project.md              # 项目总体约定与公共规范
├── specs/                  # 全局当前已实现核心能力 (Capability) 的真实规格书
│   └── [capability-id]/    # 聚焦的单项核心能力
│       ├── spec.md         # 该能力的具体 Requirement 与 Scenario 描述
│       └── design.md       # 该能力所采用的技术实现模式与接口定义
└── changes/                # 正在执行与审查中的变更提案
    ├── [change-id]/
    │   ├── proposal.md     # 变更的起因、影响范围与用户确认说明
    │   ├── tasks.md        # 变更执行的详细分步 TODO 列表
    │   └── design.md       # 变更涉及的技术决策 (可选)
    └── archive/            # 历史已归档的变更记录
        └── YYYY-MM-DD-[change-id]/
```

所有的 Capability `spec.md` 必须严谨描述：
- **Requirement**：清晰界定的具体要求。
- **Scenario**：具体的运行实例与断言（包括输入、预期输出和副作用），作为编写单元测试和集成测试的直接依据。

