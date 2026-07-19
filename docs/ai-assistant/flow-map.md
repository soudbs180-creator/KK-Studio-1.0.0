# 流程地图 (Flow Map)

本文件整理了 KK Studio v1.6.0 的核心工作流流转路径。

---

## 0. 三态协作总流程 - 2026-07-15

```mermaid
flowchart TD
    User["用户继续操作或输入目标"] --> Mode{"AssistantCollaborationMode"}

    Mode -->|direct| DirectCanvas["点击、拖拽、框选、编辑画布"]
    Mode -->|direct| NormalChat["普通聊天"]
    DirectCanvas --> CanvasContext["共享 CanvasContext"]

    Mode -->|assist| LiveContext["读取当前页面、选区与 CanvasRuntimeState"]
    LiveContext --> Suggestions["生成上下文建议"]
    Suggestions --> Composer["点击建议只填入可编辑目标"]
    Composer --> AssistPlan["AgentRuntime 生成执行预览"]
    AssistPlan --> AssistConfirm{"用户确认？"}
    AssistConfirm -->|否| KeepEditing["继续编辑或返回直接操作"]
    AssistConfirm -->|是| ConfirmedExecution["按确认范围执行"]

    Mode -->|takeover| Runtime["IntentGate → Planner → ToolRegistry → PermissionPolicy"]
    Runtime --> Risk{"权限与影响评估"}
    Risk -->|低风险| Executor["Executor → Verification → Memory / Knowledge Update"]
    Risk -->|高风险、批量、成本或外部副作用| TakeoverConfirm{"等待 run-bound 确认"}
    TakeoverConfirm -->|用户授予 run-bound 权限| Executor
    TakeoverConfirm -->|取消| Cancelled["记录取消，不执行工具"]

    ConfirmedExecution --> Executor
    Executor --> CanvasContext
    Executor --> Queue["共享 DurableGenerationQueue"]
    Runtime --> RunStore["共享 AgentRunStore"]
    AssistPlan --> RunStore
    RunStore --> Timeline["确认卡片与运行时间线"]
    CanvasContext --> Refresh["下一工具步骤前重新读取画布、选区与运行态"]
    Queue --> Refresh
```

规则：

- 三条路径由唯一的 `direct | assist | takeover` 状态互斥选择，不允许独立开关同时开启辅助与接管。
- 直接模式保持普通聊天和画布原生操作；AI 辅助只建议并在执行前确认；AI 接管负责完整任务，但不绕过 PermissionPolicy。
- 三态共享 `CanvasContext`、`DurableGenerationQueue`、`AgentRunStore` 和当前会话。切换模式不会复制数据或丢失 pending run。
- ToolRegistry 在每一步 handler 和 verification 前获取新鲜上下文，使 AI 能看到用户在运行期间完成的合法直接操作；已确认的工具目标范围不会因刷新而被隐式扩大。
- 确认授权必须来自用户动作，并绑定 owner、Run、Plan、Step、输入、幂等键以及预览时的页面、项目、画布、选区、模型与可变配置摘要；恢复 `waiting_confirmation` 或错误的 `running` 状态本身不能生成授权。
- 每个计划步骤都执行输入校验、幂等保护和显式 verification。运行结果区分成功、部分成功、可重试失败、已回滚失败与取消。
- 取消会中止当前执行信号；handler 和异步 verifier 返回后都会复查信号，且 abort 优先于迟到的普通网络错误分类。内部补偿只扫描已经开始的步骤，并以 recovery ledger 的幂等键精确匹配 `DurableGenerationQueue` Job 后直接取消，不创建可复用的 recovery grant；被中止 handler 落定后会复扫一次。依赖步骤不会继续启动，终态 Run 不接受迟到取消；Agent Run 和 Tool Call 通过类型化 KK API Client 同步。
- 本流程不新增跨工具统一 undo 事务；失败处理继续采用现有工具级验证、幂等、补偿或画布撤销能力。

## 0.1. Global Favorites And @ Reference Flow - 2026-06-05

User trigger examples: typing `@` in PromptBar, ChatSidebar, or AI takeover dock; clicking a favorite prompt/image; clicking the heart action on an image or Prompt card.

```mermaid
graph TD
    FocusedComposer[Registered composer focus] --> Registry[favoriteComposerRegistry]
    UserAt[User types @] --> Panel[ReferenceMentionPanel]
    Panel --> UploadTab[Uploaded: PromptBar refs + assistant asset pool images/files]
    Panel --> TagTab[Tags: loaded canvas images with image tags or inherited Prompt tags]
    Panel --> LikedTab[Liked: global favorite images]
    LikedLibrary[Draggable FavoritesPanel floating window] --> Registry
    Registry --> PromptBar[PromptBar composer]
    Registry --> Assistant[ChatSidebar composer]
    Registry --> Dock[AI takeover dock composer]
    PromptBar --> PromptRefs[Insert @name and add image to config.referenceImages when image attachable]
    Assistant --> AssistantContext[Insert @name and attach image/file context when available]
    Dock --> DockContext[Insert @name and rely on takeover resource pool or favorite mention]
    PromptRefs --> Submit[Generation submit]
    Submit --> ParseMentions[parse @name and @name[dimension]]
    ParseMentions --> ReorderRefs[Reorder referenceImages by mention order]
    ReorderRefs --> Mapping[Append internal Reference mapping summary]
    Mapping --> Generation[Run existing generation transaction]
```

