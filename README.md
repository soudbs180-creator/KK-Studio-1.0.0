# KK Studio v1.6.0

> 面向多模态 AI 创作、无限画布资产管理、多模型智能路由、用户自主密钥与商业化计费审计的多端一体化 AI 工作台。

KK Studio 在同一个高效的 Monorepo 仓库中，整合了基于 React 19 的无限画布前端、基于 Expo 的原生移动端、统一协议契约包、高可用的 Express/VPS 后端以及 PostgreSQL 数据库迁移系统。项目旨在通过结构化 AI Agent 运行时（CanvasRuntimeState & ToolRegistry）与持久化任务队列，将传统的 AI 创作工具升华为高自适应性的智能助手工作台。

---

## 0. 核心文档路由总表

为了确保 AI 编程助手（如 Codex、Claude、Cursor、Antigravity）与人类开发者能够以最低的信息摩擦理解项目规则，所有文档均按照职责和生命周期进行了分类：

| 读者 / 场景 / 任务 | 核心文档入口 | 关联阅读 / 辅助参考 | 核心用途与要求 |
|---|---|---|---|
| **新手开发快速上手** | [README.md](./README.md) | [docs/architecture/PROJECT_STRUCTURE.md](./docs/architecture/PROJECT_STRUCTURE.md) | 了解项目定位、分层设计、依赖启动方式 |
| **Agent / 机器人修改代码** | [AGENTS.md](./AGENTS.md) | 按 [AGENTS.md](./AGENTS.md) 顶部任务表路由 | 必须读取的最高优先级规则、安全与模块边界 |
| **开发 AI 助手与画布 Agent** | [AGENTS.md](./AGENTS.md) §7-§11 | [docs/ai-assistant/AI_ASSISTANT_ROADMAP.md](./docs/ai-assistant/AI_ASSISTANT_ROADMAP.md)<br>[docs/ai-assistant/RUNBOOKS.md](./docs/ai-assistant/RUNBOOKS.md) | 实现 CanvasRuntimeState 对齐与 ToolRegistry 声明 |
| **安全 / 计费 / 后端 API** | [AGENTS.md](./AGENTS.md) §6、§12 | [docs/governance/SECURITY_AND_BACKLOG.md](./docs/governance/SECURITY_AND_BACKLOG.md) | 绝对禁止泄露明文密钥、绕过积分或 Stripe Webhook 验签 |
| **数据库结构变更** | [AGENTS.md](./AGENTS.md) §13 | [docs/architecture/DATABASE_SCHEMA.md](./docs/architecture/DATABASE_SCHEMA.md) | 必须走 infrastructure/database/migrations/ 目录，DDL 完全幂等且防冲突 |
| **解决乱码与编写脚本** | [docs/governance/ENCODING_AND_POWERSHELL.md](./docs/governance/ENCODING_AND_POWERSHELL.md) | `.editorconfig` / `.gitattributes` | 规范 `UTF-8 without BOM`、`LF` 与 PowerShell 编码 |
| **环境搭建与 VPS 发布** | [docs/setup/README.md](./docs/setup/README.md) | [docs/setup/GUIDE.md](./docs/setup/GUIDE.md) | 系统在 VPS 环境下的部署、CLI 权限与自发布命令 |
| **第三方接口适配 (gpt-best)** | [docs/specs/README.md](./docs/specs/README.md) | [docs/specs/API_DOCS.md](./docs/specs/API_DOCS.md) | 遵循多模态 v2 接口、轮询机制与失败退避算法 |

---

## 1. 当前稳定事实

* **项目名称**：`KK Studio`
* **当前版本**：`v1.6.0`
* **代码仓库**：`soudbs180-creator/nano-banana-KK-`
* **版本事实唯一来源**：[config/release-manifest.json](./config/release-manifest.json)
* **Web 主运行时**：`apps/web/`
* **Mobile 运行时**：`apps/mobile/`
* **后端运行时**：`services/api/` (Express / VPS)
* **数据库迁移目录**：`infrastructure/database/migrations/`

