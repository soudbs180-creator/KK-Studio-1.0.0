Status: current

# Capability Spec: agent-capabilities

AI Agent 控制面与协作引擎多维控制能力规格书 (Agent Control Plane & Collaboration Engine Spec)。

## 1. Overview
本规格书定义 KK Studio v1.6.1 中 AI Agent 控制面的职责边界、交互契约与安全断言。AI Agent 负责意图识别 (IntentGate)、计划生成 (Planner)、动态重规划 (Bounded Replan Executor)、上下文压缩 (TokenBudget) 以及三态协作模式 (`direct|assist|takeover`)。

---

## 2. Standard Requirements

### [REQ-AGT-001] 画布实时状态只读感知 (Canvas Runtime State Sensing)

- **User Story**: 作为一个 AI 助手，我希望能感知画布当前的选区 (`selection`)、视口 (`viewport`) 和最近操作事件，以便精确理解用户的空间指代意图。
- **Preconditions**: 前端 `CanvasContext` 已就绪且页面处于活跃状态。
- **Explicit Contract**:
  - **Inputs**: `buildCanvasRuntimeState(canvas, activeSelection)`
  - **Outputs**: `CanvasRuntimeState` (只读结构体，包含选区卡片 IDs、视口包围盒、最近 5 次用户交互)
- **Source of Truth**: 前端内存 `CanvasRuntimeState`（只读视图）。
- **Measurable Acceptance Criteria**:
  - **Given**: 用户在画布上选中了 3 张节点卡片 `["card-1", "card-2", "card-3"]`。
  - **When**: 用户触发 AI 对话“帮我整理选中的卡片”。
  - **Then**: 意图解析器在 ≤1.5s 内通过只读快照提取选区 IDs，且绝不产生直接坐标写副作用；生成的 Action 结构为：
    ```json
    {
      "type": "canvas.arrangeNodes",
      "payload": {
        "nodeIds": ["card-1", "card-2", "card-3"],
        "mode": "grid"
      }
    }
    ```
- **Failure & Rollback Boundaries**: 若选区包含已销毁节点，自动过滤无效 ID；若全部无效，fail-closed 提示“选区无效”，终止 Plan 生成。

---

### [REQ-AGT-002] 受控重规划与确认策略 (Bounded Replan & Confirmation Policy)

- **User Story**: 作为一个用户，我希望能对破坏性动作进行二次确认，并在产生可恢复错误时允许 Agent 受控重规划，以便保证操作安全。
- **Preconditions**: 助手处于 `assist` 或 `takeover` 协作模式下。
- **Explicit Contract**:
  - **Inputs**: `AgentPlanStep` 包含 `verification` 和 `confirmationRequired` 标识。
  - **Outputs**: `AgentRunEvent` metadata-only 事件（追加至数据库 `agent_runs`）。
- **Source of Truth**: 服务端 `agent_runs` 与 `agent_sessions` PostgreSQL 表。
- **Measurable Acceptance Criteria**:
  - **Given**: 某生成步骤失败且错误标识为 `retryable_failure: true`。
  - **When**: Agent 触发 Bounded Replan Executor。
  - **Then**: 重新经过 fresh context、Capability/Reference、PermissionPolicy 与 confirmation 校验；服务端接受并推进 `replanCount` (单次 Run 最多 3 次)；未通过服务端证明接受前禁止启动新工具。
- **Failure & Rollback Boundaries**: 第 4 次重规划请求直接拒绝，退回终态报错；用户确认凭据 (Grant) 绑定 5 分钟超时，超时后尝试执行抛出 `CONFIRMATION_EXPIRED`。

---

### [REQ-AGT-003] 上下文预算与摘要隔离 (Token Budget & Summary Isolation)

- **User Story**: 作为一个 AI 助手，我需要严格管理输入上下文 Token 预算，以便防范 Prompt 溢出与历史杂音干扰。
- **Preconditions**: 会话包含长历史消息和附件引用。
- **Explicit Contract**:
  - **Inputs**: `SanitizedProjectContext` 与结构化 `agentSummary`。
  - **Outputs**: 不超过 64,000 UTF-8 单位的 Planner 上下文。
- **Source of Truth**: 本地与云端 Session 记录。
- **Measurable Acceptance Criteria**:
  - **Given**: 对话历史超过 20 轮。
  - **When**: 触发新一轮意图规划。
  - **Then**: 统一上下文预算器按 `20:30:20:15:10` 分配类别权重（系统规则、压缩摘要、近两轮对话、上下文快照、工具结果）；摘要与原文严格隔离，禁止重放超长原文。
- **Failure & Rollback Boundaries**: 单条消息上界溢出时，按 UTF-8 字节上界截断并保留结构摘要，保证请求不报错。
