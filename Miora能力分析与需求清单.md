# Miora Design 能力分析与 KK Studio 复刻需求清单

Status: reference

> 本文是竞品与能力研究输入，不是当前项目阶段、排期或实现事实；实际优先级以 `openspec/changes/upgrade-ai-creation-core/` 和 `docs/governance/PROJECT_STATE_AND_VALIDATION.md` 为准。

> 分析对象：
> - 网站：https://miora.design/ （The Agentic Creative Studio with Memory）
> - 文档：https://miora.design/docs/guides/brand-design （品牌视觉识别工作流）
> - 参考仓库：https://github.com/kangarooking/kangarooking-skills （可复刻的设计自动化 Skill 合集）
>
> 目标：提炼 Miora 的核心能力，对比 KK Studio v1.6.0 现状，输出一份可落地的「复刻 + 增强」能力需求清单。

---

## 1. Miora 核心能力与功能模块

Miora 定位为 **"带记忆的智能体创意工作室"**，围绕"From brief to delivery"理念，把单次生成工具升级为可持续协作的创意伙伴。

### 1.1 四大核心能力

| 能力 | 说明 | 对 KK Studio 的启发 |
|---|---|---|
| **Agent Memory（智能体记忆）** | 跨会话记住品牌色、语调、创意规则、"不要做 X"。越长用越像你。 | KK Studio 目前有 `localBrain`/`projectKnowledge`，但缺少**结构化、可检索、跨项目持久化**的品牌档案。 |
| **Specialist Network（专家网络）** | Brand / Storyboard / Illustration / UI-UX / Video / 3D 等专家，各司其职、可组队。 | KK Studio 有 Skill 体系（`skillTools`），但无"按领域选专家并组合"的显式调度。 |
| **Brief to Delivery（从简报到交付）** | 读画布、记风格、与用户迭代，全流程生产就绪资产。 | KK Studio 已有 `DurableGenerationQueue` + 画布节点，方向上一致，缺"专家工作流编排"。 |
| **Skills + Community（技能与社区）** | 把个人工作流沉淀为可复用 Skill，分享到 Inspiration Box。 | KK Studio 有 Skill 框架，但缺**公开/团队共享资产库（灵感盒）**与评分复用机制。 |

### 1.2 功能模块（首页展示）

- **Videos / Images / 3D / Brand / Canvas** 五大创作入口。
- **Canvas（无限画布）**：所有资产以节点形式存在，支持选中后弹出**快捷工具栏 + "..."更多菜单**进行深度编辑。
- **Brand 模块**：品牌视觉识别专家模式（详见第 2 节）。
- **Inspiration Box（灵感盒）**：个人品牌视觉资产库，支持分享/复用。

### 1.3 画布节点级编辑工具（关键差异化，来自 brand-design 文档）

选中任意画布节点后可执行：

- **基础处理**：去背（Remove Background）、替换文字（Replace Text）、选区编辑 + 橡皮擦（局部重绘）、扩展/扩图（Outpainting）、裁剪、透视调整。
- **质量与格式**：高清放大（HD Upscale）、矢量化（Vectorize → SVG，品牌 Logo 刚需）。
- **高级创作与复用**：Mockup 一键场景合成、图层/角色深度编辑、反向提示词（Reverse Prompt，从成图提取 prompt 便于复用）、加回对话、查看生成参数。
- **交付**：下载原图 / 分享至灵感盒。

---

## 2. 文档工作流与技术要点

### 2.1 Brand Visual Identity 六步工作流（miora.design/docs/guides/brand-design）

1. **召唤品牌设计专家**：首页专家卡点击 "Brand Visual Identity"，或在对话中自然语言召唤（如"帮科技公司设计 Logo"）。
2. **描述品牌信息与参考**：支持纯文本 + 可选参考图（品牌名、行业定位、目标人群、调性、视觉偏好；改版强烈建议上传旧资产）。
3. **生成 Logo**：多方案产出 → 选优 → 微调（"把这版图形做得更圆润"）。
4. **建立色彩与 VI 系统**：主/辅/中性色、品牌字体、辅助图形（可同时输出深/浅色板）。
5. **生成营销与应用物料**：名片、工牌、海报、Banner、社媒封面、包装盒、购物袋、周边等。
6. **精修与下载**：节点级编辑（见 1.3）+ 下载 / 分享灵感盒。

