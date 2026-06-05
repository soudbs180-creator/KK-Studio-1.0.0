# 单图生图 Skill (single-generate-to-canvas)

- **触发词**: “帮我画一张猫咪的图片” / “生成一张科爱的壁纸”
- **前置条件**: 用户给出了明确的出图提示词。
- **调用工具**:
  - `generation.submitComposer`
  - `prompt.optimizeInput`
  - `generation.start`
  - `startGeneration`
- **执行步骤**:
  1. 若用户说“生成一个...”且没有批量、文件夹、每张参考图等复杂约束，先提取提示词主体。
  2. 调用 `prompt.optimizeInput` / `fillInputPrompt` 将提示词写入当前画布输入框。
  3. 调用 `generation.submitComposer` / `submitPromptComposer` 复用当前输入框已设置的模型、比例、参考图、数量和模式直接发送。
  4. 若用户明确要求新建独立 Prompt 卡片或多张数量，则调用 `generation.start` 进入带确认的生图排队机制。
  5. 生图完成后自动将生成的 ImageNode 挂载到父节点下。

## 🛠️ 安全防护与规约
- **确认保护**: `generation.submitComposer` 复用用户已在画布输入框准备好的配置，属于快速本地执行路径。`startGeneration` / `generation.start` 属于 `confirm` 风险级，在实际执行前必须通过 `confirmationPolicy` 弹出卡片，展示估算积分成本并获得用户明确授权。
- **并发控制**: 单图任务自动受排队机制调度，最大并发为 3。
