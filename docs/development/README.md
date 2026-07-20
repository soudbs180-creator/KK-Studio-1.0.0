Status: historical

# 开发手册与会话交接 (docs/development/README.md)

本目录包含 KK Studio 项目的**具体开发指南、多厂商提供商设计、托管发布流程以及 Agent 会话交接记录**。

## 📁 目录文件清单

1. **[session-handoff.md](session-handoff.md) —— Agent 会话交接**
   - **职责**：这是一个 **Durable (持久化)** 的会话交接模版与记录。AI 助手或开发人员在结束本次 turn 时，如果任务未完全终结，应当在此文档中写入已修改文件、当前设计决策、已运行验证、未运行验证及下一步建议。
   - **适用场景**：在需要多轮对话或更换 AI/开发人员时，执行 session handoff。

2. **[gemini-agent-guide.md](gemini-agent-guide.md) —— Gemini Agent 开发指南**
   - **职责**：规范 Agent 开发及使用 Gemini 3.5/2.5 等大模型接口的运行规范与注意事项。

3. **[multi-vendor-provider-architecture.md](multi-vendor-provider-architecture.md) —— 多提供商架构**
   - **职责**：多厂商模型分发与本地 API 路由代理设计的深度实现分析。
   - **适用场景**：调整大模型路由机制、备用节点回退策略。

4. **[hosted-release-runbook.md](hosted-release-runbook.md) —— 托管发布说明**
   - **职责**：项目从代码合入、打包、测试到最终在云端/托管服务器发布的具体流程。

## 🤝 交接与合作协议

- 任何复杂的重构或新增大型模块，开发人员在下线前必须更新 `session-handoff.md`，这有助于下一班 AI 助手（如 Antigravity）直接继承前序工作的全部物理状态和未竟事项，保证开发的高效连续性。