> [!IMPORTANT]
> 历史文档中可能仍残留 `1.4.x`、`1.5.0`、`1.5.1` 或旧部署口径。当前开发必须严格以源码类型、[config/release-manifest.json](./config/release-manifest.json)、[package.json](./package.json)、[AGENTS.md](./AGENTS.md) 及治理校验脚本为准。

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
* [工作台视觉规范 (DESIGN.md)](./docs/architecture/DESIGN.md)：定义画布优先、低对比度、语义 Token 驱动的浅色/深色专业工作台。
* [Z-Index 图层层级规范 (Z_INDEX_GUIDE.md)](./docs/architecture/Z_INDEX_GUIDE.md)：规范画布、卡片节点、悬浮控制台、设置侧边栏及弹窗的严格 Z-Index 范围，防范遮挡。

### 核心机制与性能
* [高性能画布与缓存设计 (CANVAS_PERFORMANCE_AND_CACHE.md)](./docs/architecture/CANVAS_PERFORMANCE_AND_CACHE.md)：规定无限画布的视口裁剪剔除（Viewport Culling）、延迟重绘，以及基于 IndexedDB 的图片离线缓存自愈。
* [API 路由与计费审计规范 (API_ROUTING_AND_BILLING.md)](./docs/governance/API_ROUTING_AND_BILLING.md)：规范特权大模型 API 请求“零直连前端”的安全网关逻辑，以及原子级积分预扣和失败回滚退款审计流程。

### 版本发布与治理
* [版本发布与更新规范 (VERSION_AND_RELEASE.md)](./docs/governance/VERSION_AND_RELEASE.md)：明确以 `release-manifest.json` 为最高事实的版本发布机制与防退化 TDD 本地校验流程。
* [全栈架构审查与优化报告 (architecture_review.md)](./docs/governance/architecture_review.md)：提供从底层核心逻辑（堆叠上下文、多并发 I/O 竞争、分布式计费一阶段事务）到 AI 代理读取效率的苛刻架构师评审与优化对策。

---

## 4. 技术栈

| 层次 | 技术选型 | 备注与规范限制 |
|---|---|---|
| **Web 前端** | Vite + React 19 + TypeScript + Tailwind | 使用 `@kk/ui/web` 与语义 Token，业务状态留在 Web Feature |
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
│   ├── web/                         # 桌面 Web 主运行时 (Canvas, UI, AI 接管)
│   └── mobile/                      # Expo 移动端 App
├── packages/
│   ├── shared/                      # 跨端纯 TS 契约与领域规则 (DTO, 枚举, 类型)
│   ├── api-client/                  # 统一 HTTP 客户端 (依赖注入持久存储)
│   └── ui/                          # 设计令牌与 UI 适配层 (展现层, UI Bridge)
├── services/api/                          # Express / VPS 后端、代理、积分、Webhook 验签
├── infrastructure/database/migrations/                      # PostgreSQL DDL 唯一合法来源 (纯 SQL)
├── docs/
│   ├── ai-assistant/                # AI 助手路线、Runbooks、知识库
│   ├── governance/                  # 项目治理 (安全、编码规范、乱码防范、状态校验)
│   ├── architecture/                # 架构设计 (模块结构、数据库 Schema、设计规范)
│   ├── specs/                       # 数据规格与第三方 API 规范 (API_DOCS.md)
│   ├── setup/                       # 当前 VPS、PostgreSQL 与发布部署指南
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

#### [apps/web/](./apps/web)
* **核心职责**：负责桌面 Web 端无限画布的主交互界面渲染，承载 Prompt 卡片、图片节点、选区、分组及标签等创作流程；提供 AI 助手面板与自动化接管的 UI 入口。
* **技术特性**：基于 React 19、Tailwind CSS 以及 Ant Design / Lobe UI 适配网桥。
* **核心边界与禁止事项**：
  * 🚫 严禁引入任何 React Native / Expo 专属库；
  * 🚫 严禁直接与数据库进行 DDL 或 DML 交互；
  * 🚫 严禁在浏览器端直连特权大模型 Provider，所有请求必须经由 `packages/api-client` 转发至后端网关。