> 技术要点：专家模式 = **结构化多轮对话 + 领域模板 + 节点级后处理工具链**的组合，而非单一生图调用。

### 2.2 kangarooking-skills 关键技术提炼（可直接复刻）

| Skill | 关键架构 / 技术 | 可复刻点 |
|---|---|---|
| **multi-agent-image** | 内部 **Design Compiler**：`design_reasoning → compiled_brief → prompt` 三层编译；**Case Library** 持久化成功结果并按 brief/prompt/tag 检索复用；Batch / Series 一致性生成；GPT-Image-2 异步调用。 | KK Studio 可补一个**设计编译器模块** + **评分案例库**，把"关键词堆砌 prompt"升级为"设计意图驱动的编译"。 |
| **apimart-image-gen** | `gpt-image-2` 异步 API：`POST /v1/images/generations` → 轮询 `GET /v1/tasks/{id}` → 下载；支持 1k/2k/4k、16 种比例、最多 16 张参考图、文生图/图生图。 | KK Studio 的 `DurableGenerationQueue` 已是异步轮询范式，可直接接入 **APIMart / GPT-Image-2** 作为高质量生图后端。 |
| **hy-3d-gen** | 腾讯混元生 3D：默认 **TokenHub OpenAI 兼容接口**（`/v1/api/3d/submit`+`/query`，Bearer 鉴权），腾讯云 SDK 作回退；支持文生 3D / 图生 3D / 多视角 / PBR / LowPoly / 白模 / 草图；输出 glb/obj/stl/usdz/fbx。 | KK Studio **完全缺失 3D 生成能力**，这是最高价值增量之一；后端双实现（OpenAI 兼容优先 + SDK 回退）值得照搬。 |
| **scroll-promo-site-builder** | **Vite + React + TS + 原生 CSS**；桌面滚动位置映射连续视频时间（scrubbing，正反向）；`image2.0` 直出生角色/关键帧，`Seedance 2.0` 直出场景/转场视频；4 阶段 gate（方向/视觉/分镜/视频链）；ffmpeg 编码 + 本地预览打包；移动端静态多场景降级、reduced-motion 兜底。 | KK Studio 可新增**"电影感滚动官网生成器"** Skill，把品牌视觉直接落成可交付站点。 |

**跨 Skill 的共性技术要点：**
- 异步任务 + 轮询 + 下载重试（与 KK Studio `DurableGenerationQueue` 范式天然契合）。
- **设计编译（Design Compiler）**：用结构化设计推理替代裸 prompt。
- **案例库（Case Library）**：成功结果带元数据评分沉淀，供后续风格复用。
- **多专家/多 Agent 协作**：Prompt Engineer → Style Scout → Compiler → Generator → QA。
- **资产清单（manifest）**：每次生成的 prompt、参数、源文件统一归档，保证可回溯。

---

## 3. KK Studio 现状对比：需实现 / 改进的能力项

### 3.1 现状（已具备，可复用为底座）

| 已有能力 | 位置 / 证据 | 与 Miora 的对应关系 |
|---|---|---|
| 完整 Agent 执行链路 | `ai-takeover/core/intentGate.ts`、`agentPlanner*`、`confirmationPolicy.ts`、`llmBrain.ts`；`ai-assistant-runtime/runtime/AgentRuntime.ts` | ≈ Miora 的 Agent 编排内核 |
| 持久化生成队列 | `ai-assistant-runtime/queue/DurableGenerationQueue.ts`、`GenerationQueueSync.ts` | ≈ Miora 异步任务管道 |
| 图片/视频/音频批量生成 | `tools/generationTools.ts`（`startGeneration`、`generation.createBatchJob`、`createVideoJob`、`createAudioJob`、`ecommerce.createBatchTransformJob`、pause/resume/retry/cancel/status） | ≈ Miora Images/Videos 模块 |
| 画布运行时状态 | `ai-takeover/core/canvasRuntimeStateBuilder.ts`、`ai-assistant-runtime/context/buildCanvasRuntimeState.ts` | ≈ Miora Canvas 节点 |
| Skill 体系 | `tools/skillTools.ts` | ≈ Miora Skills |
| 参考图节点 + 电商批量 | `generationTools.ts` 的 `referenceImageNodeId`、`ecommerce.*` | ≈ Miora 图生图 / 应用物料 |
| 知识 / 浏览器工具 | `tools/knowledgeTools.ts`、`browserTools.ts` | 加分项，Miora 未明示 |

