# KK Studio AI 全站能力覆盖矩阵

Last verified: 2026-07-19  
Source of truth: `ToolRegistry.ts`、`AssistantExecutionContext.ts`、CanvasContext 与本页列出的业务入口。

## 判定规则

| 分类 | 含义 |
|---|---|
| `safe` | 只读、导航，或可恢复的低风险局部操作；接管模式可以自动执行。 |
| `confirm` | 生成、批量、费用、持久设置或较大范围修改；必须展示数量、费用与影响并由用户确认。 |
| `dangerous` | 删除或外部发布等高风险操作；必须二次确认。 |
| `manual UI` | 只改变菜单、折叠、筛选、焦点或瞬时视觉状态；不注册 Agent 工具。 |
| `forbidden` | 密钥内容、支付确认、余额写入、数据库和 Shell；不提供自治入口。 |

## 领域覆盖

| 领域 | 用户操作逻辑 | 真实业务入口 | Agent 工具 | 权限 | 当前状态 |
|---|---|---|---|---|---|
| Navigation | 打开画布、素材库、收藏、个人页、设置页 | `useWorkspaceSurface` 回调 | `navigation.openSurface`、`navigation.openSettings` | safe | 已接入类型化导航端口；旧 `ui.navigateToSurface` / `openSettings` 仅兼容。 |
| Workspace | 了解当前页面、项目、选区、Queue、Run | CanvasRuntimeState、DurableGenerationQueue、AgentRunStore | `workspace.getState`、`workspace.focus` | safe | 使用实时 getter，不创建工作区副本。 |
| Project | 列表、当前项目、打开、新建、重命名、删除 | CanvasContext | `project.list`、`project.getActive`、`project.open`、`project.create`、`project.rename`、`project.delete` | safe / confirm / dangerous | 项目 ID 在规划时冻结；删除最后一个项目被拒绝。 |
| Canvas | 读取画布/选区、创建卡片、整理、笔记与工作流卡片 | CanvasRuntimeState、CanvasContext、card factory | `canvas.getState`、`canvas.getSelectedNodes`、`canvas.arrangeNodes`、`canvas.createCard` 等 | safe / confirm | 沿用既有 ToolRegistry 领域工具，不模拟拖拽或按钮。 |
| Generation | 图片、视频、音频、批量、暂停、恢复、重试、取消、状态 | DurableGenerationQueue | `generation.createBatchJob`、`generation.createVideoJob`、`generation.createAudioJob`、`generation.getJobStatus` 等 | safe read / confirm mutation | 图片新计划统一走 `generation.createBatchJob`；旧 start/submit 名称只兼容。 |
| Assets | 读取导入素材、画布输出、选区原图，解析和打包 | AssetStore、resolveOriginalAssets、zipOutputs | `assets.list`、`assets.resolveOriginals`、`assets.zipOriginals` | safe read / confirm ZIP | `assets.list` 不返回文件内容、Object URL 或签名 URL。 |
| Export | 查询可用导出、导出原图 ZIP | 复用 assets ZIP 服务 | `export.getCapabilities`、`export.zipOriginals` | safe / confirm | `export.zipOriginals` 是 `assets.zipOriginals` 的策略同源别名，不复制 ZIP 状态。 |
| History | 查看、撤销、重做当前项目变更 | CanvasContext history | `history.getState`、`history.undo`、`history.redo` | safe | 仅操作当前项目历史栈。 |
| Preferences | 查看、更新生成默认值 | Workspace `GenerationConfig` | `preferences.get`、`preferences.updateGenerationDefaults` | safe / confirm | 只允许 mode、比例、尺寸、并行数、Prompt 优化、Grounding、搜索和 thinking mode。 |
| Account | 查看登录存在性和 Key 配置状态 | Auth runtime、KeyManager | `account.getSummary` | safe | 只返回 owner ID、登录布尔值和 masked 状态；不返回 Key/Token。 |
| Billing | 查看可展示余额 | BillingContext | `billing.getSummary` | safe | 只读；单位固定为 credits。 |
| Browser | 状态、公开 URL 检查、外部生成/草稿 | Browser Bridge | `browser.*` | safe / confirm / dangerous | 保留已硬化的公开 URL、owner 和确认边界。 |

