Status: reference

# 快速打开设置功能 Skill (quick-open-settings-view)

- **触发词**: “帮我打开个人中心” / “帮我打开 API” / “打开日志” / “进入存储设置” / “查看计费”
- **前置条件**: 用户要求打开或查看已有本地功能入口。
- **调用工具**:
  - `ui.openSettings`
  - `openSettings`
  - `ui.recordLayoutChange`
  - `knowledge.recordChange`
- **执行步骤**:
  1. IntentGate 先在本地识别功能名，不调用云端 Planner。
  2. 将自然语言映射为稳定功能 ID：`user-profile`、`api-management`、`system-logs`、`storage-settings`、`consumption-records` 或 `dashboard`。
  3. 调用 `ui.openSettings` / `openSettings`，由底层路由打开对应设置页。
  4. 不模拟点击按钮，不依赖按钮在左侧、右侧、顶部或底部的位置。
  5. 若后续 UI 挪动按钮、重命名区域或改变 selector，必须同步 `docs/ai-assistant/ui-map.md`，并用 `ui.recordLayoutChange` 或 `knowledge.recordChange` 记录功能入口映射变化。

## 安全防护与规约

- **权限等级**: `safe`。只打开本地功能页，不读取或填写密钥，不修改账务，不上传文件。
- **模型配置**: 不需要模型配置。即使当前已配置模型，也应优先走本地能力线路，避免“打开日志/个人中心”被误判为需要配置模型。
- **底层线路优先**: AI 助手控制的是功能能力链路，不是 UI 展示位置。按钮迁移后，只要功能 ID 与工具注册表保持同步，助手仍应能执行。
