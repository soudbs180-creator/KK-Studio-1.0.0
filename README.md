# KK Studio v1.5.9

> 面向多模态 AI 创作、无限画布资产管理、多模型智能路由、用户自主密钥与商业化计费审计的多端一体化 AI 工作台。

KK Studio 在同一个高效的 Monorepo 仓库中，整合了基于 React 19 的无限画布前端、基于 Expo 的原生移动端、统一协议契约包、高可用的 Express/VPS 后端以及 PostgreSQL 数据库迁移系统。项目旨在通过结构化 AI Agent 运行时（CanvasRuntimeState & ToolRegistry）与持久化任务队列，将传统的 AI 创作工具升华为高自适应性的智能助手工作台。

---

## 0. 核心文档路由总表

为了确保 AI 编程助手（如 Codex、Claude、Cursor、Antigravity）与人类开发者能够以最低的信息摩擦理解项目规则，所有文档均按照职责和生命周期进行了分类：

| 读者 / 场景 / 任务 | 核心文档入口 | 关联阅读 / 辅助参考 | 核心用途与要求 |
|---|---|---|---|
| **新手开发快速上手** | [README.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/README.md) | [docs/architecture/PROJECT_STRUCTURE.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/architecture/PROJECT_STRUCTURE.md) | 了解项目定位、分层设计、依赖启动方式 |
| **Agent / 机器人修改代码** | [AGENTS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/AGENTS.md) | 按 [AGENTS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/AGENTS.md) 顶部任务表路由 | 必须读取的最高优先级规则、安全与模块边界 |
| **开发 AI 助手与画布 Agent** | [AGENTS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/AGENTS.md) §7-§11 | [docs/ai-assistant/AI_ASSISTANT_ROADMAP.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/ai-assistant/AI_ASSISTANT_ROADMAP.md)<br>[docs/ai-assistant/RUNBOOKS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/ai-assistant/RUNBOOKS.md) | 实现 CanvasRuntimeState 对齐与 ToolRegistry 声明 |
| **安全 / 计费 / 后端 API** | [AGENTS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/AGENTS.md) §6、§12 | [docs/governance/SECURITY_AND_BACKLOG.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/governance/SECURITY_AND_BACKLOG.md) | 绝对禁止泄露明文密钥、绕过积分或 Stripe Webhook 验签 |
| **数据库结构变更** | [AGENTS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/AGENTS.md) §13 | [docs/architecture/DATABASE_SCHEMA.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/architecture/DATABASE_SCHEMA.md) | 必须走 migrations/ 目录，DDL 完全幂等且防冲突 |
| **解决乱码与编写脚本** | [docs/governance/ENCODING_AND_POWERSHELL.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/governance/ENCODING_AND_POWERSHELL.md) | `.editorconfig` / `.gitattributes` | 规范 `UTF-8 without BOM`、`LF` 与 PowerShell 编码 |
| **环境搭建与 VPS 发布** | [docs/setup/README.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/setup/README.md) | [docs/setup/GUIDE.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/setup/GUIDE.md) | 系统在 VPS 环境下的部署、CLI 权限与自发布命令 |
| **第三方接口适配 (gpt-best)** | [docs/specs/README.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/specs/README.md) | [docs/specs/API_DOCS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/specs/API_DOCS.md) | 遵循多模态 v2 接口、轮询机制与失败退避算法 |

---

## 1. 当前稳定事实

* **项目名称**：`KK Studio`
* **当前版本**：`v1.5.9`
* **代码仓库**：`soudbs180-creator/nano-banana-KK-`
* **版本事实唯一来源**：[config/release-manifest.json](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/config/release-manifest.json)
* **Web 主运行时**：`apps/web/`
* **Mobile 运行时**：`apps/mobile/`
* **后端运行时**：`server/` (Express / VPS)
* **数据库迁移目录**：`migrations/`

> [!IMPORTANT]
> 历史文档中可能仍残留 `1.4.x`、`1.5.0`、`1.5.1` 或旧部署口径。当前开发必须严格以源码类型、[config/release-manifest.json](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/config/release-manifest.json)、[package.json](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/package.json)、[AGENTS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/AGENTS.md) 及治理校验脚本为准。

---

## 2. 产品核心能力

KK Studio 专注于多模态 AI 画布创作与商业级积分运营：
* **无限画布**：提供 Prompt 编排、图像节点管理、选区框选、自动整理布局及选中原图 ZIP 下载。
* **多模型智能路由**：统一 API 请求边界，智能屏蔽各供应商协议差异，并支持用户自有密钥隔离。
* **积分计费与审计**：严格的余额预扣、防并发负值事务、失败自动退款结算及 Webhook 签名强验。
* **任务级 AI Agent**：基于 CanvasRuntimeState 画布视口状态感知，配合声明式 ToolRegistry 工具集与持久化任务队列（Durable Queue），实现高容错自动接管。