## UI 动作映射

| UI 区域 | 代表动作 | 处理方式 | 原因 |
|---|---|---|---|
| ProjectManager | 选择、新建、重命名、删除项目 | 对应 `project.*` | 属于真实项目业务状态。 |
| ProjectManager | 自动排版、下载原图 | `canvas.arrangeNodes`、`assets.zipOriginals` | 复用画布与资源服务。 |
| ProjectManager | 打开菜单、合并弹窗、删除确认框、主题、吸附、画布模式 | manual UI | 菜单/视口/视觉开关不是 Agent 业务能力；复杂合并与清空暂不开放自治。 |
| Prompt Composer | 提交生成 | `generation.createBatchJob` | Provider 副作用必须进入 Queue；`generation.submitComposer` 只允许直接用户点击兼容路径。 |
| Prompt Composer | 展开、模型菜单、模式菜单、高级选项、局部开关 | manual UI | `PROMPT_COMPOSER_ACTIONS` 保持 `toolName: undefined`。需要持久化默认值时由 `preferences.*` 表达业务意图。 |
| Chat Shell | 会话菜单、折叠、附件菜单、历史面板、复制 | manual UI | `CHAT_SHELL_ACTIONS` 不进入自治 ToolRegistry。 |
| Agent Dock | 确认/取消 Run | AgentRuntime 控制动作 | 确认是用户授权来源，不是普通工具。 |
| Agent Dock | Queue 暂停/恢复/重试/取消 | `generation.*Job` | 使用同一 DurableGenerationQueue。 |
| Agent Dock | 折叠、资源面板、上下文压缩、定位输出、归档显示 | manual UI | 不创建第二套任务状态。 |
| Settings | 打开模块 | `navigation.openSettings` | 只负责页面导航。 |
| Settings | 存储模式、缓存清理、日志筛选/导出、充值页表单 | manual UI | 需要用户手势、影响范围不统一，或尚未建立可验证领域事务。 |
| Consumption / Admin | 充值审批、拒绝、支付确认、余额变更 | forbidden | 账户和计费只开放安全读取。 |

## 固定验收旅程

| 步骤 | 工具/运行时 | 必须保留的结构化证据 |
|---|---|---|
| 1. 打开项目 | `project.open` | 冻结的 project ID、名称。 |
| 2. 读取素材与选区 | `assets.list`、`canvas.getSelectedNodes` | 素材计数、选中节点 ID；不含文件内容。 |
| 3. 澄清目标 | Planner / IntentGate | 目标不完整时 actions 为空、零副作用。 |
| 4. 展示计划 | PermissionPolicy / confirmation card | 数量、费用类型、影响范围、可取消/可恢复说明。 |
| 5. 创建批量任务 | `generation.createBatchJob` | Run/Step 幂等键和 durable job ID。 |
| 6. 执行与恢复 | DurableGenerationQueue | job、prompt item 状态、Provider task ID、持久输出。 |
| 7. 导入画布 | Queue executor / CanvasRuntimeState | 稳定 prompt/output node ID，绑定原 canvas ID。 |
| 8. 自动整理 | Queue arrange handler / `canvas.arrangeNodes` | 实际 node IDs 和布局结果。 |
| 9. 验证失败项 | `generation.getJobStatus` | completed / failed / running / queued 精确计数。 |
| 10. 导出原图 | `assets.zipOriginals` | ZIP manifest、成功项与失败项；部分失败不得伪装全成功。 |

## 明确禁止的自治入口

ToolRegistry 不提供 `account.*` 写入、`billing.recharge*`、`billing.approve*`、`billing.confirm*`、`billing.setBalance`、`payment.*`、`keys.read`、`keys.write`、`database.*` 或 `shell.*` 工具。Assistant 可以导航用户到手动界面，但不能代替用户完成这些操作。
