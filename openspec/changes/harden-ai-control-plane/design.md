Status: historical

# Design: harden-ai-control-plane

## 1. 唯一执行入口

Assistant Markdown 可以展示 `action://` 链接，但 ChatSidebar 不再扫描最后一条消息并定时调用本地 action handler。显式点击仍可处理纯本地导航；任何自治画布、生成、导出或外部页面动作必须由 Planner 输出结构化 action，再进入 ToolRegistry。

## 2. 类型化执行上下文

`AssistantExecutionContext` 留在 Web runtime，因为它包含 Canvas、浏览器和 React 宿主端口。核心字段包括：

- `currentPage`、`collaborationMode` 与 `trigger`
- `runId`、`stepId`、用户来源的 `confirmationGrant`
- `AbortSignal`
- 当前画布、选区、`CanvasRuntimeState` 及实时 getter
- `DurableGenerationQueue`、`AgentRunStore` 与通知端口
- 现有画布/UI/生成宿主回调

领域工具仍有少量旧宿主回调通过渐进适配类型承载，但 Runtime 与 Registry 之间不再以裸 `any` 传递整个上下文。

## 3. 确认和取消

`waiting_confirmation` 只是 Run 状态，不是授权。确认工具必须收到同时满足以下条件的 grant：

- grant 的 `runId` 与执行 Run 一致；
- grant 的 `planId`、每个 `stepId`、工具名、幂等键和输入指纹与用户看到的计划一致；
- grant 的 owner 与开始执行时的认证 owner 一致；
- `source = user`；
- `grantedAt` 未过期；
- 页面、项目、画布、排序后的选区、模型和可变配置摘要与确认预览快照完全一致。

`plan.requiresConfirmation` 是恢复后的最终确认依据；即使持久 Run 被错误恢复为 `running` 或 `waiting_execution`，没有有效 grant 也必须回到 `waiting_confirmation`。确认后改变账号、画布或任何冻结范围都会 fail closed，不能在“预览 A”后执行到 B。外部浏览器检查和 DOM 写回只接受计划中冻结的公开 HTTP(S) URL；AI 输入拒绝 `active_tab`、current/focused/selected page 和未签发的 opaque Tab ID。`active_tab` 只保留给 Browser Assistant 内用户即时点击的非 Agent Bridge 命令。

“最近失败批次”只是一种意图层相对语义。AgentRuntime 必须在 PermissionPolicy 和 `AgentRunStore.createRun` 之前，从当前 owner 的 `DurableGenerationQueue` 读取一次具体 Job，并把 `jobId`、`updatedAt` 与排序后的可重试 Prompt ID 集合写入 actions 与 steps。`generation.retryJob` 的执行输入不接受空对象或 latest/current selector；快照发生变化时返回 `STALE_RETRY_TARGET` 并要求重新确认，不能在 handler 中重选 Job。

用户直接点击确认型本地入口时，通过 `createUserActionConfirmation` 生成一次性 user-action grant。运行中取消会触发该 Run 的 `AbortController`；当前 handler 返回后以及异步 verifier 返回后 Registry 都会再次检查 signal，Executor 不再启动依赖步骤，最终状态保持 `cancelled`。即使 handler 在取消后以普通网络错误 reject，abort signal 也优先决定 Tool Call 的取消分类。终态 Run 不接受迟到的取消请求，避免将 `completed` 或 `failed` 改写为 `cancelled`。

有真实取消工具的副作用使用 Run 级 recovery ledger 恢复。Runtime 只扫描已经开始或从持久 Run 恢复为已完成的步骤，不得仅凭未来计划步骤的幂等键取消既有任务。补偿不是可传入 Registry 的通用授权：Runtime 只能针对 ledger 中与已开始步骤幂等键精确匹配的 `DurableGenerationQueue` Job 调用内部取消服务。Runtime 在用户点击取消时立即扫描一次，并在被中止的 handler 返回或拒绝后再次扫描，从而覆盖“请求已中止但 Durable Job 稍后才落盘”的竞态，同时不触碰尚未开始步骤碰巧匹配的任务。账号在 await 期间切换时，原 owner 的 Run 被记录为取消，此后不再执行工具或补偿；待该 owner 再次登录时再同步其终态。

