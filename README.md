# KK Studio v1.5.4

> 面向 AI 创作、无限画布、智能模型路由、用户自主密钥、多端同步、积分计费与审计闭环的多模态 AI 工作台。

KK Studio 将 Prompt 编排、多模型调用、画布式资产管理、生成结果恢复、用户自主密钥、商业化计费、Stripe 订阅、退款审计和 AI 助手自动化能力整合在一个 Monorepo 工程中。

---

## 0. 文档入口分类

| 读者 / 场景 | 首读文档 | 继续读取 | 用途 |
|---|---|---|---|
| 新开发者了解项目 | `README.md` | `docs/governance/PROJECT_STATE_AND_VALIDATION.md` | 了解项目定位、目录结构、启动方式、验证命令 |
| Codex / Claude / Cursor / Antigravity 开始改代码 | `AGENTS.md` | 按 `AGENTS.md` 顶部任务路由表继续读 | 获取最高优先级规则、模块边界、安全边界、验证要求 |
| 开发 AI 助手 / 画布 Agent | `AGENTS.md` | `docs/ai-assistant/AI_ASSISTANT_ROADMAP.md`、`docs/ai-assistant/RUNBOOKS.md` | 实现 CanvasRuntimeState、ToolRegistry、DurableQueue、KnowledgeSync |
| 处理安全、计费、CORS、JWT、Provider、后端合并 | `AGENTS.md` | `docs/governance/SECURITY_AND_BACKLOG.md` | 执行 P0/P1/P2/P3 安全与架构收敛任务 |
| 检查当前完成度与验证状态 | `docs/governance/PROJECT_STATE_AND_VALIDATION.md` | `validation.md`、`status.md` 历史记录 | 判断哪些阶段已完成、哪些验证已通过 |
| 处理乱码、PowerShell 编码、文本格式 | `docs/governance/ENCODING_AND_POWERSHELL.md` | `.editorconfig`、`.gitattributes` | 统一 UTF-8 without BOM、LF、PowerShell 显式编码 |

`README.md` 是项目入口。`AGENTS.md` 是 AI / Agent 执行入口。详细执行路线、Runbook、治理状态、安全待办和编码规范分别进入 `docs/` 下的专门文档。

---

## 1. 当前稳定事实

```text
Project: KK Studio
Version: v1.5.4
Repository: soudbs180-creator/nano-banana-KK-
Version source of truth: config/release-manifest.json
Primary Web app: apps/web/
Mobile app: apps/mobile/
Backend runtime: server/ Express / VPS
Database migrations: migrations/
```

版本事实以 `config/release-manifest.json` 为第一来源。`package.json` 与各 workspace package 的 version 只能作为同步投影。

历史文档中可能仍出现 `1.4.x`、`1.5.0`、`1.5.1`、`src/`、`netlify/functions`、`payment-server` 或旧部署口径。当前开发必须以源码、`config/release-manifest.json`、`package.json`、`AGENTS.md` 和治理脚本为准。

---

## 2. 产品能力

### 2.1 无限画布创作

- Prompt 卡片编排
- 图片结果节点管理
- 选区、框选、分组、标签
- 画布缩放、平移、复位、全览
- 批量生成结果自动布局
- 选中卡片原图打包下载
- 错误结果、自动化轨道、电商 / PPT / Redraw 场景布局

### 2.2 多模型智能路由

- 前端通过 `packages/api-client` 或服务层调用后端
- Provider 协议差异由 LLMService / 后端代理 / API Client 屏蔽
- 用户自有 API 与系统积分模型明确分离
- 受保护 Provider 不允许浏览器端直连
- Provider 端点、模型能力、用户路由代理、系统代理集中治理

### 2.3 商业级积分、计费与退款审计

标准链路：

```text
预扣积分
  -> 调用 AI 接口
  -> 成功结算
  -> 失败退款
  -> 写入审计记录
```

硬规则：

- 前端不决定最终余额
- 不允许并发负余额
- 不允许绕过 Stripe Webhook 验签
- 不允许跳过退款记录
- 不允许跳过积分流水和审计日志

### 2.4 AI 助手 / 画布 Agent

KK Studio 的 AI 助手不是聊天机器人，而是项目级、画布级、任务级 Agent。目标是通过：

```text
项目知识库 + CanvasRuntimeState + ToolRegistry + DurableQueue + Skills/Runbooks + Handoff
```

实现：

- 理解当前画布、选区、视口、输入框和最近事件
- 直接调用项目内部能力，而不是模拟用户点击
- 批量执行生成、下载、整理、定位、记录知识
- 在中断后恢复执行
- 在 UI / Flow / Tool 变化后更新知识库和 Runbook

详细路线见 `docs/ai-assistant/AI_ASSISTANT_ROADMAP.md`。

---

## 3. 技术栈

| 层级 | 技术 / 事实 |
|---|---|
| Web | Vite + React 19 + TypeScript + Tailwind + AntD / Lobe UI Bridge |
| Mobile | Expo + React Native / expo-router |
| Shared | TypeScript ESM contracts / domain |
| API Client | typed HTTP client / multi-platform session boundary |
| UI | design tokens / UI bridge / cross-platform presets |
| Backend | Node.js / Express / VPS runtime |
| Database | PostgreSQL |
| Payment | Stripe Webhook with signature verification |
| Monorepo | npm workspaces |
| Governance | architecture / version / security / encoding / tests / build checks |

