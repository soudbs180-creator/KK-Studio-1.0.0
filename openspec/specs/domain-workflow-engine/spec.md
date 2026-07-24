Status: current

# Capability Spec: domain-workflow-engine

通用自动化工作流与领域套件引擎规格书 (Domain Workflow & Automation Engine Spec)。

## 1. Overview
本规格书定义 KK Studio v1.6.0 中通用自动化工作流引擎的职责边界、统一契约与安全断言。通用工作流引擎将品牌 VI 工作流、电商商品批量生成、PPT 分镜生成及节点后处理工具链统一抽象收口为五阶段通用管道 (`Brief Collection -> Domain Template -> Design Compilation -> Durable Execution -> Node-Level Editing`)。

---

## 2. Standard Requirements

### [REQ-WF-001] 通用工作流五阶段管道契约 (Unified 5-Stage Pipeline Contract)

- **User Story**: 作为一个领域开发者，我希望品牌 VI、电商批量及 PPT 任务复用统一的工作流提交管道，以便避免为每个领域重复造队列轮询与持久化管道。
- **Preconditions**: 服务端报价引擎 (`QuoteEngine`) 和 Durable Worker 队列已可用。
- **Explicit Contract**:
  - **Inputs**: `DomainWorkflowDto` (包含 `domainType: 'brand-vi' | 'ecommerce-batch' | 'ppt-deck' | 'node-processing'`, `brief`, `presetId`, `targetCanvasId`)
  - **Outputs**: `GenerationJobDto` (绑定 `quoteId` 与通用作业 `jobId`)
- **Source of Truth**: 服务端 `generation_jobs` PostgreSQL 表。
- **Measurable Acceptance Criteria**:
  - **Given**: 用户提交品牌 VI 简报或电商商品参考图。
  - **When**: 触发 `workflow.createJob` 提交动作。
  - **Then**: 统一工作流引擎在 ≤500ms 内调用 `DesignCompiler` 编译生成结构化任务参数，并生成唯一 `quoteId` 提交给后端队列；全流程均经由 `DurableGenerationQueue` 进行重试与限速控制。
- **Failure & Rollback Boundaries**: 若简报缺少必填项，fail-closed 提示缺少参数；报价超时（>5 分钟）必须重新报价，禁止直接提交未冻结的强开作业。

---

### [REQ-WF-002] 设计编译器规范 (Design Compiler Specification)

- **User Story**: 作为一个创意工作流引擎，我需要在生成前将用户的定性 Prompt 与品牌/电商规则编译为结构化的编译简报，以便保证输出质量与品牌一致性。
- **Preconditions**: `BrandMemory` 或电商主体结构已经就绪。
- **Explicit Contract**:
  - **Inputs**: `rawPrompt` + `brandContext` / `ecommerceContext`
  - **Outputs**: `CompiledDesignBrief` (包含 `designReasoning`, `compiledPrompt`, `antiSlopRules`, `negativePrompts`)
- **Source of Truth**: 内存设计编译规则模块 (`DesignCompiler.ts`)。
- **Measurable Acceptance Criteria**:
  - **Given**: 输入品牌名字“NeoTech”，品牌主色为“#0066FF”。
  - **When**: 调用 `DesignCompiler.compile()`。
  - **Then**: 编译结果自动注入反盲从规则 (`antiSlopRules`)，生成格式规范的 `compiledPrompt`，且绝不包含硬编码的不和谐色彩。
- **Failure & Rollback Boundaries**: LLM 推理编译超时 (5s) 时，平滑回退到基于规则模板的确定性编译器。

---

### [REQ-WF-003] 节点级图像后处理工具链 (Node-Level Post-Processing Tools)

- **User Story**: 作为一个创作者，我希望在画布上生成的卡片能随时进行“去背”、“选区重绘”和“矢量化 SVG”，以便直接完成交付生产。
- **Preconditions**: 画布节点包含有效的图像 Asset。
- **Explicit Contract**:
  - **Inputs**: `nodeId`, `action: 'background-remove' | 'inpaint' | 'outpaint' | 'vectorize-svg' | 'upscale'`, `parameters`
  - **Outputs**: `ProcessedAssetDto` (新生成的 Asset ID, 格式与 URL)
- **Source of Truth**: 服务端资产库 `assets` 表及节点关联状态。
- **Measurable Acceptance Criteria**:
  - **Given**: 画布上选中了一个位图 Logo 节点 `card-logo-1`。
  - **When**: 用户点击“矢量化 SVG”工具。
  - **Then**: 调用 `canvas.nodeVectorizeSvg` 提交后台图像微服务，在 ≤3s 内返回 SVG 格式代码与 Preview，并在画布上将该节点更新为矢量节点或新衍生卡片。
- **Failure & Rollback Boundaries**: 后处理服务失败时，原始节点保持不动并弹出可重试的错误 Banner；新生成资产在 24 小时内必须完成持久化存储落库。
