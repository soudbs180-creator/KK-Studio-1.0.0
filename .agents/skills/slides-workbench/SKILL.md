---
name: slides-workbench
description: 统一的演示文稿工作流路由技能，用于在 PowerPoint 和幻灯片相关后端之间选择合适方案。适用于创建、编辑、分析、改版和自动化 PPTX、讲者备注、布局、科研汇报、Pitch Deck 和批量制作用例。优先加载最小必要后端，并在需要时只把策略层与一个实现层配对。
---

# 演示文稿工作台

把这个技能作为幻灯片和演示文稿任务的统一入口。先按任务类型做路由，再只打开与当前任务匹配的详细指南。

## 后端选择

- 科研汇报与学术演讲规划：打开 `../../legacy-skills/davila7-claude-code-templates-scientific-slides/SKILL.md`
  适用于故事结构、演讲节奏、科研演示设计和视觉审查。
- python-pptx 后端：打开 `../../legacy-skills/openclaw-skills-pptx-manipulation/SKILL.md`
  适用于用 `python-pptx` 脚本化创建或编辑幻灯片，尤其是标准 PPT 生成、图表、表格、文本和图形操作。
- OOXML 与 PowerPoint 包结构后端：打开 `../../legacy-skills/davila7-claude-code-templates-pptx/SKILL.md`
  适用于处理 PPTX 底层结构、批注、讲者备注、布局、HTML 转 PPTX 和复杂文稿修复。

## 选择规则

1. 如果用户在做科研汇报、答辩、学术讲座或会议演示，先走科研演示后端。
2. 如果用户需要常规的脚本化 PPTX 生成或修改，选择 `python-pptx` 后端。
3. 如果任务涉及备注、批注、布局、原始 XML 或 HTML 转换，选择 OOXML 后端。
4. 只有当任务同时需要演示策略和实际文件生成时，才把科研演示后端与一个实现后端组合使用。

## 约束

- 除非任务确实跨越两个层次，否则不要同时加载两个 PPTX 实现后端。
- 演示策略类指导不要塞进实现后端。
- 文件格式底层细节不要塞进科研演示指南，除非执行任务确实需要。
