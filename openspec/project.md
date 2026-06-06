# OpenSpec Project Specification — KK Studio

本项目采用规范驱动开发 (OpenSpec) 机制。对于涉及项目核心功能与行为的复杂变更，必须遵循 OpenSpec 工作流。

## 核心理念
1. **防重原则**：在新增任何功能规格前，必须首先在 `openspec/specs/` 中搜索并检查是否已有相似的能力 (Capability)。
2. **唯一 Change-ID**：使用小写连字符形式的动词引导 ID，例如 `upgrade-agent-capabilities`。
3. **提案与任务模板**：在 `openspec/changes/<change-id>/` 目录下维护 `proposal.md` 和 `tasks.md`。
4. **验证机制**：所有变更应当在 Stage 3 通过规范校验，并最终合入真实规格书。
