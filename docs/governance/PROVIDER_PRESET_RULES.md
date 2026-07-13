<!-- AI_ROUTING_KEY: provider, preset, official, relay, gateway, docs-compliance -->
# 供应商预设规则（官方 / 中转站 / 浏览器会话）

> 配套校验脚本：`scripts/governance/check-provider-presets.mjs`，比对强校验脚本：`scripts/governance/check-provider-catalog.mjs`。
> 唯一真相来源：`packages/shared/src/generation/providerCatalog.ts` 中的 `CANONICAL_PROVIDER_CATALOG`。

本规则把“API 链接区分官方/中转站/用户会话、一个中转站不要两个预设、严格按运营商 API 文档执行”落地为**可被 CI 强制**的红线。

## 1. 唯一真相来源
项目已在 Phase P5 将唯一事实源升级为跨端共享的统一提供商目录 `CANONICAL_PROVIDER_CATALOG`。所有提供商一律在 Catalog 中注册，并通过比对脚本 `check-provider-catalog.mjs` 强制将此 Catalog 与前端注册表 `providerRegistry.ts` 以及后端画像 `providerProfiles.js` 进行一致性同步校验。**禁止**在前后端任意独立模块中另写散装或不一致的预设。

## 2. 强制红线（校验脚本）
| 规则 | 说明 | 级别 |
|---|---|---|
| R1 | 每个 profile 必须声明 `providerKind` ∈ `official` / `relay` / `byok-reverse-proxy` | FAIL |
| R2 | `profile.id`（含 `aliases`）全局唯一 | FAIL |
| R3 | 一个 `host`(domain) 只能归属一个 profile —— **一个中转站 = 一个预设** | FAIL |
| R4 | `relay` 必须提供 `strictDocs.source`（按该运营商官方文档执行的依据） | WARN→FAIL（清理后升级） |
| R5 | 检测绕过注册表的遗留旁路预设 | WARN |
| R6 | `relay` 不得借用官方品牌密钥名（如 `GEMINI_API_KEY`、`OPENAI_API_KEY`） | FAIL |
| R7 | 已知 `relay` 的密钥引用必须与自身身份一致，不得串用其它中转站密钥名 | FAIL |
| R8 | 前端显示层必须展示真实平台；OpenAI-compatible relay 不得显示成 OpenAI Official | FAIL |

## 3. 官方 / 中转站 / 浏览器会话命名
- `official`：直连官方 API 域名（如 `api.openai.com`、`generativelanguage.googleapis.com`）。
- `relay`（中转站）：第三方聚合/转发 API（如 `gpt-best`、`apimart`、`12ai`、`wuyin`）。
- `byok-reverse-proxy`：用户授权的官方网页会话、Browser Bridge 或后续安全反代入口；不得与官方 API key 或中转站 API key 混用。
- **禁止**用官方品牌的密钥名指代中转站（例：中转站 `vodeshop` 不得借用 `GEMINI_API_KEY`），密钥引用须与 profile 身份一致。
- **禁止**中转站之间串用密钥名（例：`gpt-best` 不得落到 `VODESHOP_API_KEY` 或 `VODESHOP_RELAY_API_KEY`）。
- **禁止**仅因协议兼容就借用官方显示名（例：`openrouter.ai`、`api.apimart.ai`、`api.gpt-best.com` 必须显示自身平台名，而不是 `OpenAI`）。

## 4. 前端显示规则
- `apps/web/src/services/api/providerRegistry.ts` 负责前端 provider 元数据与显示名称，不得只维护官方平台。
- `apps/web/src/utils/providerDisplay.ts` 必须优先根据已知 relay `baseUrl` 修正平台身份，避免历史节点或用户配置中的旧 `provider` 字段污染 UI。
- 模型卡片、历史节点和生成结果应显示真实平台、协议兼容性和账号模式；`OpenAI-compatible` 只是协议族，不是平台身份。

## 5. 统一供应商事实目录 (Canonical Provider Catalog)

项目在 Phase P5 实现了供应商事实源的统一数据治理。唯一真相来源已收敛到共享事实源：
👉 [`packages/shared/src/generation/providerCatalog.ts`](../../packages/shared/src/generation/providerCatalog.ts)（通过 `@kk/shared` 导出）

