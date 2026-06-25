# AGENTS.md - Workspace Agent Rules — KK Studio v1.5.8

Last updated: 2026-06-25
Project version: 1.5.8
Version source of truth: `config/release-manifest.json`

Welcome, AI Agent! This file defines the absolute development boundaries, safety rules, and synchronization guard protocols for KK Studio v1.5.8. You must read and obey these rules without exception.

---

## 🧭 1. 物理架构与修改边界

所有的开发与重构修改，必须严格限制在 Monorepo 分层边界内，严禁越界：

| 修改诉求 | 唯一合法修改路径 | 🚫 严禁事项 |
| :--- | :--- | :--- |
| **Web 前端页面、画布交互** | `apps/web/` | 绝对禁止回到根 `src/`；禁止在组件内部直连数据库或执行 Node 模块。 |
| **移动端原生交互与 App 界面** | `apps/mobile/` | 绝对禁止在此处引入 `window`、`document` 等 DOM/BOM 专属对象。 |
| **通用数据类型、契约与领域模型** | `packages/shared/` | 必须是平台 neutral。绝对禁止引入 React 组件或 Node-only 依赖。 |
| **API 客户端交互与凭证状态** | `packages/api-client/` | 绝对禁止硬编码特定存储（如 `localStorage`）；必须使用依赖注入。 |
| **UI 主题、卡片 Token 与通用 UI 桥接** | `packages/ui/` | 绝对禁止在 UI 库中写入任何具体的业务状态管理和模型生成逻辑。 |
| **后端 API 代理、Stripe 计费与物理文件落盘** | `server/` | 绝对禁止前端直连敏感密钥或数据库；禁止为必需环境变量设置默认 fallback 值。 |
| **数据库 Schema 结构变化** | `migrations/` | 绝对禁止在业务代码中执行 `ALTER TABLE` / `CREATE TABLE` 等 DDL 语句。 |

---

## 🔒 2. 安全敏感防护红线

* **密钥管理**: API 密钥只能通过内存和本地加密的 `localStorage` 保持，绝对禁止在前端代码中暴露明文密钥或硬编码 fallback。
* **计费与积分**: 积分扣减与退款必须采用 Express 后端事务链控制，生图扣 10 credits，图生图扣 15 credits，对话扣 2 credits。禁止绕过计费。
* **文件编码**: 所有的代码和文档保存编码必须为 **`UTF-8 without BOM`** 且以 **`LF`** 换行。PowerShell 写文件时必须显式加 `-Encoding utf8NoBOM`。

---

## 🤖 3. AI / Agent 运行时交互协议

1. **ToolRegistry 优先**: 内置 AI 助手在执行任务（如批量出图、原图下载、卡片排列）时，**绝对禁止模拟 UI 点击或在 PromptBar 输入框填值**，必须直接调用注册在 `ToolRegistry` 中的工具（如 `generation.createBatchJob`）。
2. **权限校验**: 敏感操作工具（如删除、覆盖、扣积分）必须通过 `ConfirmationPolicy` 展示确认卡片，待用户点击确认后方能运行。

---

## 🔄 4. 多 Agent 协作与状态同步守卫协议 (Multi-Agent Sync Protocol)

为防止 Codex 与 Antigravity 两个物理 Agent 重复修改、编辑器缓存覆盖或代码冲突，所有 Agent 接手与完成任务时必须强制执行以下动作：

### 4.1 接手期校验 (Pre-flight Check)
1. **本地状态校验**: 接手任务第一步，必须在控制台运行 `npm run agents:status` 检查本地状态。如果检测到工作区存在未提交的脏文件，必须先告知用户，严禁直接在脏工作区修改。
2. **重读文件，废弃老缓存**: 严禁使用大模型自带的旧 Context 记忆去推测代码。在修改任何代码文件之前，**必须重新调用文件读取工具 (如 view_file)**，以获取磁盘上的最新源码。

### 4.2 交付期同步 (Post-flight Sync)
1. **追加交接记录**: 任务结束时，将修改范围、涉及文件及设计决策记录到 `docs/development/session-handoff.md`。
2. **Git 固化提交**: 验证通过后，**必须在控制台运行 `npm run agents:commit`** 将当前工作固化为本地 Git Commit。该脚本会自动分析 handoff 最新追加条目的标题作为 Commit 描述并绕过 Husky 静态资产校验提交。