Node 与 npm 版本以根 `package.json` 中的 `engines.node` 与 `packageManager` 为准。

---

## 4. 仓库结构

```text
nano-banana-KK-/
├── apps/
│   ├── web/                         # 桌面 Web 主运行时
│   └── mobile/                      # Expo 移动端
├── packages/
│   ├── shared/                      # 跨端纯 TS 契约与领域规则
│   ├── api-client/                  # 统一 HTTP 客户端
│   └── ui/                          # 设计令牌与 UI 适配层
├── server/                          # Express / VPS 后端、代理、积分、Webhook
├── migrations/                      # PostgreSQL DDL 唯一合法来源
├── docs/
│   ├── ai-assistant/                # AI 助手路线、Runbooks、知识库
│   └── governance/                  # 状态、验证、安全、编码规范
├── scripts/                         # CI、治理、发布、测试、维护脚本
├── tests/                           # 单元、集成、契约、E2E 测试
├── config/                          # release manifest 与项目配置
├── AGENTS.md                        # AI / Agent 最高执行规范
└── README.md                        # 项目入口
```

---

## 5. 模块职责矩阵

| 模块 | 核心职责 | 关键边界 |
|---|---|---|
| `apps/web/` | 桌面端画布、Web UI、AI 接管入口 | 不引入 RN / Expo；不直接写 DB；不直接读取密钥 |
| `apps/mobile/` | 移动端 App | 不直接调用 DOM / BOM 专属 API |
| `packages/shared/` | DTO、类型、枚举、领域规则 | 纯 TypeScript；不引入 React / DOM / RN / Node 专属 API |
| `packages/api-client/` | HTTP API 边界、跨端 Session | 平台存储依赖注入；不硬编码 localStorage / SecureStore |
| `packages/ui/` | 设计令牌、基础组件、Bridge | 不放业务状态；不放模型调用逻辑 |
| `server/` | API 代理、积分、退款、Stripe、文件落盘 | 不引入前端组件；不使用弱默认密钥 |
| `migrations/` | 数据库结构变更 | 只做 DDL / 必要 DML；不写业务逻辑 |

---

## 6. 快速启动

### 6.1 安装依赖

```bash
npm install
```

### 6.2 配置环境变量

```bash
cp .env.example .env
```

真实 `.env`、API Key、数据库连接串、Stripe Secret、Webhook Secret 不得提交到 Git。

### 6.3 构建共享包

```bash
npm run build -w packages/api-client
```

如修改了 `packages/shared` 或 `packages/ui`，也应构建对应 workspace。

### 6.4 启动开发环境

```bash
npm run dev:start
```

默认入口以实际启动日志为准。历史 README 曾记录：

```text
Web: http://localhost:3000
API: http://localhost:3001
Mobile: cd apps/mobile && npx expo start
```

如果端口与当前脚本不一致，以当前 `package.json` scripts 与启动日志为准。

---

## 7. 验证命令

完整验证：

```bash
npm run verify:changes
```

常用分项：

```bash
npm run architecture:check
npm run governance:check
npm run governance:security
npm run typecheck
npm run test
npm run build
npm run check:encoding
```

涉及 AI 助手时，优先补充运行：

```bash
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/ai-assistant-tool-registry.test.ts tests/unit/canvas-runtime-state-builder.test.ts tests/unit/zip-selected-originals.test.ts tests/unit/durable-generation-queue.test.ts tests/unit/agent-knowledge-sync.test.ts tests/unit/ai-takeover-confirmationPolicy.test.ts tests/unit/ai-takeover-safetyPolicy.test.ts
```

---

## 8. 编码规范入口

所有源码、配置、脚本、文档、普通文本文件默认使用：

```text
UTF-8 without BOM
LF
```

PowerShell 写文件必须显式指定编码。完整规则见：

```text
docs/governance/ENCODING_AND_POWERSHELL.md
```

---

## 9. 相关文档

| 文档 | 用途 |
|---|---|
| `AGENTS.md` | AI / Agent 最高执行规范与任务路由 |
| `docs/ai-assistant/AI_ASSISTANT_ROADMAP.md` | AI 助手完整升级路线与 Sprint 执行细节 |
| `docs/ai-assistant/RUNBOOKS.md` | 可执行流程：下载选区原图、批量生成、整理卡片、添加工具、更新 UI Map、恢复中断 |
| `docs/governance/PROJECT_STATE_AND_VALIDATION.md` | 当前项目状态、里程碑、验证记录、历史事实修正 |
| `docs/governance/SECURITY_AND_BACKLOG.md` | 安全、后端、计费、CORS、JWT、Provider、工程质量待办 |
| `docs/governance/ENCODING_AND_POWERSHELL.md` | UTF-8、LF、PowerShell 编码规则 |

---

## 10. 项目结论

KK Studio v1.5.4 的开发重点是把现有多模态创作工作台收敛为：

```text
稳定 Monorepo 架构
  + 后端权威计费与安全代理
  + 无限画布资产系统
  + 结构化 AI Agent 执行层
  + 可恢复任务队列
  + 自动更新的项目知识库
```