在 CI 门禁与本地发布验证中，由比对校验脚本 `check-provider-catalog.mjs` 强制守护此目录与前端注册表 `providerRegistry.ts` 以及后端画像 `providerProfiles.js` 的强一致性。

当前 Catalog 收录的供应商明细表如下：

| 提供商 ID | 显示名称 (Label) | 分类 (Category) | 协议支持 (Protocols) | 默认 Base URL | 鉴权密钥 (keyRef) |
|---|---|---|---|---|---|
| `google` | Google Cloud / Gemini | official | `gemini-native` | `https://generativelanguage.googleapis.com` | `GEMINI_API_KEY` |
| `openai` | OpenAI | official | `openai-compatible` | `https://api.openai.com/v1` | `OPENAI_API_KEY` |
| `anthropic` | Anthropic | official | `claude-native` | `https://api.anthropic.com/v1` | `ANTHROPIC_API_KEY` |
| `deepseek` | DeepSeek | official | `openai-compatible` | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` |
| `volcengine` | Volcengine | official | `openai-compatible` | `https://ark.cn-beijing.volces.com/api/v3` | `VOLCENGINE_API_KEY` |
| `aliyun` | Aliyun | official | `openai-compatible` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` |
| `tencent` | Tencent | official | `openai-compatible` | `https://api.hunyuan.cloud.tencent.com/v1` | `HUNYUAN_API_KEY` |
| `siliconflow` | SiliconFlow | relay | `openai-compatible` | `https://api.siliconflow.cn/v1` | `SILICONFLOW_API_KEY` |
| `openrouter` | OpenRouter | relay | `openai-compatible` | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` |
| `apimart` | APIMart | relay | `openai-compatible` | `https://api.apimart.ai/v1` | `APIMART_API_KEY` |
| `gpt-best` | GPT-Best | relay | `openai-compatible`, `gemini-native`, `claude-native` | `https://api.gpt-best.com/v1` | `GPT_BEST_API_KEY` |
| `wuyinkeji` | Wuyin / Suchuang API | relay | `openai-compatible`, `gemini-native` | `https://api.wuyinkeji.com` | `WUYIN_API_KEY` |
| `12ai` | 12AI | relay | `openai-compatible`, `gemini-native`, `claude-native` | `https://cdn.12ai.org` | `TWELVEAI_API_KEY` |
| `flow2api` | Flow2API | relay | `openai-compatible`, `gemini-native` | `http://127.0.0.1:8000` | `FLOW2API_API_KEY` |
| `custom` | Custom / Proxy | custom | `openai-compatible`, `gemini-native`, `claude-native` | - | - |
| `systemproxy` | System Proxy | system | `openai-compatible` | - | - |

## 6. 待清理的遗留旁路预设（R5 当前告警）
| 位置 | 问题 | 收敛目标 |
|---|---|---|
| `config/model_service_config.json` | vodeshop 中转预设未入注册表 + 密钥命名混淆 | 新增 `vodeshop-*` relay profile，密钥引用改名 |
| `api/pricing-proxy.js` | Wuyin 线上目录 + fallback 价目单容易被误读成双预设 | 价目单一来源，fallback 显式标记且不作为预设 |
| `server/providers/suchuangProvider.js` | 独立适配脱离统一引擎 | 折叠进 `wuyin-suchuang-form` profile + adapter |

## 7. 落地路线
1. **当前阶段（Phase P5已达成）**：建立了共享的 `providerCatalog.ts` 事实源，并在 CI 验证链（`verify:changes`）中挂载比对校验脚本 `check-provider-catalog.mjs`，消除前端与后端注册表的配置漂移（已对齐 DeepSeek, Aliyun, Volcengine, Tencent 的特定 Hosts 和密钥引用）。
2. **后续工作流**：逐项清理第 6 节的 R5 旁路预设 → 清零告警 → 将 R4/R5 升级为 FAIL 并拦截。
3. **更进一步**：逐步重构前端 `apiProviderPresets`、Key Manager 甚至后端配置库，使他们由同一 `ProviderCatalog` 动态派生/生成，实现 100% 运行时与配置无漂移生成链。