## 4. 工具控制元数据

注册后的工具使用规范化定义：

```text
effect: read | navigation | mutation
impact: scope + summary + cardinality
cost: kind + summary
recovery: cancellable + reversible + retryable + optional cancel tool
idempotency: required + key field
failure: categories + default retryability
```

修改型工具必须有对象输入校验、幂等键和 `verify`。旧工具没有显式实现时，Registry 依据 JSON Schema 注入基础校验和保守结果验证；领域验证器优先。`safe` 修改仅限声明可撤销的局部操作；生成、重试、提交 composer、ZIP 以及不可撤销的 Knowledge/Skill/UI 投影写入为 `confirm`，外部发布和 DOM 写回为 `dangerous`，密钥填充为 `forbidden`。

Browser Bridge 外部副作用把 Registry 幂等键同时写入 command 与 payload，并由键派生稳定 command ID；同一页面内相同键的执行会合并为一个 Promise，失败或 setup-required 结果允许重试。跨刷新时守护进程仍可用稳定 command ID/幂等键去重。

Browser Bridge 的原生响应按执行开始时的 owner 与 command ID 绑定。原始 WebSocket 消息不写 Console，也不通过 page-wide `CustomEvent` 广播；需要异步进度的 UI 只能订阅自己发起的 command。Browser session 与选择状态使用 owner-qualified key，账号切换会停止旧 owner 的 pending 响应投递。

Queue 的 pause/resume/retry/cancel 在复用幂等结果前必须再次读取 `DurableGenerationQueue` 验证当前领域状态；缓存输出不能覆盖实时 Job。`workflow.controlPanel` 的 run/retry 目前只接受直接 `user-action`，AI 计划不得借一个已确认父工具执行未列入计划的实时子工具；后续如开放自治工作流，必须先展开并冻结全部子步骤和输入。

## 5. 双层验证

ToolRegistry 的 `verify` 负责工具内结果校验；`verifyAgentPlanStep` 额外消费 Planner 的语义规则：

- `tool`：必须存在成功的工具验证日志；
- `queue_job`：输出或 Queue 中必须存在对应持久任务；
- `canvas_state`：必须取得新鲜画布证据或结构化变更结果；
- `asset_manifest`：必须返回真实的结构化 manifest/数量/条目；布尔占位不构成证据，成功数为零且存在失败项时为可重试失败；
- `none`：只跳过计划级验证，不跳过工具内验证。

每步记录 `success | partial_success | retryable_failure | rolled_back_failure | cancelled`。部分失败使 Run 成为 `completed_with_errors`；其余失败或取消在完成依赖图前终止。

## 6. API Client 与持久化

共享契约新增 Agent Run、Tool Call、Step Result、Knowledge、Skill 与 owner scope DTO。`KkApiClient` 提供：

- `upsertAgentRun`
- `recordAgentToolCall`
- `recordKnowledgeChange`
- `searchAgentKnowledge`
- `upsertAgentSkill`
- `deleteAgentSkill`

Tool Call 审计日志、Handoff 投影与 Browser Bridge session/选择状态同样按执行开始时的 owner 分区。Handoff 动态文本在最终写入前统一脱敏、限长和 Markdown 转义；Node 文件输出默认关闭，只允许显式开发者 opt-in。ToolRegistry 的跨刷新幂等缓存只持久化安全 receipt 字段，不保存任意原始工具输出。

Agent Run history uses an owner-qualified browser key. The latest snapshot keeps a durable pending marker until the typed API acknowledges the same monotonic `updatedAt`; reload and online recovery rebuild the per-Run serialized synchronization queue from that store. Knowledge、UI layout Knowledge 与 Skill 的本地投影和待重试队列也按 owner 分区；同 owner 多标签页保存投影时按记录版本合并，删除版本取最大值并在写回前过滤旧 Skill；pending 队列的读取、入队、确认与调度也都从 owner 持久状态重新读取，避免缓存快照覆盖另一标签页的删除重试。异步失败会回写到发起操作的 owner，而不是请求结束时恰好活跃的账号。重试调度在每个 await 前后复核 owner，切换账号会停止旧 owner 批次。Skill 的本地时间戳单调递增，重复 pending 项以最新 payload 替换；直接同步和重试调度的成功回执都只确认实际发送的 `updatedAt`，旧请求晚到时不能清除新版 pending。删除会按名称和 ID 持久化一个比被删 Skill 更新的本地版本，屏蔽仍在飞的旧 upsert 重试；服务端 `agent_skill_versions` 以 `(user_id, skill_key=name)` 为单调版本闸门，在单条 SQL 中决定 upsert/delete。名称冲突保留既有 canonical ID，不同标签页生成不同临时 ID 也不能绕过同名删除。一个 Skill ID 首次建立后名称不可变；改名必须显式创建新的逻辑 Skill，避免旧名称版本闸门在改名、删除和迟到重放之间被绕过。