#### [apps/mobile/](./apps/mobile)
* **核心职责**：负责原生移动端的 UI 呈现与触控交互，提供移动端的随身 AI 创作界面。
* **技术特性**：基于 Expo、React Native 以及 `expo-router` 实现多端原生路由。
* **核心边界与禁止事项**：
  * 🚫 严禁直接调用 DOM、BOM 等桌面浏览器特有的专属 API，以防跨平台运行时崩溃。

---

### 6.2 协议与共享包层 (Packages)

#### [packages/shared/](./packages/shared)
* **核心职责**：定义跨端共享的通信协议与业务概念。包括各种 API 请求/响应 of DTO (数据传输对象) 类型定义、通用枚举（如模型类型、任务状态）以及不依赖特定平台的领域级核心算法规则。
* **技术特性**：纯 TypeScript 编写，输出 ESM 模块。
* **核心边界与禁止事项**：
  * 🚫 严禁引入 React、DOM、Expo、RN 或者是 Node.js 等与特定环境绑定的 API，必须保持绝对的平台无关性 (Platform-Agnostic)。

#### [packages/api-client/](./packages/api-client)
* **核心职责**：统一封装前后端 HTTP 接口请求及 Session 会话周期边界，向 Web 和 Mobile 提供一致且类型安全的 API 交互层。
* **技术特性**：利用 Axios/Fetch，并通过依赖注入的形式接收跨端存储凭据。
* **核心边界与禁止事项**：
  * 🚫 严禁在包内硬编码特定平台的持久化存储方式（如 Web 端的 `localStorage` 或移动端的 `SecureStore`），必须由应用端注入存储适配器。

#### [packages/ui/](./packages/ui)
* **核心职责**：管理项目的设计令牌 (Design Tokens)、跨端公共样式 Preset、图标基底以及 UI 适配层 Bridge。
* **技术特性**：采用 Vanilla CSS 设计系统，支持暗色/浅色主题。
* **核心边界与禁止事项**：
  * 🚫 严禁在 UI 包中混入任何具体的业务状态管理（如 React Context）或接口调用逻辑，维持纯粹的展现层（Presentational）定位。

---

### 6.3 服务端与底层 (Server & Database)

#### [services/api/](./services/api)
* **核心职责**：项目后台运行时的权威源。负责特权大模型 API Key 代理请求、高安全积分预扣扣减与结算、退款审计流写入、Stripe 支付 Webhook 签名强验、静态资产落盘管理以及用户 JWT 校验。
* **技术特性**：基于 Node.js 与 Express 框架部署于 VPS。
* **核心边界与禁止事项**：
  * 🚫 严禁引入任何前端视图组件或 CSS 框架依赖；
  * 🚫 绝对禁止在 Git 提交中遗留 any 真实的私钥，且在读取特权环境变量失败时必须拒绝启动服务。

#### [infrastructure/database/migrations/](./infrastructure/database/migrations)
* **核心职责**：存放 PostgreSQL 的所有 DDL (数据定义语言) 迁移文件，作为数据库 Schema 变更的**唯一权威物理目录**。
* **技术特性**：纯 SQL 迁移文件，按 `NNN_<description>.sql` 顺序编写。
* **核心边界与禁止事项**：
  * 🚫 严禁在 Web/Mobile 业务代码或常规服务端 API 逻辑中编写 DDL（如 `CREATE TABLE` 或 `ALTER TABLE`），必须在 migrations 下通过版本控制工具执行，以保证所有迁移完全幂等且可控。

---

## 7. 快速启动指南

### 7.0 环境要求

在开始之前，请确认本机满足以下前置条件：