### 3.2 差距清单（需新增或显著增强）

| # | 能力项 | 现状 | 目标 | 优先级 |
|---|---|---|---|---|
| G1 | **品牌 VI 专家模式** | 无专用工作流 | 六步品牌视觉识别（Logo→色板→VI→物料） | P0 |
| G2 | **跨会话品牌记忆（Agent Memory）** | `localBrain`/`projectKnowledge` 偏通用，无结构化品牌档案 | 品牌色/字体/语调/禁用规则持久化、检索、随用随取 | P0 |
| G3 | **节点级图像编辑工具链** | 仅生成，无后处理 | 去背/换字/选区重绘/扩图/透视/HD放大/矢量化/Mockup/反向Prompt | P0 |
| G4 | **3D 生成** | 完全缺失 | 接入混元生 3D（TokenHub 优先 + 腾讯云回退），glb/obj 落地画布 | P1 |
| G5 | **设计编译器（Design Compiler）** | `promptLibrary` 偏模板 | 三层编译 `design_reasoning→compiled_brief→prompt` + anti_slop 规则 | P1 |
| G6 | **评分案例库（Case Library）** | 有参考图节点，无评分/检索复用 | 成功结果带 metadata 评分沉淀，按 tag/brief 检索复用为参考 | P1 |
| G7 | **专家网络调度** | Skill 体系但无领域专家选择/组合 | Brand/Storyboard/Illustration/UI/Video/3D 专家卡 + 组队编排 | P1 |
| G8 | **电影感滚动官网生成器** | 无 | Vite+React 滚动 scrubbing 站点生成 Skill（image2.0+Seedance） | P2 |
| G9 | **灵感盒 / 资产共享库** | 无共享/复用库 | 个人品牌资产库 + 团队/社区分享（评分、复用） | P2 |
| G10 | **多模型后端路由** | 有 `provider.getModelCapabilities` 雏形 | 接入 APIMart GPT-Image-2、混元 3D、image2.0、Seedance 2.0 等多后端统一路由 | P1 |

---

## 4. 能力需求清单（功能 / 技术栈 / 集成要点）

### 4.1 功能清单

| 模块 | 功能点 | 说明 |
|---|---|---|
| **品牌 VI 工作流** | 专家召唤、品牌信息采集卡、Logo 多方案、VI 系统（色板/字体/辅助图形）、应用物料批量生成 | 复用 `generation.createBatchJob` + 新增品牌领域 prompt 模板 |
| **Agent 品牌记忆** | 品牌档案 CRUD、跨项目检索、随生成自动注入、禁用规则约束 | 落 `packages/shared` 领域契约 + `services/api` 持久化 |
| **节点编辑工具** | 去背、替换文字、选区/橡皮擦重绘、扩图、裁剪、透视、HD 放大、矢量化(SVG)、Mockup、反向 Prompt | 后端图像处理服务（见 4.2）+ 画布节点操作 API |
| **3D 生成** | 文生/图生/多视角 3D、PBR、LowPoly/白模/草图、格式导出 | 混元生 3D 双后端封装 |
| **设计编译器** | 任务类型识别、设计推理、压缩 brief、最终 prompt、anti-slop 规则 | 独立 TS 模块，供所有生图 Skill 调用 |
| **案例库** | 结果归档、评分、按 tag/brief 检索、作为参考图复用 | 落 `DurableGenerationQueue` 输出组 + 元数据索引 |
| **专家调度** | 专家卡定义、组合编排、按领域路由 | 扩展 `skillTools` 为专家注册表 |
| **滚动官网生成器** | 分镜 gate、视频生成、滚动 scrubbing 站点、本地预览打包 | 新增 `scroll-promo` Skill |
| **灵感盒** | 资产收藏、分享、团队/社区可见 | 新增 `assets` 共享服务 + 权限 |