Rules:

- Inserted text stays natural: `@Name`.
- User-authored dimensions such as `@Name[face]` are preserved in the internal mapping summary.
- Non-image files are assistant context only. PromptBar inserts the text label but does not attach the file to image generation.
- Favorite deletion removes only the favorite record and mirror blobs. It must not delete the original canvas image.
- Favorite image rename updates the favorite display name; if the source image node is loaded, update `GeneratedImage.alias` so search can find it.
- The heart Favorites surface is not the `@` popup. Favorites opens as a draggable floating collection window with Chinese copy; the `@` popup opens above the current token in the active composer.

## 0.2. 本地快速功能跳转工作流

用户触发：“帮我打开个人中心” / “帮我打开 API” / “打开日志”

```mermaid
graph TD
    User([用户输入本地导航指令]) --> IntentGate[IntentGate 本地识别功能名]
    IntentGate --> RouteMap[映射稳定功能 ID]
    RouteMap --> Tool[调用 ui.openSettings / openSettings]
    Tool --> SettingsRoute[底层设置路由打开目标页]
    SettingsRoute --> Done([无需模型配置，无需模拟点击])
```

功能 ID 映射：

| 用户说法 | 功能 ID |
| :--- | :--- |
| 个人中心 / 用户中心 / 我的账号 | `user-profile` |
| API / API 工作台 / 接口设置 | `api-management` |
| 日志 / 系统日志 / 运行日志 | `system-logs` |
| 存储 / 容量 / 空间 | `storage-settings` |
| 计费 / 账单 / 消费记录 | `consumption-records` |
| 设置总览 / 设置首页 | `dashboard` |

规则：UI 位置变化不改变该流程。开发者只需同步 UI Map、Skill 和 ToolRegistry 映射，AI 助手仍控制底层功能线路。

## 0.5. 简单生成持久队列工作流

用户触发：“生成一个白色产品海报” / “帮我生成一个赛博猫头像”

```mermaid
graph TD
    User([用户输入简单单次生成指令]) --> IntentGate[IntentGate 识别 submit_composer 意图]
    IntentGate --> ExtractPrompt[提取提示词主体]
    ExtractPrompt --> Plan[构造仅含一个 prompt item 的 generation.createBatchJob]
    Plan --> Preview[展示模型、数量、费用与画布影响范围]
    Preview --> Confirm{用户确认？}
    Confirm -->|否| Cancel[保留画布，不提交任务]
    Confirm -->|是| Queue[写入 DurableGenerationQueue]
    Queue --> Canvas[完成后导入当前 CanvasRuntimeState]
```

AI 自治的单张与批量生成都走 `generation.createBatchJob` 和同一个持久队列，不模拟 PromptBar，也不调用 `generation.submitComposer`。普通 PromptBar 仍保留给用户直接操作。若用户要求“每张参考图分别生成”或“文件夹每张图都做一张”，Planner 扩展 prompts 和影响范围后进入同一确认流程。

## 1. 下载选中卡片原图工作流

用户触发：“打包下载我选中的图” / “下载这些卡片的原图”

```mermaid
graph TD
    User([用户在画布框选卡片并输入下载指令]) --> IntentGate[IntentGate 识别下载意图及 scope=selected_cards]
    IntentGate --> FreezeSelection[冻结预览时 selectedNodeIds 并写入工具输入]
    FreezeSelection --> Confirm{用户确认范围？}
    Confirm -->|否| Cancel[不创建 ZIP]
    Confirm -->|是| ToolCall[调用 assets.zipOriginals 工具]
    ToolCall --> ParseImages[按冻结选区解析图片卡片及 Prompt 卡片的子图像]
    ParseImages --> Deduplicate[卡片去重并收集 GeneratedImage 对象]
    Deduplicate --> ResolveOriginal{解析原图源}
    ResolveOriginal -- 1. originalUrl 存在 --> DownloadOrig[请求下载 originalUrl]
    ResolveOriginal -- 2. apiResultUrl 存在 --> DownloadApi[请求下载 apiResultUrl]
    ResolveOriginal -- 3. url 存在 --> DownloadUrl[请求下载 url]
    ResolveOriginal -- 4. 只有 storageId --> LoadLocal[从 IndexedDB 恢复物理图文件]
    ResolveOriginal -- 5. 均不存在 --> MarkFailed[标记下载失败, 写入 failedItems]
    DownloadOrig --> Zip[加入 ZIP 压缩包]
    DownloadApi --> Zip
    DownloadUrl --> Zip
    LoadLocal --> Zip
    MarkFailed --> Manifest[写入 manifest.json 记录原因]
    Zip --> Manifest
    Manifest --> TriggerSave([通过浏览器触发 zip 下载保存])
```