| 依赖 | 版本要求 | 说明 |
|---|---|---|
| **Node.js** | `24.x`（严格） | 由根 `package.json` 的 `engines` 字段强制约束，其他版本可能无法安装依赖 |
| **npm** | `11.12.1`（推荐） | 由 `packageManager` 字段声明；Monorepo 依赖关系以根 `package.json` 为准 |
| **PostgreSQL** | 14+ | 后端积分、用户与生成记录的权威存储，本地与 VPS 部署均需要 |
| **PowerShell** | 5.1+（Windows） | `dev:start` 等开发脚本基于 PowerShell 实现，Windows 下开箱即用 |
| **Expo CLI**（可选） | 最新版 | 仅移动端开发需要，随 `npx expo` 自动调用 |

> [!NOTE]
> 若依赖安装过程中出现原生模块锁文件残留（Windows 常见），可执行 `npm run install:diagnose-locks` 诊断，或 `npm run install:recover` 自动清理并恢复。

### 7.1 安装依赖
项目推荐使用 `npm` 进行依赖管理：
```bash
npm install
```

### 7.2 配置环境变量
KK Studio 的环境变量分为**前端公开变量**与**服务端机密变量**两套，分别配置：

**① 前端公开变量** —— 从模板复制配置文件，并填写本地启动信息：
```bash
cp .env.example .env
```
关键项说明：
| 变量 | 用途 | 本地默认值 |
|---|---|---|
| `VITE_KK_API_BASE_URL` | Web 端请求的后端 API 地址 | `http://127.0.0.1:3001` |
| `VITE_AUTH_REDIRECT_ORIGIN` | 登录认证回调来源 | `http://127.0.0.1:5173` |
| `VITE_TURNSTILE_ENABLED` | 是否启用 Cloudflare Turnstile 人机校验 | `false`（本地建议关闭） |
| `EXPO_PUBLIC_API_BASE_URL` | 移动端请求的 API 地址 | `http://127.0.0.1:3001` |

**② 服务端机密变量** —— 复制服务端模板并填写真实密钥：
```bash
cp services/api/.env.local.example services/api/.env.local
```
关键项说明：
| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串，如 `postgres://kkstudio:****@127.0.0.1:5432/kkstudio` |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | 特权大模型供应商密钥（仅服务端持有） |
| `JWT_SECRET` / `PASSWORD_SALT` / `KK_API_SESSION_SIGNING_SECRET` / `USER_API_ENCRYPTION_SECRET` | 会话签名、口令散列与用户密钥加密的机密，**必须是长随机串** |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 支付与 Webhook 验签（生产环境必须启用严格验签） |
| `ALLOWED_ORIGINS` | CORS 白名单，逗号分隔 |

> [!WARNING]
> 真实的 `.env`、`services/api/.env.local`、API 密钥、数据库连接字符串以及 Stripe 密钥**绝对禁止提交至 Git 仓库**。服务端在读取特权环境变量失败时会拒绝启动，这是有意设计的安全红线。

### 7.3 初始化数据库
确保 PostgreSQL 已启动并创建了目标数据库，然后按序执行 `infrastructure/database/migrations/` 目录下的迁移脚本（数据库 Schema 的唯一权威来源）：
```bash
# 示例：使用 psql 按序执行全部迁移
psql "$DATABASE_URL" -f infrastructure/database/migrations/001_points_schema.sql
psql "$DATABASE_URL" -f infrastructure/database/migrations/002_token_schema.sql
# …依次执行其余 NNN_*.sql
```
所有迁移脚本均为幂等设计，可重复执行而不会破坏已有数据。

### 7.4 构建共享包
在本地开发启动前，必须构建协议契约包与 API 客户端：
```bash
npm run build -w packages/api-client
```
若修改了 `packages/shared` 或 `packages/ui`，也需要同步构建对应的 workspace：
```bash
npm run build -w packages/shared
npm run build -w packages/ui
```

### 7.5 启动开发服务
```bash
npm run dev:start
```
该命令会经由 `scripts/dev/dev-launch.ps1` 同时拉起 Web 前端与 API 服务端。常用的配套命令：
```bash
npm run dev:status    # 查看开发进程状态
npm run dev:restart   # 重启开发服务
npm run dev:stop      # 停止全部开发进程
```
通常，开发环境会使用如下端口（具体以启动控制台日志为准）：
* **Web 端**：`http://localhost:3000`
* **服务端 API**：`http://localhost:3001`
* **移动端 (Expo)**：运行 `cd apps/mobile && npx expo start` 启动调试器。