---

## 3. 设计契约与核心规范 (按需跳转)

为了保持主文档精简、条理清晰，项目的具体技术细节与核心规约已去中心化存放。请点击以下链接查看各模块的具体要求：

### UI 与品牌设计
* [品牌与视觉规范 (DESIGN.md)](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/architecture/DESIGN.md)：定义 `KK Studio` 暖奶油色调主品牌色彩（#fffaf0）、毛玻璃材质与 Clay UI 交互系统。
* [Z-Index 图层层级规范 (Z_INDEX_GUIDE.md)](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/architecture/Z_INDEX_GUIDE.md)：规范画布、卡片节点、悬浮控制台、设置侧边栏及弹窗的严格 Z-Index 范围，防范遮挡。

### 核心机制与性能
* [高性能画布与缓存设计 (CANVAS_PERFORMANCE_AND_CACHE.md)](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/architecture/CANVAS_PERFORMANCE_AND_CACHE.md)：规定无限画布的视口裁剪剔除（Viewport Culling）、延迟重绘，以及基于 IndexedDB 的图片离线缓存自愈。
* [API 路由与计费审计规范 (API_ROUTING_AND_BILLING.md)](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/governance/API_ROUTING_AND_BILLING.md)：规范特权大模型 API 请求“零直连前端”的安全网关逻辑，以及原子级积分预扣和失败回滚退款审计流程。

### 版本发布与治理
* [版本发布与更新规范 (VERSION_AND_RELEASE.md)](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/governance/VERSION_AND_RELEASE.md)：明确以 `release-manifest.json` 为最高事实的版本发布机制与防退化 TDD 本地校验流程。
* [全栈架构审查与优化报告 (architecture_review.md)](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/governance/architecture_review.md)：提供从底层核心逻辑（堆叠上下文、多并发 I/O 竞争、分布式计费一阶段事务）到 AI 代理读取效率的苛刻架构师评审与优化对策。

---

## 4. 技术栈

| 层次 | 技术选型 | 备注与规范限制 |
|---|---|---|
| **Web 前端** | Vite + React 19 + TypeScript + Tailwind + AntD / Lobe UI | 基于 UI Bridge 进行组件 Presets 适配 |
| **Mobile 移动端** | Expo + React Native + expo-router | 专注于跨平台原生交互，避免平台专属 API |
| **Shared 共享包** | TypeScript ESM | 纯 DTO 与领域模型，保持平台无关性 |
| **API Client** | Typed HTTP Client | 统一请求封装与跨端 Session 管理 |
| **UI 基础包** | Design Tokens / UI Bridge | 纯展现层与 UI 适配，禁止包含业务逻辑 |
| **Backend 服务端** | Node.js + Express (VPS 运行时) | 后端鉴权、计费、代理、 Stripe 校验、落盘管理 |
| **Database 数据库**| PostgreSQL | 仅允许通过 SQL 迁移脚本变更结构 |
| **Payment 支付** | Stripe SDK + Webhook signature verification | 生产环境必须启用严格验签 |
| **Monorepo 管理** | npm workspaces | 依赖依赖关系以根 `package.json` 为准 |

---

## 5. 仓库目录结构

```text
nano-banana-KK-/
├── apps/
│   ├── web/                         # 桌面 Web 主运行时 (Canvas, UI, AI 取代)
│   └── mobile/                      # Expo 移动端 App
├── packages/
│   ├── shared/                      # 跨端纯 TS 契约与领域规则 (DTO, 枚举, 类型)
│   ├── api-client/                  # 统一 HTTP 客户端 (依赖注入持久存储)
│   └── ui/                          # 设计令牌与 UI 适配层 (展现层, UI Bridge)
├── server/                          # Express / VPS 后端、代理、积分、Webhook 验签
├── migrations/                      # PostgreSQL DDL 唯一合法来源 (纯 SQL)
├── docs/
│   ├── ai-assistant/                # AI 助手路线、Runbooks、知识库
│   ├── governance/                  # 项目治理 (安全、编码规范、乱码防范、状态校验)
│   ├── architecture/                # 架构设计 (模块结构、数据库 Schema、设计规范)
│   ├── specs/                       # 数据规格与第三方 API 规范 (API_DOCS.md)
│   ├── setup/                       # 环境搭建与 VPS/Supabase 部署指南
│   ├── development/                 # 开发手册 (多提供商设计、Handoff 模板)
│   └── archive/                     # 过时历史文档归档区 (AI 开发严禁参考此处)
├── scripts/                         # CI、治理、发布、测试、维护脚本
├── tests/                           # 单元、集成、契约、E2E 测试
├── config/                          # release manifest 与项目配置
├── AGENTS.md                        # AI / Agent 最高执行规范与任务路由入口
└── README.md                        # 本项目入口
```

