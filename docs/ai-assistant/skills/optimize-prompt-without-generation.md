Status: reference

# 本地优化提示词而不出图 Skill (optimize-prompt-without-generation)

- **触发词**: “优化提示词” / “帮我润色 prompt” / “给我个提示词”
- **前置条件**: 用户给出了文本输入。
- **调用工具**:
  - `prompt.optimizeInput`
  - `prompt.fillPrompt`
- **执行步骤**:
  1. 通过输入提取出提示词内容。
  2. 调用 `prompt.optimizeInput` 进行本地模板匹配与词汇润色强化。
  3. 将优化后的提示词内容填充回输入框，反馈给用户确认。
  4. **强规则**：在此过程中严禁自动执行生图或跑图。除非用户在消息中明确说了“生成”、“跑图”、“出图”等词，否则只进行文本优化。
