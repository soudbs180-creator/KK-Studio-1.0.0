# AI 助手与 Agent 运行时知识库 (docs/ai-assistant/README.md) - KK Studio v1.6.0

本目录是 KK Studio 的 **AI 助手与 Agent 运行态知识库**。当 AI 助手执行任务、解析选区、调用接口或对画布进行操作时，必须基于本目录的协议与 Runbook。

## 📁 目录文件清单

1. **[AI_ASSISTANT_ROADMAP.md](AI_ASSISTANT_ROADMAP.md) —— 历史路线记录**
   - **职责**：保留早期 Sprint 的决策背景。它不是当前实现的事实源；当前能力以本目录的协议、能力矩阵和 active OpenSpec 为准。

2. **[RUNBOOKS.md](RUNBOOKS.md) —— 流程操作手册**
   - **职责**：提供高频、复杂的具体流程指令。包括：**下载选区内原图**、**批量生图**、**整理画布卡片**、**添加新工具**以及**会话中断恢复**的详细 Runbook。
   - **适用场景**：AI 助手或开发人员被指派进行具体的批量操作和流程整合时。

3. **[tool-registry.md](tool-registry.md) —— 工具注册表规范**
   - **职责**：定义 AI 助手可调用的原子工具（如 `canvas.getState`、`assets.zipOriginals`）的声明规范、权限分类（`safe` / `confirm` / `dangerous` / `forbidden`）与调用日志脱敏机制。
   - **适用场景**：新增或修改助手所调用的接口。

4. **[canvas-runtime-state.md](canvas-runtime-state.md) —— 画布运行时状态**
   - **职责**：画布（Viewport、Selection、RecentEvents）状态的 JSON schema 定义。
   - **适用场景**：重构画布上下文与 AI 交互时的上下文裁剪逻辑。

5. **[flow-map.md](flow-map.md)** 与 **[module-map.md](module-map.md)**
   - **职责**：系统交互流和模块依赖树的映射，帮助 Agent 进行全局定位。

6. **[site-capability-matrix.md](site-capability-matrix.md) —— 全站 UI / 业务能力覆盖矩阵**
   - **职责**：按领域标记真实业务入口、Agent 工具、权限、仅本地 UI 动作和禁止自治能力，并固定“打开项目到 ZIP”的验收旅程。

7. **[skills.md](skills.md)** (以及 **[skills/](skills/README.md)** 专门子目录)、**[safety-policy.md](safety-policy.md)** 和 **[session-memory.md](session-memory.md)**
   - **职责**：定义助手的安全围栏与临时上下文记忆同步方式。

## 🧠 助手开发规范

- **工具优先，不模拟 UI**：严禁采用模拟人在输入框填值、点击按钮来做批量生图或下载。必须直接通过 `DurableGenerationQueue` 或 ToolRegistry 提供的业务接口进行调用。
- **选区感知**：下载和整理卡片时，必须优先获取并基于 `selectedNodeIds` 状态，而不是全量画布。
- **当前 UI 方向**：工作台视觉规范见 [architecture/DESIGN.md](../architecture/DESIGN.md)；不要从历史路线图恢复旧 UI 或建立第二套助手。
