# AI 助手可执行 Skills 目录 (docs/ai-assistant/skills/)

本目录包含 KK Studio v1.5.7 中所有经过验证的 AI 助手和 Agent 可执行技能规约 (Skills)。

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
9. [single-generate-to-canvas.md](single-generate-to-canvas.md) —— 单图生图 Skill
10. [quick-open-settings-view.md](quick-open-settings-view.md) —— 快速打开设置功能 Skill
11. [agent-image-understanding-routing.md](agent-image-understanding-routing.md) —— 多模态图像理解与路由降级 Skill
12. [toolbox-plugin-multi-instance-runtime.md](toolbox-plugin-multi-instance-runtime.md) —— 工具箱插件运行时多实例与常驻 Skill
13. [ppt-outline-batch-generation.md](ppt-outline-batch-generation.md) —— PPT大纲生图与幻灯片批量排版 Skill
14. [audio-multimedia-generation-playback.md](audio-multimedia-generation-playback.md) —— 音频多媒体生成与播放器并发控制 Skill
15. [smart-cdn-offline-fallback.md](smart-cdn-offline-fallback.md) —— 智能 CDN 优先加载与离线兜底 SW 路由 Skill
16. [browser-bridge-automation.md](browser-bridge-automation.md) —— Browser Bridge 外部网页控制 Skill

## ⚖️ 设计准则
- 所有技能设计均要求**工具优先，不模拟 UI**。
- 涉及敏感操作（`confirm` 或 `dangerous`）必须在技能规约中明确防护机制。
- 本地导航类操作必须控制底层功能线路，不能依赖按钮的页面位置。
