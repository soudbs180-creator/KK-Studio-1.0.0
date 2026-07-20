Status: historical

# Change Proposal: harden-ai-control-plane

## Motivation

三态协作入口已经统一，但旧聊天侧栏仍可从 Assistant 文本自动解析 `action://` 并静默执行；执行链同时存在无类型宿主上下文、运行状态冒充用户确认、工具返回即视为目标完成、Agent 数据裸 `fetch` 以及 Knowledge/Skill 跨用户边界缺失等问题。这些旁路会让“AI 接管”失去可审计、可确认、可验证和可恢复的可信基础。

## Outcome

- Assistant 文本中的动作链接只响应用户显式点击；自治执行只接受结构化 ToolRegistry 调用。
- Web 运行时通过公开的 `AssistantExecutionContext` 传递页面、画布、选区、Queue、Run、通知、确认来源、取消信号和实时 getter。
- 修改型工具具备输入校验、幂等键、影响/费用/恢复/失败元数据和结果验证；权限按风险收紧。
- AgentRuntime 消费每个 `AgentPlanStep.verification`，持久记录成功、部分成功、可重试失败、回滚失败或取消。
- Agent Run、Tool Call、Knowledge 和 Skill 统一通过类型化 KK API Client 同步。
- Knowledge、Skill 与画布快照增加明确用户归属；仅系统 Knowledge 可跨用户只读，legacy 数据保持隔离。
- VPS bootstrap、部署和本地数据库初始化均应用 `016_ai_assistant_user_scope.sql`。

## Scope

本变更覆盖 ToolRegistry 控制元数据、AgentRuntime 确认/验证/取消、Web 执行上下文、KK API Client DTO、AI Assistant 服务端路由、数据库迁移、部署接线、相关契约测试和运行文档。

## Non-goals

- 不增加第二套助手、第二套 Queue 或第二个 ToolRegistry。
- 不开放密钥、支付状态、数据库 DDL 或任意 Shell 给 AI 自治执行。
- 不宣称所有工具具有统一事务回滚；只记录工具真实具备的取消或撤销能力。
- 不在本变更中完成全站领域工具覆盖矩阵或工作台视觉重构。

## Compatibility

保留 `AssistantCollaborationMode`、`CanvasRuntimeState`、`generation.createBatchJob`、`assets.zipOriginals` 和旧 `aiTakeoverMode` 适配器。legacy AI 数据只保留兼容标记，不自动认领、共享或覆盖；用户可见写入全部由服务端认证身份决定。