浏览器投影不使用会互相覆盖的单一快照作为并发协议。每次 projection 或 pending 写入先创建一个 owner-qualified、唯一命名的可合并快照分片，再更新兼容基线；写入者只清理本次读基线前已经枚举到的旧分片，因此并发标签页在其读阶段之后创建的分片不会被误删。后续读取合并基线与全部幸存分片，按单调版本、确定性内容 tie-break 和记录/逻辑任务墓碑收敛；下一次无冲突写入再压实已观察分片。Skill 删除在网络请求前先把 canonical name、ID 和版本写入 pending，重复删除复用该 payload，迟到失败不得降低版本。服务端成功或 stale 回包中的 canonical Skill 会作为权威投影合并；若同版本内容冲突，权威回包获得新的本地投影版本，但不能越过更晚的本地删除或更新。

Web runtime 不再直接 `fetch('/api/ai-assistant/...')`。服务端从认证请求派生 `user_id`，忽略客户端伪造 ownership。`x-kk-temp-user-id` 只在显式 `KKAI_LOCAL_ONLY=true` 时有效；缺少 `NODE_ENV` 不能隐式开启本地身份或本地管理密码旁路，VPS 同时固定 `NODE_ENV=production` 作为纵深防御。

Tool Call ID 冲突不能静默 `DO NOTHING` 后假报成功：服务端必须确认冲突行仍属于同一用户和 Run，否则返回冲突。路由内部异常只返回稳定错误码和通用消息；ToolRegistry 的审计摘要递归脱敏对象字段、URL 查询参数和自由文本中的 token、key、password、cookie 与 authorization 值。

## 7. 用户隔离迁移

`016_ai_assistant_user_scope.sql` 给 Knowledge、Skill 和画布快照增加 `user_id` 与 `owner_scope`：

- `system`：仅系统 Knowledge 可作为跨用户只读内容；
- `user`：必须带用户 ID，只能由本人查询和修改；
- `legacy`：旧数据不猜测归属，也不进入普通用户查询。

Skill 使用 `(user_id, name) WHERE owner_scope='user'` 的部分唯一索引，删除和更新同时约束 user scope。迁移还持久化 Run step results 和 Tool Call 失败分类，并自行补齐旧 `agent_runs.user_id`、legacy 回填和索引，因此不依赖 015 已预先执行。整个 016 以有限锁等待和语句超时在单个数据库事务中提交，并由 bootstrap/deploy/setup 路径显式应用。

`agent_skill_versions` 仅保存用户、Skill 逻辑名称、最新版本和删除标记，不承载 Skill 内容；它为并发 upsert/delete 提供同名串行化的数据库闸门。删除 API 必须携带名称与 `updatedAt`，旧客户端或无版本删除不得绕过该闸门。

## 8. 失败与兼容边界

- 本变更不为 legacy 数据创建伪用户，也不建立依赖临时用户生命周期的 FK。
- VPS 先完成新版本构建与迁移输入预检，再停止原本 active 的 API、事务迁移并切换软链接；一旦尝试 schema migration，结果失败或不明都不得自动恢复或重启旧代码。
- 发布清单保存完整 commit SHA，release 目录只使用独立的短 SHA。所有已安装的受管 systemd 单元在迁移前都执行 stop；ActiveState 查询失败或未知状态一律中止发布。
- 工具声明可撤销仅代表真实本地能力；外部副作用默认不可撤销。
- 离线时本地 Run/Knowledge 投影继续工作，类型化 API 同步失败进入既有重试队列。
- Node 测试环境禁止 Handoff writer 修改真实项目文档。
