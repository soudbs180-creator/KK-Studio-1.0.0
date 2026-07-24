Status: current

# Capability Spec: matrix-diffusion-architecture

矩阵扩散架构与三端拓扑分工规格书 (Matrix Diffusion Architecture & Tri-Tier Topology Spec)。

## 1. Overview
本规格书定义 KK Studio v1.6.0 中“矩阵扩散架构设想”的物理拓扑、圈层扩展与三端职责分工。矩阵中心为 AI 助手 (`AgentRuntime`) 与无限画布；外圈为可扩展的能力圈层（图像/视频/音乐/配音/剪辑/网页自动化）。三端物理部署明确划分为：Vercel 前端交互层、VPS 服务器控制层、Local Runner 本地媒体处理层。

---

## 2. Standard Requirements

### [REQ-MAT-001] 三端拓扑物理隔离契约 (Tri-Tier Physical Separation Contract)

- **User Story**: 作为一个系统架构师，我需要前端 (Vercel)、后端 (VPS) 与本地守护 (Local Runner) 保持严格的物理职责隔离，以便保证系统安全、高可用与公网带宽节约。
- **Preconditions**: 项目全量构建通过，部署环境符合 Docker / Node / Vercel 规范。
- **Explicit Contract**:
  - **Vercel 前端**: 仅托管 `apps/web/`，持有 UI 状态与事件投影；禁止明文 Key 存储、禁止直连 PostgreSQL。
  - **VPS 后端**: 托管 `services/api/` (Express)，连接 PostgreSQL；持有用户 Session、Quote 报价、Durable Worker 队列与加密 Key 存储。
  - **Local Runner**: 托管 `local-runner/` (Strict OpenCLI)；处理本地高清媒体、解包与离线缓存。
- **Source of Truth**: VPS PostgreSQL 数据库 (`generation_jobs`, `provider_connections`, `agent_runs`)。
- **Measurable Acceptance Criteria**:
  - **Given**: 前端触发任意生图或生成作业请求。
  - **When**: 触发 `generateService.submit()`。
  - **Then**: 运行静态架构检查 `check-api-key-boundaries.mjs` 与 `check-no-hardcoded-vps-fallback.mjs`，100% 通过；前端绝不包含明文 Key 或数据库连接串。
- **Failure & Rollback Boundaries**: 前端代码若检测到直接导入 `pg` 或原生密钥解密模块，CI 构建必须 `exit 1` 自动熔断。

---

### [REQ-MAT-002] 矩阵圈层统一控制契约 (Matrix Concentric Tool Control Contract)

- **User Story**: 作为一个 AI 助手，我需要通过统一的 ToolRegistry 与 Capability Graph 调度外圈能力（图像、视频、音乐、配音、剪辑、网页），以便保持控制中心的一致性。
- **Preconditions**: 所有外圈能力通过 `ToolRegistry` 注册为声明式领域工具。
- **Explicit Contract**:
  - **Inputs**: 意图解析后的 `AgentPlanStep` (包含工具名与参数，如 `generation.createVideoJob`)
  - **Outputs**: `ToolExecutionResult`
- **Source of Truth**: 服务端路由引擎 `RouteEngine` 与能力图谱 `Capability Graph`。
- **Measurable Acceptance Criteria**:
  - **Given**: 用户在矩阵中心下达“生成一段视频”指令。
  - **When**: AI 助手规划工具动作。
  - **Then**: 仅通过只读 `capabilities.listAvailable` 查询白名单能力，最终路线由 VPS 端 `RouteEngine` 统一调度；生成作业提交到 `DurableGenerationQueue` 进行异步处理。
- **Failure & Rollback Boundaries**: 禁止 AI 助手直接模拟真实 DOM 点击；工具执行失败时通过 `stepResults` 报告结构化错误，支持最多 3 次受控重规划。

---

### [REQ-MAT-003] 无限矩阵画布性能保障 (Infinite Matrix Canvas Performance)

- **User Story**: 作为一个创作者，我希望矩阵画布在处理数百张图片、视频与 3D 大文件时不卡顿、不溢出，以便流畅创作。
- **Preconditions**: 画布加载超过 500 个节点。
- **Explicit Contract**:
  - **Inputs**: `viewportBounds` (当前视口矩形)
  - **Outputs**: 视口内可视节点集合 `visibleItems` (经过空间索引 $O(M)$ 裁剪)
- **Source of Truth**: 前端内存空间索引 `useCanvasSpatialIndex()`。
- **Measurable Acceptance Criteria**:
  - **Given**: 画布节点规模到达 500+ 个。
  - **When**: 用户在画布上频繁平移、缩放或拖拽卡片。
  - **Then**: 网格查询耗时 ≤3.0ms，视口裁剪耗时 ≤20.0ms；拖拽期间触发 0-Rerender DOM Transform，帧率维持在 60 FPS（运行 `npm run verify:canvas-performance` 全部绿灯）。
- **Failure & Rollback Boundaries**: 超出视口范围的非选中节点自动 unmount/裁剪，视频节点停止播放以释放显存。
