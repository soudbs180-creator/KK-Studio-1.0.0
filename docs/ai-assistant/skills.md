# Agent 可执行手册索引 (Skills Index) - KK Studio v1.5.7

本文件是 KK Studio v1.5.7 规范下 AI 助手的可执行技能手册 (Skills) 索引。
具体的技能细节与运行 Runbook 已被目录化拆分到 [skills/](skills/README.md) 专属子目录中，保证文档职责的清晰隔离。

---

## 🧭 可执行技能列表

1. **[框选原图打包 Skill (download-selected-originals)](skills/download-selected-originals.md)**
   - 职责：多卡片图片批量打包下载，包括原图优先级解析与 manifest 清单输出。
   - 关联工具：`assets.zipOriginals`

2. **[批量重绘生图 Skill (batch-generate-to-canvas)](skills/batch-generate-to-canvas.md)**
   - 职责：绑定已导入资源池/图片集合发起批量重绘生成，支持电商紧凑布局、比例提取、输出自动打组，并基于持久化生成队列驱动与控制任务（暂停、恢复、重试失败项、取消，含最近失败 latest_failed 自动定位）。
   - 关联工具：`generation.createBatchJob`, `ecommerce.createBatchTransformJob`, `generation.retryJob`

3. **[整理卡片布局 Skill (arrange-selected-cards)](skills/arrange-selected-cards.md)**
   - 职责：对画布上被选中卡片进行智能自动排列。
   - 关联工具：`canvas.arrangeNodes`

4. **[本地优化提示词而不出图 Skill (optimize-prompt-without-generation)](skills/optimize-prompt-without-generation.md)**
   - 职责：本地对用户输入的提示词进行词汇强化润色，但严禁自动拉起出图。
   - 关联工具：`prompt.optimizeInput`

5. **[增加新 AI 助手 Tool 规约 (add-new-agent-tool)](skills/add-new-agent-tool.md)**
   - 职责：指导如何在系统中挂载和注册新的原子动作工具。
   - 关联工具：`skills.upsertSkill`

6. **[UI 变更后同步 UI Map 规约 (update-ui-map-after-layout-change)](skills/update-ui-map-after-layout-change.md)**
   - 职责：重构界面元素时，规范更新 UI 地图位置以保障 AI 感知正常。
   - 关联工具：`ui.recordLayoutChange`

7. **[恢复中断任务 Skill (recover-interrupted-agent-task)](skills/recover-interrupted-agent-task.md)**
   - 职责：应对网络断开或刷新，自动触发未完成队列任务重启与轮询恢复。
   - 关联工具：`generation.getJobStatus`, `generation.retryJob`

8. **[安全敏感修改防护 Skill (security-sensitive-change)](skills/security-sensitive-change.md)**
   - 职责：处理密钥、数据库、安全等级与二次确认等红线操作的安全控制。
   - 关联工具：`fillApiKey`

9. **[单图生图 Skill (single-generate-to-canvas)](skills/single-generate-to-canvas.md)**
   - 职责：规范单个提示词的出图与排队机制，进行成本估算确认。
   - 关联工具：`generation.start`

10. **[快速打开设置功能 Skill (quick-open-settings-view)](skills/quick-open-settings-view.md)**
   - 职责：把“帮我打开个人中心 / API / 日志 / 存储 / 计费”等本地导航指令直接映射到底层设置路由能力。
   - 关联工具：`ui.openSettings`

---

## 🛡️ 静态分析与校验支持
本索引及子目录下的技能规范，通过静态脚本 `scripts/ai-assistant/check-skills-consistency.mjs` 与 ToolRegistry 进行双向校验，确保敏感控制等级与防护说明绝对对齐。
