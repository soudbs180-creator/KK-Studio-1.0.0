# Design: unify-ai-collaboration-modes

## 1. 单一模式事实源

`AssistantCollaborationMode` 是 UI、Provider 和运行时共用的唯一模式契约：

| 模式 | 用户主导权 | 输入路由 | 执行语义 |
| :--- | :--- | :--- | :--- |
| `direct` | 用户直接操作 | 普通聊天与画布原生交互 | AI 不自动执行画布工具 |
| `assist` | AI 建议，用户决定 | 实时建议或用户目标进入 Agent 规划 | 可执行计划先显示预览，确认后执行 |
| `takeover` | AI 负责完成目标 | 用户目标进入完整 AgentRuntime | 低风险按策略执行，高风险等待确认 |

模式由 Provider 持有，并写入 `kk_assistant_collaboration_mode_v1`。旧布尔接口只保留为兼容适配器，不能与三态状态并行演化。

## 2. 路由与执行

### Direct

画布保持可点击、拖拽、框选和编辑；聊天输入继续走普通聊天路径。直接模式不会把普通消息隐式转换成 ToolRegistry 执行计划。

### Assist

Provider 从当前页面、`CanvasRuntimeState` 和选区派生有限数量的上下文建议。选择建议只填入输入框，不修改画布。用户提交后可以调用同一 AgentRuntime 生成计划，但任何包含可执行动作的计划都包装成执行预览并等待明确确认。

### Takeover

目标进入既有 `IntentGate -> Planner -> ToolRegistry -> PermissionPolicy -> Executor -> Verification -> Memory / Knowledge Update` 链路。`safe` / 低风险步骤可按现有策略执行；`confirm`、`dangerous`、成本显著或批量影响步骤必须取得绑定当前 run 的确认授权。

## 3. 实时上下文同步

三种模式读取同一个 `CanvasContext`。`CanvasRuntimeState` 包含当前 surface、画布摘要、视口、选区、选中节点摘要、分组和近期事件，用于生成辅助建议和 Agent 规划。

运行可能跨越多步，初始计划中的上下文快照不能长期充当画布事实。ToolRegistry 在每一步 handler 前通过 getter 重新解析 `activeCanvas`、`selectedNodeIds` 和 `CanvasRuntimeState`，并在 verification 前再次刷新。这样，用户在 AI 执行期间完成的合法直接操作可以被后续步骤和验证看到。

## 4. 共享状态与恢复

- `CanvasContext` 是直接操作和 AI 工具共同的画布写入边界。
- `DurableGenerationQueue` 持有批量生成任务；切换协作模式或折叠聊天侧栏不清空队列。
- `AgentRunStore` 持有计划、确认、执行和验证状态；Provider 初始化时恢复 pending run，并重新投影待确认计划和时间线。
- 模式使用 localStorage 持久化；存储事件同步同一浏览器中的其他页面实例。
- 模式切换不会克隆会话，不会创建第二个 AgentRuntime，也不会改变已经发出的工具确认授权范围。

## 5. UI 结构

聊天侧栏提供一个三选一的协作模式控件：直接操作、AI 辅助、AI 接管。AI 辅助模式显示“已同步当前页面/选区”的上下文建议区；建议只负责预填目标。AI 辅助和 AI 接管共用 Agent Run 时间线、确认卡片和持久队列视图。

控件应使用稳定的语义 ID 和可访问的 radio 状态，不依赖屏幕坐标。画布之上不增加阻断直接操作的全屏遮罩。

## 6. 安全与失败边界

- Assist 对所有可执行计划提升为显式确认，避免“建议”意外变成自动操作。
- Takeover 不绕过工具自身 permission、成本确认、输入校验和 verification。
- 当前页面或选区不可用时，建议退化为全画布检查或澄清问题，不猜测目标 ID。
- pending run 恢复后仍遵循原确认状态；恢复本身不等同于用户重新授权。
- 本设计复用现有工具级撤销、幂等、补偿和验证能力，不引入或宣称统一 undo 事务。