### 4.2 技术栈与集成要点

| 能力 | 推荐技术栈 | 集成要点（KK Studio 边界） |
|---|---|---|
| 生图后端 | APIMart `gpt-image-2`（异步轮询）、可选 image2.0 | 在 `services/api` 新增 provider 适配器；前端复用 `DurableGenerationQueue` 的轮询/重试范式 |
| 3D 后端 | 腾讯混元生 3D：TokenHub OpenAI 兼容 (`/v1/api/3d/submit`+`/query`) 优先，腾讯云 SDK 回退 | 密钥走环境变量（**严禁硬编码**，符合 AGENTS.md 安全边界）；结果 URL 24h 有效期需及时落库 |
| 节点图像编辑 | 服务端图像处理（如 Sharp / rembg / 自研 inpaint 服务）或第三方 API | 新增 `services/api` 图像编辑微服务；画布节点调用 `canvasTools` 更新 |
| 设计编译器 | 纯 TS 模块（`designCompiler.ts`）+ LLM 辅助推理 | 置于 `ai-takeover/core` 或新建 `packages/design-compiler`；产出注入 `generationTools` |
| 案例库 | `DurableGenerationQueue` 输出组 + metadata JSON + 轻量索引 | 复用 `assets.zipOriginals` 归档思路，增加评分/标签字段 |
| 滚动站点 | Vite + React + TS + 原生 CSS + ffmpeg | 作为 Skill 输出本地项目；遵循 AGENTS.md 修改边界（不污染根 `src/`） |
| 品牌记忆 | `packages/shared` 领域类型 + `services/api` 存储 + `ai-takeover` 注入 | 跨项目持久化，生成前由 `projectContextBuilder` 注入 |

### 4.3 落地优先级路线图

- **P0（核心差异，先打通）**：G1 品牌 VI 工作流 → G2 品牌记忆 → G3 节点编辑工具链。这三项直接对应 Miora 最显性的"品牌设计"卖点。
- **P1（能力扩展）**：G10 多模型路由 → G5 设计编译器 → G6 案例库 → G7 专家调度 → G4 3D 生成。
- **P2（生态与交付）**：G8 滚动官网生成器 → G9 灵感盒/共享库。

---

## 5. 关键风险与注意事项

1. **密钥安全**：所有第三方 API Key（APIMart、TokenHub、腾讯云）必须走环境变量，禁止写前端/脚本/提交（AGENTS.md §5）。
2. **架构边界**：新增后端/服务放 `services/api`，类型契约放 `packages/shared`，前端交互放 `apps/web`，不回退根 `src/`（AGENTS.md §3）。
3. **资产有效期**：APIMart 结果有 `expires_at`、混元 3D URL 24h 有效，生成后须**立即落库/下载**到自有存储。
4. **复用优先**：G3/G4/G8 的异步轮询、重试、manifest 归档，直接复用 `DurableGenerationQueue` 与 `generationTools` 既有范式，不要另起炉灶。
5. **验证**：改动后跑 `npm run architecture:check && npm run typecheck && npm run build`（AGENTS.md §7），并记录 handoff。

---

> 结论：KK Studio 在 **Agent 编排 + 持久化生成队列 + 画布节点 + Skill 体系** 上已是强底座，复刻 Miora 的重心应放在 **品牌 VI 专家工作流、跨会话品牌记忆、节点级图像编辑、3D 生成、设计编译器/案例库** 五条主线上，技术上可直接复用现有队列与工具范式，按 P0→P1→P2 推进。
