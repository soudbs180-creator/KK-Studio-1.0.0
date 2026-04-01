---
name: adobe-workbench
description: 统一的 Adobe 工作流路由技能，用于在 Creative Cloud API 和本地 Photoshop 自动化之间选择合适后端。适用于 Adobe 图像处理、PDF 服务、Firefly 生成、Lightroom 流程和 Photoshop 脚本任务。优先加载最小必要后端，避免把云端和桌面端说明一起带入上下文。
---

# Adobe 工作台

把这个技能作为 Adobe 任务的统一入口。先判断任务属于云端 API 还是本地桌面自动化，再继续打开对应实现说明。

## 后端选择

- Adobe 云端 API：打开 `../../legacy-skills/openclaw-skills-adobe/SKILL.md`
  适用于 Photoshop API、Lightroom、PDF Services、Firefly 等 Adobe 云端能力。
- 本地 Photoshop 自动化：打开 `../../legacy-skills/neversight-skills_feed-photoshop-automator/SKILL.md`
  适用于依赖本机 Photoshop、PSD 文件、COM 或 ExtendScript 的桌面自动化任务。

## 选择规则

1. 如果任务需要调用 Adobe 外部接口、令牌或云端资源，选择云端 API 后端。
2. 如果任务需要操作本地已打开的 Photoshop、图层、文字、动作或导出流程，选择 Photoshop 自动化后端。
3. 只有在工作流明确同时涉及云端 Adobe API 和本地 Photoshop 自动化时，才同时加载两个后端。

## 约束

- 不要把本地 Photoshop 脚本和 Adobe 云端 API 视为可互换方案。
- 在继续深入之前，先确认凭证或本地安装条件是否满足。
- 后端特有的安装、限制和注意事项应留在后端技能里，不要堆进这个路由技能。
