Status: reference

# Slides Workflow Integration in Canvas (v1.6.0)

Last Updated: 2026-06-26
Project Version: 1.6.0

## 1. 画布一体化工作流 (Unified Canvas Workflow)
为了避免形成功能孤岛，KK Studio 废除了独立的 PPT / Slides 原型页面，将所有的幻灯片管理完全吸收至大画布（Canvas）的核心逻辑中：
* **数据承载**：使用 `PromptNode` 的 `pptSlides?: string[]` 字段持久化保存当前大纲的每页分片数据。
* **PPTX 预览与生成**：在前端利用 `usePptRuntime.ts` 执行大纲拆分、子页面重绘、及过渡动画参数的维护。
* **过渡设置合流**：直接在 `WorkspacePage.tsx` 的大画布交互图层中挂载 transition 设置弹层，用户不需要跳出画布即可预览幻灯片过渡特效（包含 `fade`, `page_turn`, `push`, `wipe` 等 8 种 OpenXML 注入动画）。
* **导出与资源存储**：导出的 `.pptx` 或 `.pdf` 物理文件通过 `zip.file` 打包后，直接作为 `AssetNode` 落地在用户的当前 Workspace 画布区域，并同步更新至 `syncService`。

## 2. 隔离与合规边界 (Licensing & Isolation)
* **禁止直接引入 AGPL 源码**：为了防范许可证传染风险，KK Studio 绝不直接复制或静态引入 `Anionex/banana-slides` 中的 AGPL 原生源码。
* **独立逻辑重写**：核心的 PPTX 生成 skeleton、OpenXML XML 元素模板填充、过渡动画标记注入均使用 MIT/Commercial 兼容的前端打包方案独立编写（见 `writePptxPackageSkeleton.ts` 和 `buildPptxSlideDocuments.ts`）。
* **画布桥接通信**：如果未来引入外部的 Slides 编辑容器，必须通过 iframe postMessage 进行桥接隔离，不得与主 monorepo 进行静态编译关联。