### Implementation update - 2026-06-03

The selected-original download path is implemented by:

- `apps/web/src/features/assets/resolveOriginalAssets.ts`
- `apps/web/src/features/assets/zipOutputs.ts`
- `apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts`

Runtime rule: `selected_cards` never means all canvases. It means the `selectedNodeIds` frozen into the confirmed plan input; execution validates that those nodes still exist on the confirmed canvas and never substitutes a newer live selection. Selected Prompt cards expand to their child image nodes. The ZIP source resolver tries `originalUrl`, then `apiResultUrl`, then `url`, then `storageId`, then local asset recovery. `manifest.json` is always written and returned as structured verification evidence. A manifest-only archive remains inspectable when every download fails, but the Agent step is `retryable_failure`, not partial success.

---

## 2. 批量生成并自动整理工作流

用户触发：“批量生成 30 张头像，整理成卡片组” / “帮我把这个文件夹里面的图片全部修改成紧凑的排版布局，比例改成4:5”

```mermaid
graph TD
    User([用户输入批量或电商重绘指令]) --> IntentGate[IntentGate 识别批量意图并提取比例/布局/领域]
    IntentGate --> Planner[Planner 制定 BatchGenerationPlan 和 outputGroup]
    Planner --> CostCheck[ConfirmationPolicy 评估积分消耗与成本确认]
    CostCheck --> UserConfirm{用户确认执行计划?}
    UserConfirm -- 取消 --> Cancel([取消任务并友好推荐备选方案])
    UserConfirm -- 确认 --> Tool{任务领域}
    Tool -- 电商/商品图 --> EcommerceTool[ecommerce.createBatchTransformJob]
    Tool -- 通用批量 --> BatchTool[generation.createBatchJob]
    EcommerceTool --> Queue[任务推入 DurableGenerationQueue 持久队列]
    BatchTool --> Queue
    Queue --> Loop[限速及并发控制器提取任务]
    Loop --> CreateCard[在画布中心偏移位置创建 Prompt 卡片置于 queued 状态]
    CreateCard --> ExecuteGen[调用 executeGeneration 激活倒计时与生成接口]
    ExecuteGen --> Response{服务器返回图片结果?}
    Response -- 成功 --> AddImageNode[保存原图并创建 Image 卡片连结至 Prompt 节点]
    Response -- 失败 --> Refund[回滚扣除的积分并标记 Prompt 卡片 error]
    AddImageNode --> RecordNodes[记录 promptNodeId 和 resultImageNodeIds]
    RecordNodes --> AutoArrange[canvas.arrangeNodes 只排列本 job 节点]
    AutoArrange --> GroupNodes[创建或更新一个 CanvasGroup]
    GroupNodes --> TagNode[为对应节点打上 automation 和 batch:jobId 标签]
    TagNode --> Loop
```

### Implementation update - 2026-06-05

Assistant batch output must be grouped by one conversation run or one batch job. `IntentGate` now extracts `taskDomain`, `aspectRatio`, `layoutPreset`, and `outputGroup`; commands such as “紧凑的排版布局，比例4:5” map to `taskDomain='ecommerce'`, `aspectRatio='4:5'`, and `layoutPreset='compact-grid'`.

After `generation.createBatchJob` or `ecommerce.createBatchTransformJob` creates prompt/image nodes, `DurableGenerationQueue` records each `promptNodeId`, result image node IDs, and `outputGroup`. The completion handler collects only this job's nodes, calls targeted `canvas.arrangeNodes({ nodeIds, preset })`, then creates or updates one `CanvasGroup` for that run. Store a readable group label, default `color: '#ffffff'`, and tags such as `automation` and `batch:<jobId>`.

Group control semantics:

- `group.hidden=true`: blur/hide visually only. Cards stay in render queues and connectors stay available.
- `group.collapsed=true`: compact storage strip. Member cards are filtered by `getCollapsedCanvasGroupNodeIds`.
- `group.color`: weak inner glow color, selected from the group right-click menu.
- Group drag: write live member positions first, then commit via `moveSelectedNodesImmediate`, so the frame and cards move together.

For ecommerce-style commands such as "modify all images in this folder into a compact layout, ratio 4:5", the assistant plans an ecommerce/batch generation job, not PromptBar simulation. “文件夹里面的图片” currently resolves to the imported resource pool or image collection; future local directory selection must add an explicit filesystem permission flow.
