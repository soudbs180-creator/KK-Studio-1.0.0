# AI 助手可执行 Skills 目录 (docs/ai-assistant/skills/)

本目录包含 KK Studio v1.5.3 中所有经过验证的 AI 助手和 Agent 可执行技能规约 (Skills)。

每一个文件描述了一个具体功能、它的触发词、调用工具以及执行与恢复步骤，供 Agent 执行任务时读取，也供 `check-skills-consistency.mjs` 静态校验工具和敏感边界校验校验使用。

## 📂 技能文件清单

1. [download-selected-originals.md](download-selected-originals.md) —— 框选原图打包 Skill
2. [batch-generate-to-canvas.md](batch-generate-to-canvas.md) —— 批量重绘生图与队列控制 Skill
3. [arrange-selected-cards.md](arrange-selected-cards.md) —— 整理卡片布局 Skill
4. [optimize-prompt-without-generation.md](optimize-prompt-without-generation.md) —— 优化提示词而不立即出图 Skill
5. [add-new-agent-tool.md](add-new-agent-tool.md) —— 增加新 AI 助手 Tool 规约
6. [update-ui-map-after-layout-change.md](update-ui-map-after-layout-change.md) —— UI 变更后同步 UI Map 规约
7. [recover-interrupted-agent-task.md](recover-interrupted-agent-task.md) —— 系统中断/异常断开后恢复任务队列 Skill
8. [security-sensitive-change.md](security-sensitive-change.md) —— 敏感配置/密钥安全隔离操作规约

## ⚖️ 设计准则
- 所有技能设计均要求**工具优先，不模拟 UI**。
- 涉及敏感操作（`confirm` 或 `dangerous`）必须在技能规约中明确防护机制。
