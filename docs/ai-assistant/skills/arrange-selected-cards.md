Status: reference

# 整理卡片布局 Skill (arrange-selected-cards)

- **触发词**: “整理这些卡片” / “帮我排版选中的卡片”
- **前置条件**: 画布上有被选中的节点。
- **调用工具**:
  - `canvas.arrangeNodes`
- **执行步骤**:
  1. 通过 `CanvasRuntimeState` 读取当前选中的节点列表。
  2. 若有单个 PromptNode 且其下有多个子图，调用 `arrangeSingleSelectedPromptChildren` 专门排版。
  3. 若选中多个组或节点，调用 `arrangeSelectedRootNodes`。
  4. 若未选中任何节点但用户说“整理画布”，则执行全局排版 `resolveCanvasAutoArrangePositions`。
