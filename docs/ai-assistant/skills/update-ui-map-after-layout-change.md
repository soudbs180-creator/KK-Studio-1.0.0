# UI 变更后同步 UI Map 规约 (update-ui-map-after-layout-change)

- **适用场景**: 重构前端组件、修改控制面板位置或操作按钮选择器时。
- **调用工具**:
  - `ui.recordLayoutChange`
- **步骤**:
  1. 修改 React 页面结构后，记录变动处的 DOM 选择器或 Ref 锚点。
  2. 打开 `docs/ai-assistant/ui-map.md`，更新对应的元素位置描述与 selector 路径。
  3. 执行 `knowledge.recordChange` 或者是调用 `ui.recordLayoutChange` 向上层 Agent 发布 UI 布局变更投影，确保模型拥有最新的界面签名。
