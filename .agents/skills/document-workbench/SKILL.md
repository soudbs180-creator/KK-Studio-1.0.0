---
name: document-workbench
description: 统一的文档工作流路由技能，用于在 PDF、OCR、多格式文档处理和 PandaDoc 文档流程之间选择合适方案。适用于读取、提取、OCR、转换、合并、拆分、旋转、加水印、填写、脱敏、签署、合同流程和格式转换等任务。优先加载最小必要后端，避免把无关文档说明带入上下文。
---

# 文档工作台

把这个技能作为文档任务的统一入口。保持路由层足够轻：先选后端，再只打开匹配的实现说明。

## 后端选择

- 本地 PDF 后端：打开 `../../legacy-skills/anthropics-skills-pdf/SKILL.md`
  适用于 PDF 专项本地操作，例如合并、拆分、旋转、水印、表单、元数据、文本提取、表格提取和校验脚本。
- 本地 OCR 后端：打开 `../../legacy-skills/openclaw-skills-smart-ocr/SKILL.md`
  适用于图片和扫描件的 OCR，尤其是本地多语言识别已经足够、不需要外部 API 的情况。
- Nutrient API 后端：打开 `../../legacy-skills/affaan-m-everything-claude-code-nutrient-document-processing/SKILL.md`
  适用于跨格式转换、云端 OCR、内容提取、签署、表单填写，以及依赖 Nutrient API 的文档流程。
- PandaDoc 文档流程：打开 `../../legacy-skills/composiohq-awesome-claude-skills-pandadoc-automation/SKILL.md`
  适用于合同生命周期、收件人、模板、webhook 和电子签工作流。

## 选择规则

1. 如果任务严格限定在 PDF 文件内，而且可以本地完成，优先选择本地 PDF 后端。
2. 如果任务核心是 OCR，尤其是截图、照片或扫描页识别，优先选择 OCR 后端。
3. 如果任务跨越多种文档格式，或明确要求使用托管 API 工作流，选择 Nutrient 后端。
4. 如果任务涉及合同、签署、模板和收件人协作等文档流程，选择 PandaDoc 后端。
5. 只有在任务确实跨越多个边界时，才同时加载多个后端，例如先 OCR 再做 PDF 后处理。

## 约束

- 默认不要同时打开全部三个后端技能。
- 当本地工具和外部 API 都能完成任务时，优先使用本地方案。
- 如果缺少必要凭证，优先尝试回退到本地后端，而不是继续加载更多上下文。
- 具体实现细节应保留在后端技能里，不要堆到这个路由技能中。
