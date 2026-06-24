<!-- AI_ROUTING_KEY: provider, preset, official, relay, gateway, docs-compliance -->
# 供应商预设规则（官方 / 中转站 / 浏览器会话）

> 配套校验脚本：`scripts/governance/check-provider-presets.mjs`（`node scripts/governance/check-provider-presets.mjs`）。
> 唯一真相来源：`server/lib/dispatcher/providerProfiles.js` 的 `PROVIDER_PROFILES`。

本规则把“API 链接区分官方/中转站/用户会话、一个中转站不要两个预设、严格按运营商 API 文档执行”落地为**可被 CI 强制**的红线。

## 1. 唯一真相来源
所有供应商（官方、中转站与后续浏览器会话/安全反代类入口）一律在 `PROVIDER_PROFILES` 注册，经 `matchProviderProfile` → `strictProviderContracts` → adapter 执行。**禁止**在 `config/`、`api/`、`server/routes/` 中另写散装预设。

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

## 5. 待清理的遗留旁路预设（R5 当前告警）
| 位置 | 问题 | 收敛目标 |
|---|---|---|
| `config/model_service_config.json` | vodeshop 中转预设未入注册表 + 密钥命名混淆 | 新增 `vodeshop-*` relay profile，密钥引用改名 |
| `api/pricing-proxy.js` | Wuyin 线上目录 + fallback 价目单容易被误读成双预设 | 价目单一来源，fallback 显式标记且不作为预设 |
| `server/providers/suchuangProvider.js` | 独立适配脱离统一引擎 | 折叠进 `wuyin-suchuang-form` profile + adapter |

## 6. 落地路线
1. 当前：脚本随 PR 合入，R1~R3/R6/R7 守住注册表不退化，R8 由前端 provider metadata/display contract 测试守住。
2. 后续工作流：逐项清理 R5 旁路预设 → 清零告警 → 将 R4/R5 升级为 FAIL，并纳入 `governance:check` 聚合。
3. 下一步：前端 `apiProviderPresets`、Key Manager Presets、`requestProfileRegistry`、`providerStrategy` 应收敛到同一 ProviderCatalog 生成链路，避免 UI 与后端事实源分叉。