---

## 6. 模块职责与核心边界

为防范跨模块依赖污染与职责混乱，KK Studio 的各 Workspace 实行严格的架构边界隔离：

### 6.1 前端应用层 (Apps)

#### [apps/web/](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web)
* **核心职责**：负责桌面 Web 端无限画布的主交互界面渲染，承载 Prompt 卡片、图片节点、选区、分组及标签等创作流程；提供 AI 助手面板与自动化接管的 UI 入口。
* **技术特性**：基于 React 19、Tailwind CSS 以及 Ant Design / Lobe UI 适配网桥。
* **核心边界与禁止事项**：
  * 🚫 严禁引入任何 React Native / Expo 专属库；
  * 🚫 严禁直接与数据库进行 DDL 或 DML 交互；
  * 🚫 严禁在浏览器端直连特权大模型 Provider，所有请求必须经由 `packages/api-client` 转发至后端网关。

#### [apps/mobile/](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/mobile)
* **核心职责**：负责原生移动端的 UI 呈现与触控交互，提供移动端的随身 AI 创作界面。
* **技术特性**：基于 Expo、React Native 以及 `expo-router` 实现多端原生路由。
* **核心边界与禁止事项**：
  * 🚫 严禁直接调用 DOM、BOM 等桌面浏览器特有的专属 API，以防跨平台运行时崩溃。

---

### 6.2 协议与共享包层 (Packages)

#### [packages/shared/](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/packages/shared)
* **核心职责**：定义跨端共享的通信协议与业务概念。包括各种 API 请求/响应 of DTO (数据传输对象) 类型定义、通用枚举（如模型类型、任务状态）以及不依赖特定平台的领域级核心算法规则。
* **技术特性**：纯 TypeScript 编写，输出 ESM 模块。
* **核心边界与禁止事项**：
  * 🚫 严禁引入 React、DOM、Expo、RN 或者是 Node.js 等与特定环境绑定的 API，必须保持绝对的平台无关性 (Platform-Agnostic)。

#### [packages/api-client/](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/packages/api-client)
* **核心职责**：统一封装前后端 HTTP 接口请求及 Session 会话周期边界，向 Web 和 Mobile 提供一致且类型安全的 API 交互层。
* **技术特性**：利用 Axios/Fetch，并通过依赖注入的形式接收跨端存储凭据。
* **核心边界与禁止事项**：
  * 🚫 严禁在包内硬编码特定平台的持久化存储方式（如 Web 端的 `localStorage` 或移动端的 `SecureStore`），必须由应用端注入存储适配器。

#### [packages/ui/](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/packages/ui)
* **核心职责**：管理项目的设计令牌 (Design Tokens)、跨端公共样式 Preset、图标基底以及 UI 适配层 Bridge。
* **技术特性**：采用 Vanilla CSS 设计系统，支持暗色/浅色主题。
* **核心边界与禁止事项**：
  * 🚫 严禁在 UI 包中混入任何具体的业务状态管理（如 React Context）或接口调用逻辑，维持纯粹的展现层（Presentational）定位。

---

### 6.3 服务端与底层 (Server & Database)

#### [server/](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/server)
* **核心职责**：项目后台运行时的权威源。负责特权大模型 API Key 代理请求、高安全积分预扣扣减与结算、退款审计流写入、Stripe 支付 Webhook 签名强验、静态资产落盘管理以及用户 JWT 校验。
* **技术特性**：基于 Node.js 与 Express 框架部署于 VPS。
* **核心边界与禁止事项**：
  * 🚫 严禁引入任何前端视图组件或 CSS 框架依赖；
  * 🚫 绝对禁止在 Git 提交中遗留 any 真实的私钥，且在读取特权环境变量失败时必须拒绝启动服务。

#### [migrations/](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/migrations)
* **核心职责**：存放 PostgreSQL 的所有 DDL (数据定义语言) 迁移文件，作为数据库 Schema 变更的**唯一权威物理目录**。
* **技术特性**：纯 SQL 迁移文件，按 `NNN_<description>.sql` 顺序编写。
* **核心边界与禁止事项**：
  * 🚫 严禁在 Web/Mobile 业务代码或常规服务端 API 逻辑中编写 DDL（如 `CREATE TABLE` 或 `ALTER TABLE`），必须在 migrations 下通过版本控制工具执行，以保证所有迁移完全幂等且可控。

---

## 7. 快速启动指南

### 7.1 安装依赖
项目推荐使用 `npm` 进行依赖管理：
```bash
npm install
```

### 7.2 配置环境变量
从模板复制配置文件，并填写本地区动信息：
```bash
cp .env.example .env
```
> [!WARNING]
> 真实的 `.env`、API 密钥、数据库连接字符串以及 Stripe 密钥绝对禁止提交至 Git 仓库。

