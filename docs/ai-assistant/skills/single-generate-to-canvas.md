# 单图生图 Skill (single-generate-to-canvas)

- **触发词**: “帮我画一张猫咪的图片” / “生成一张科爱的壁纸”
- **前置条件**: 用户给出了明确的出图提示词。
- **调用工具**:
  - `generation.start`
  - `startGeneration`
- **执行步骤**:
  1. 通过输入文本提取出提示词主体及生图数量。
  2. 获取当前选中的模型 `selectedModel`。
  3. 调用 `generation.start` 工具启动单张生图任务。
  4. 计算排布坐标，在画布上创建对应的 PromptNode 并加入排队队列。
  5. 生图完成后自动将生成的 ImageNode 挂载到父节点下。

## 🛠️ 安全防护与规约
- **确认保护**: 由于生图消耗积分，`startGeneration` 工具属于 `confirm` 风险级。在实际执行前，必须通过 `confirmationPolicy` 弹出卡片，展示估算积分成本并获得用户明确授权。
- **并发控制**: 单图任务自动受排队机制调度，最大并发为 3。
