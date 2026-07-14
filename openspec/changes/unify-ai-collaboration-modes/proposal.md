# Change Proposal: unify-ai-collaboration-modes

## Motivation

KK Studio 的画布可以直接编辑，AI 运行时也已经具备规划、权限控制、工具执行和任务恢复能力，但入口曾由多个互不约束的布尔开关控制。用户容易被引导到“只能聊天”或同时开启多个 AI 状态，页面、选区、执行计划和队列也缺少一个明确的协作模式语义。

## Outcome

- 以唯一的 `AssistantCollaborationMode = 'direct' | 'assist' | 'takeover'` 作为协作模式事实源。
- 保留直接点击、拖拽、编辑画布和普通聊天，不要求用户先进入 AI 模式。
- 在 AI 辅助模式中，根据实时页面和选区给出下一步建议；用户提交目标后只生成执行预览，确认后才执行。
- 在 AI 接管模式中，沿用 `IntentGate -> Planner -> ToolRegistry -> PermissionPolicy -> Executor -> Verification -> Memory / Knowledge Update` 完整链路；低风险步骤可执行，高风险步骤仍需确认。
- 三种模式共享 `CanvasContext`、`DurableGenerationQueue` 和 `AgentRunStore`，切换模式不会复制画布、创建平行运行时或丢失进行中的任务。
- 持久化最近一次模式并恢复未完成的 Agent Run；每个 ToolRegistry 步骤都重新读取当前画布、选区和 `CanvasRuntimeState`。

## Scope

本变更覆盖共享模式契约、AI 助手 Provider、聊天侧栏三态入口、上下文建议、执行路由、运行状态恢复、ToolRegistry 新鲜上下文以及相关规格和验证。

## Non-goals

- 不新增第二套 AI 助手或平行 ToolRegistry。
- 不放宽现有 `PermissionPolicy`、成本确认或危险工具边界。
- 不在本变更中承诺跨页面、跨工具的统一事务或统一撤销；撤销、补偿与验证仍由现有画布和工具能力分别负责。
- 不以模拟鼠标点击替代已有底层工具能力。

## Compatibility

旧的 `aiTakeoverMode` 调用仍可映射为 `takeover` / `direct`，但不再作为独立事实源。现有会话、画布对象、队列任务和 Agent Run 继续使用原存储，不因模式切换而迁移或清空。