### 7.3 构建共享包
在本地开发启动前，必须构建协议契约包与 API 客户端：
```bash
npm run build -w packages/api-client
```
若修改了 `packages/shared` 或 `packages/ui`，也需要同步构建对应的 workspace：
```bash
npm run build -w packages/shared
npm run build -w packages/ui
```

### 7.4 启动开发服务
```bash
npm run dev:start
```
通常，开发环境会使用如下端口（具体以启动控制台日志为准）：
* **Web 端**：`http://localhost:3000`
* **服务端 API**：`http://localhost:3001`
* **移动端 (Expo)**：运行 `cd apps/mobile && npx expo start` 启动调试器。

---

## 8. 质量验证与专项测试

在提交任何修改之前，必须在本地执行以下完整校验脚本：

```bash
npm run verify:changes
```

### 8.1 分项校验命令
* **架构合规校验**：`npm run architecture:check`
* **项目治理校验**：`npm run governance:check`
* **安全红线审计**：`npm run governance:security`
* **TypeScript 类型校验**：`npm run typecheck`
* **单元测试套件**：`npm run test`
* **文件编码防乱码校验**：`npm run check:encoding`

### 8.2 AI 助手专项测试
涉及画布运行时状态与 AI Agent 能力变更时，优先执行以保证覆盖：
```bash
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ai-assistant-tool-registry.test.ts tests/unit/canvas-runtime-state-builder.test.ts tests/unit/zip-selected-originals.test.ts tests/unit/durable-generation-queue.test.ts tests/unit/agent-knowledge-sync.test.ts tests/unit/ai-takeover-confirmationPolicy.test.ts tests/unit/ai-takeover-safetyPolicy.test.ts
```

---

## 9. 项目编码与乱码防范

所有源码、配置文件、脚本、Markdown 文档以及普通文本文件必须严格遵循以下编码规约：

* **文件编码格式**：`UTF-8 without BOM`
* **文件换行符**：`LF`
* **Windows 环境例外**：部分 `.bat`/`.cmd` 允许 CRLF；为兼容 Windows PowerShell 且含中文的 `.ps1` 允许 `UTF-8 with BOM`，但必须在脚本首部注释原因。
* **PowerShell 写入命令限制**：使用 PowerShell 写入文件时，禁止使用重定向（如 `>` 或 `>>`）或默认的 `Out-File`。必须显式指定 `utf8NoBOM`，如：
  ```powershell
  Set-Content -Path $Path -Value $Content -Encoding utf8NoBOM
  ```

---

## 10. 知识体系与经验沉淀

KK Studio 重视开发中的踩坑复盘，为了避免团队或 AI 助手重复犯下相同的设计与代码错误，引入了基于 `docs/` 的复盘沉淀机制：

* **开发规约与红线**：
  * [AGENTS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/AGENTS.md) 规定了 AI 修改代码的最高指令与权限。
  * [docs/governance/ENCODING_AND_POWERSHELL.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/governance/ENCODING_AND_POWERSHELL.md) 记录了 Windows 环境防乱码实践。
  * [docs/governance/SECURITY_AND_BACKLOG.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/governance/SECURITY_AND_BACKLOG.md) 梳理了 CORS、JWT 拦截与积分流水的核心待办。
* **核心机制与 Runbooks**：
  * [docs/ai-assistant/RUNBOOKS.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/ai-assistant/RUNBOOKS.md) 提供了下载选区原图、批量生成、整理卡片、任务恢复的 SOP。
  * [docs/architecture/DATABASE_SCHEMA.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/architecture/DATABASE_SCHEMA.md) 提供数据底座 ER 关系图。
* **复盘文档规范 (`*_LESSONS.md`)**：
  * 参照 opentu 的复盘积累实践，凡是在开发中解决的重大 Bug、性能瓶颈（如画布缩放重绘、大文件打包、多模型轮询故障等），均需在 `docs/reports/` 或对应模块下输出 `*_LESSONS.md` 记录原因、诊断步骤、优化方案和防御性设计，并在 [docs/governance/PROJECT_STATE_AND_VALIDATION.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/governance/PROJECT_STATE_AND_VALIDATION.md) 中进行归档。

---

## 11. 项目发展结论

KK Studio v1.5.9 的开发重点是把现有多模态创作工作台收敛为：
1. **稳定的 Monorepo 物理分层架构**，确保移动端、Web 端、协议层和 UI 适配层的清晰解耦；
2. **后端权威计费与安全代理网关**，实现从预扣到结算/退款审计的完全闭环；
3. **结合高性能渲染与统一缓存的无限画布资产系统**，提供极其流畅的多端协同体验；
4. **基于 CanvasRuntimeState 与 ToolRegistry 构建的结构化 AI Agent 执行层**，支持复杂批量任务的故障自愈与队列管理。