---

## 7A. 使用示例

以下示例覆盖从日常开发到发布的最常见工作流。

### 7A.1 一次完整的本地开发流程
```bash
# 1. 克隆仓库并安装依赖
git clone <repo-url> nano-banana-KK-
cd nano-banana-KK-
npm install

# 2. 配置环境变量（前端 + 服务端）
cp .env.example .env
cp services/api/.env.local.example services/api/.env.local
# 编辑 services/api/.env.local，填入数据库连接串与各类密钥

# 3. 构建共享包并启动
npm run build -w packages/api-client
npm run dev:start

# 4. 打开浏览器访问 http://localhost:3000 开始创作
```

### 7A.2 修改共享契约后的联调
当你修改了 `packages/shared` 中的 DTO 或枚举，需要按依赖顺序重新构建并验证：
```bash
# 跨层修改顺序：shared -> api-client -> server -> web -> tests -> docs
npm run build -w packages/shared
npm run build -w packages/api-client
npm run dev:restart
npm run typecheck
```

### 7A.3 提交前的一键校验
任何代码修改在提交前，必须通过完整的本地质量门禁：
```bash
npm run verify:changes
```
该命令会依次执行：架构边界校验 → 治理校验 → 依赖审计 → 类型检查 → OpenAPI 规格校验 → 全量构建 → 全量测试（单元/集成/契约/E2E）→ 专项冒烟 → 编码防乱码校验 → 画布性能基准。

只想快速跑测试时：
```bash
npm run test:unit          # 仅单元测试
npm run test               # 单元 + 集成 + 契约 + E2E 全量
```

### 7A.4 构建生产产物与便携发布包
```bash
# 全量生产构建（shared + ui + api-client + web）
npm run build

# 生成便携发布包（可分发到 VPS 的独立产物）
npm run package:portable

# 生成并直接发布便携包
npm run package:portable:publish
```

### 7A.5 移动端调试
```bash
cd apps/mobile
npx expo start
# 按提示在 Expo Go 或模拟器中打开；确保 EXPO_PUBLIC_API_BASE_URL 指向本机 API
```

---

## 7B. 贡献指南

欢迎参与 KK Studio 的开发。为了保证 Monorepo 的架构一致性与安全红线不被破坏，请遵循以下流程与约定。

### 7B.1 贡献流程
1. **Fork & 分支**：从主分支切出功能分支，命名建议 `feat/<主题>`、`fix/<主题>` 或 `docs/<主题>`。
2. **阅读规范**：动手前必读 [AGENTS.md](./AGENTS.md)（AI 与人类开发者共享的最高执行规范）和第 0 节的文档路由表，确认你的修改落在正确的模块边界内。
3. **小步提交**：每个提交聚焦一件事；跨层修改遵循 `packages/shared` → `packages/api-client` → `server` → `apps/web` → `tests` → `docs` 的顺序。
4. **本地验证**：提交前必须执行 `npm run verify:changes` 并全部通过；仓库已配置 Husky pre-commit 钩子，请**不要**使用 `--no-verify` 跳过。
5. **提交 PR**：在 PR 描述中说明改动动机、涉及模块、已执行的校验命令及结果；涉及计费、安全、数据库结构的改动需在 PR 中显式标注。

### 7B.2 代码与提交约定
* **语言与风格**：TypeScript 优先，遵循各 workspace 现有的 ESLint/TSConfig 约定；UI 层仅使用语义 Token，禁止硬编码颜色与 Z-Index 字面量。
* **编码规约**：所有文件必须是 `UTF-8 without BOM` + `LF` 换行（详见第 9 节）；提交前 `npm run check:encoding` 必须通过。
* **提交信息**：建议使用 Conventional Commits 风格，如 `feat(canvas): support zip export for selected originals`、`fix(server): rollback points on generation failure`。
* **文档同步**：修改行为或契约时，同步更新对应 `docs/` 文档；重大 Bug 修复与性能优化需输出 `*_LESSONS.md` 复盘文档（见第 10 节）。

