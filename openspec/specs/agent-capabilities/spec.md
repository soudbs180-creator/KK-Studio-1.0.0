# Capability Spec: agent-capabilities

AI 助手多维控制能力规格书。

## Requirements
1. **画布实时状态感知**：AI 助手必须通过 `CanvasRuntimeState` 获取实时的选区（`selection`）、视口（`viewport`）和最近事件（`recentEvents`），作为意图解析和动作规划的参考。
2. **物理控制画布排版**：AI 助手支持按模式（`grid`、`row`、`column`）自动排列当前选中或全画布卡片。
3. **安全打包下载原图**：AI 助手支持在后台根据当前选区自动去重并打包原图资源为 ZIP 触发浏览器下载，优先采用 `originalUrl` 级别原图，失败时平滑降级。
4. **批量持久队列生成**：对于多张图或文件夹的任务，AI 助手必须通过 `DurableGenerationQueue` 任务队列处理，实现限速、可重试与幂等防护。

## Scenarios

### Scenario: 自动整理选区卡片排版
- **Given**: 用户在画布上选中了 3 张卡片，其 IDs 分别为 `["card-1", "card-2", "card-3"]`。
- **When**: 用户输入“帮我把选中的排一下”。
- **Then**: 本地脑或云端 Planner 感知到选区存在，自动规划出 Action：
  ```json
  {
    "type": "canvas.arrangeNodes",
    "payload": {
      "nodeIds": ["card-1", "card-2", "card-3"],
      "mode": "grid",
      "preset": "grid"
    }
  }
  ```

### Scenario: 打包下载选区原图
- **Given**: 用户在画布上选中了一个提示词卡片 `prompt-1`（关联 2 张子图片：`img-1`, `img-2`）。
- **When**: 用户输入“下载这些卡片原图”。
- **Then**: 运行态提取去重得出 `selectedNodeIds: ["img-1", "img-2"]`，并规划出 Action：
  ```json
  {
    "type": "assets.zipOriginals",
    "payload": {
      "scope": "selected_cards",
      "selectedNodeIds": ["img-1", "img-2"]
    }
  }
  ```
