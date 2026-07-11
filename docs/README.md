# KK Studio 项目文档导航 (docs/README.md)

欢迎使用 **KK Studio v1.6.0** 的项目文档知识库。本目录是 KK Studio 的开发与治理护城河。

为了确保 AI 编程助手（如 Codex、Claude、Cursor、Antigravity）和人类开发人员能够以最低的信息摩擦理解项目规则，所有文档均按照职责和生命周期进行了重组，并与项目根目录下的 [README.md](../README.md) 和最高执行规范 [AGENTS.md](../AGENTS.md) 建立了强映射关系。关于具体的技术分层，请参见技术栈与运行时定义 (Tech Layout & Runtime)。

---


## 🧭 文档路由总表

当您（或 AI 助手）需要修改或研究某个特定业务领域时，请根据下表直接定位到对应的文档和规则。**修改代码前必须先阅读对应的规范，严禁凭感觉和经验编写！**

| 任务类型 / 修改模块 | 必读文档 / 规则入口 | 辅助参考 / 继续阅读 | 核心要求 |
|---|---|---|---|
| **任意代码修改** | [AGENTS.md](../AGENTS.md) | [docs/architecture/PROJECT_STRUCTURE.md](architecture/PROJECT_STRUCTURE.md) | 最小变更、直接调用能力、运行 `npm run verify:changes` |
| **AI 助手 / 状态 / 工具** | [AGENTS.md](../AGENTS.md) §7-§11 | [docs/ai-assistant/README.md](ai-assistant/README.md) | CanvasRuntimeState 结构对齐、注册 ToolRegistry、不模拟 UI |
| **下载原图 / ZIP 打包** | [AGENTS.md](../AGENTS.md) §10.1 | [docs/ai-assistant/RUNBOOKS.md](ai-assistant/RUNBOOKS.md) 中 `download-selected-originals` | 优先 `originalUrl` 解析，ZIP 附带 manifest |
| **数据库结构变更** | [AGENTS.md](../AGENTS.md) §13 | [docs/architecture/DATABASE_SCHEMA.md](architecture/DATABASE_SCHEMA.md) | 必须走 `migrations/` 目录；DDL 幂等；严禁在业务层写 DDL |
| **系统安全 / 计费 / API 密钥** | [AGENTS.md](../AGENTS.md) §6、§12 | [docs/governance/SECURITY_AND_BACKLOG.md](governance/SECURITY_AND_BACKLOG.md) | 绝对禁止泄露明文密钥、绕过积分或 Stripe Webhook 验签 |
| **编码格式 / 乱码防护** | [AGENTS.md](../AGENTS.md) §15 | [docs/governance/ENCODING_AND_POWERSHELL.md](governance/ENCODING_AND_POWERSHELL.md) | 默认使用 `UTF-8 without BOM`、`LF` 换行，PowerShell 显式指定编码 |
| **系统部署 / Supabase CLI** | [docs/setup/README.md](setup/README.md) | [docs/setup/GUIDE.md](setup/GUIDE.md) | 遵循自发布 VPS 定时与权限配置 |
| **第三方接口规格 (gpt-best)** | [docs/specs/README.md](specs/README.md) | [docs/specs/API_DOCS.md](specs/API_DOCS.md) | 适配 Images/Videos/Audio v2 接口，轮询退避算法 |

---

## 📂 目录职责划分

| 目录 | 职责范围 | 包含的核心文档 |
|---|---|---|
| ⚖️ [governance/](governance/README.md) | **项目治理与红线**。定义不可违背的编码、安全漏洞与版本验证规范。 | [ENCODING_AND_POWERSHELL.md](governance/ENCODING_AND_POWERSHELL.md)<br>[SECURITY_AND_BACKLOG.md](governance/SECURITY_AND_BACKLOG.md)<br>[PROJECT_STATE_AND_VALIDATION.md](governance/PROJECT_STATE_AND_VALIDATION.md) |
| 🧠 [ai-assistant/](ai-assistant/README.md) | **AI 助手与 Agent 运行时**。提供 Canvas 运行态、工具库、指令运行及知识同步策略。 | [AI_ASSISTANT_ROADMAP.md](ai-assistant/AI_ASSISTANT_ROADMAP.md)<br>[RUNBOOKS.md](ai-assistant/RUNBOOKS.md)<br>[tool-registry.md](ai-assistant/tool-registry.md) |
| 🏛️ [architecture/](architecture/README.md) | **架构底座与数据分层**。定义真实的项目模块所有权、数据库设计及多端 UI 架构。 | [PROJECT_STRUCTURE.md](architecture/PROJECT_STRUCTURE.md)<br>[DATABASE_SCHEMA.md](architecture/DATABASE_SCHEMA.md)<br>[DESIGN.md](architecture/DESIGN.md) |
| 🔌 [specs/](specs/README.md) | **数据规格与 API 协议**。规范第三方提供商的 API 模型、轮询与对接参数。 | [openapi.yaml](specs/openapi.yaml)<br>[API_DOCS.md](specs/API_DOCS.md)<br>[NANO_BANANA.md](specs/NANO_BANANA.md) |
| 🛠️ [setup/](setup/README.md) | **环境搭建与自发布部署**。系统在 VPS 和 Supabase 上运行、配置、启动的命令手册。 | [GUIDE.md](setup/GUIDE.md)<br>[SUPABASE_CLI.md](setup/SUPABASE_CLI.md) |
| 💻 [development/](development/README.md) | **开发手册与交接模板**。指导多提供商架构设计、发布流以及 Durable 的会话交接。 | [session-handoff.md](development/session-handoff.md)<br>[multi-vendor-provider-architecture.md](development/multi-vendor-provider-architecture.md) |
| ⚡ [archive/superpowers/](archive/superpowers/README.md) | **具体业务功能计划归档**。留作历史架构与具体超级功能逻辑实现的开发参考。 | [plans/](archive/superpowers/plans/) 实施方案<br>[specs/](archive/superpowers/specs/) 业务定义 |
| 📊 [reports/](reports/README.md) | **分析与优化报告**。收集各类自动化或人工输出的性能与安全审计报告。 | [mobile-ui-optimization.md](reports/mobile-ui-optimization.md) |
| 📦 [archive/](archive/README.md) | **归档区**。存放已经过时、与 v1.5.9 事实相冲突的历史文档，仅供追溯历史使用。 | 🚫 **警告：AI 严禁将此处文档作为当前代码开发的参考依据！** |

---

## 🛡️ 文档一致性保证

1. **去冗余化**：docs/ 目录下不再允许保留同名冗余文件，如发现重复文件，以 `governance/`、`ai-assistant/` 和 `architecture/` 为最高优先级，其余一律归档或删除。
2. **拒绝陈旧信息**：所有与 Supabase 时代相关的旧版鉴权和积分扣减说明均已移入 `archive/`。在 v1.5.9 之后的开发中，应严格以 VPS 上的 PostgreSQL 自建 DDL (`migrations/`) 和 `server/` 代码为准。
3. **编码防乱码**：所有在此知识库中新增或修改的 Markdown 文档，必须使用 `UTF-8 without BOM` 编码及 `LF` 换行符。