### 7B.3 模块边界速查
| 你要做的事 | 应修改的位置 | 绝对禁止 |
|---|---|---|
| Web 页面 / 画布交互 | `apps/web/` | 直连数据库、直连特权 Provider、引入 RN/Expo 库 |
| 移动端交互 | `apps/mobile/` | 调用 DOM / BOM 专属 API |
| DTO / 枚举 / 领域契约 | `packages/shared/` | 引入 React、DOM、Node 环境 API |
| 鉴权 / HTTP 请求封装 | `packages/api-client/` | 硬编码平台存储（localStorage / SecureStore） |
| 设计 Token / 基础组件 | `packages/ui/` | 混入业务状态或接口调用 |
| API 代理 / 计费 / Stripe | `services/api/` | 提交真实密钥；特权环境变量缺失时必须拒绝启动 |
| 数据库结构变更 | `infrastructure/database/migrations/` | 在业务代码中编写 DDL |

### 7B.4 安全红线（不可协商）
* 任何 API 密钥、数据库连接串、Stripe 密钥不得进入 Git 历史；发现误提交立即轮换密钥并清理历史。
* 特权大模型 API 请求"零直连前端"——必须经 `services/api/` 网关代理。
* 积分扣减必须走预扣 + 失败退款的原子事务，禁止绕过计费逻辑。
* 生产环境 Stripe Webhook 必须启用签名强验。

### 7B.5 报告问题
提交 Issue 时请附上：复现步骤、预期与实际行为、`npm run dev:status` 输出、相关日志片段（脱敏后）。安全漏洞请**不要**公开提交 Issue，请私下联系维护者。

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
  * [AGENTS.md](./AGENTS.md) 规定了 AI 修改代码的最高指令与权限。
  * [docs/governance/ENCODING_AND_POWERSHELL.md](./docs/governance/ENCODING_AND_POWERSHELL.md) 记录了 Windows 环境防乱码实践。
  * [docs/governance/SECURITY_AND_BACKLOG.md](./docs/governance/SECURITY_AND_BACKLOG.md) 梳理了 CORS、JWT 拦截与积分流水的核心待办。
* **核心机制与 Runbooks**：
  * [docs/ai-assistant/RUNBOOKS.md](./docs/ai-assistant/RUNBOOKS.md) 提供了下载选区原图、批量生成、整理卡片、任务恢复的 SOP。
  * [docs/architecture/DATABASE_SCHEMA.md](./docs/architecture/DATABASE_SCHEMA.md) 提供数据底座 ER 关系图。
* **复盘文档规范 (`*_LESSONS.md`)**：
  * 参照 opentu 的复盘积累实践，凡是在开发中解决的重大 Bug、性能瓶颈（如画布缩放重绘、大文件打包、多模型轮询故障等），均需在 `docs/reports/` 或对应模块下输出 `*_LESSONS.md` 记录原因、诊断步骤、优化方案和防御性设计，并在 [docs/governance/PROJECT_STATE_AND_VALIDATION.md](./docs/governance/PROJECT_STATE_AND_VALIDATION.md) 中进行归档。

---

## 11. 项目发展结论

KK Studio v1.6.0 的开发重点是把现有多模态创作工作台收敛为：
1. **稳定的 Monorepo 物理分层架构**，确保移动端、Web 端、协议层和 UI 适配层的清晰解耦；
2. **后端权威计费与安全代理网关**，实现从预扣到结算/退款审计的完全闭环；
3. **结合高性能渲染与统一缓存的无限画布资产系统**，提供极其流畅的多端协同体验；
4. **基于 CanvasRuntimeState 与 ToolRegistry 构建的结构化 AI Agent 执行层**，支持复杂批量任务的故障自愈与队列管理。
