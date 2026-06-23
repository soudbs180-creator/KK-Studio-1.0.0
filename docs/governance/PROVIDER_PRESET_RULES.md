<!-- AI_ROUTING_KEY: provider, preset, official, relay, gateway, docs-compliance -->
# 供应商预设规则（官方 vs 中转站）

> 配套校验脚本：`scripts/governance/check-provider-presets.mjs`（`node scripts/governance/check-provider-presets.mjs`）。
> 唯一真相来源：`server/lib/dispatcher/providerProfiles.js` 的 `PROVIDER_PROFILES`。

本规则把“API 链接区分官方/中转站、一个中转站不要两个预设、严格按运营商 API 文档执行”落地为**可被 CI 强制**的红线。

## 1. 唯一真相来源
所有供应商（官方与中转站）一律在 `PROVIDER_PROFILES` 注册，经 `matchProviderProfile` → `strictProviderContracts` → adapter 执行。**禁止**在 `config/`、`api/`、`server/routes/` 中另写散装预设。

## 2. 强制红线（校验脚本）
| 规则 | 说明 | 级别 |
|---|---|---|
| R1 | 每个 profile 必须声明 `providerKind` ∈ `official` / `relay` | FAIL |
| R2 | `profile.id`（含 `aliases`）全局唯一 | FAIL |
| R3 | 一个 `host`(domain) 只能归属一个 profile —— **一个中转站 = 一个预设** | FAIL |
| R4 | `relay` 必须提供 `strictDocs.source`（按该运营商官方文档执行的依据） | WARN→FAIL（清理后升级） |
| R5 | 检测绕过注册表的遗留旁路预设 | WARN |

## 3. 官方 vs 中转站命名
- `official`：直连官方域名（如 `api.openai.com`、`generativelanguage.googleapis.com`）。
- `relay`（中转站）：第三方聚合/转发（如 `gpt-best`、`apimart`、`12ai`、`wuyin`）。
- **禁止**用官方品牌的密钥名指代中转站（例：中转站 `vodeshop` 不得借用 `GEMINI_API_KEY`），密钥引用须与 profile 身份一致。

## 4. 待清理的遗留旁路预设（R5 当前告警）
| 位置 | 问题 | 收敛目标 |
|---|---|---|
| `config/model_service_config.json` | vodeshop 中转预设未入注册表 + 密钥命名混淆 | 新增 `vodeshop-*` relay profile，密钥引用改名 |
| `api/pricing-proxy.js` | Wuyin 线上目录 + 内嵌 `FALLBACK_CATALOG` 双预设 | 价目单一来源，fallback 显式标记且不作为预设 |
| `server/providers/suchuangProvider.js` | 独立适配脱离统一引擎 | 折叠进 `wuyin-suchuang-form` profile + adapter |

## 5. 落地路线
1. 当前：脚本随 PR 合入，R1~R3 守住注册表不退化（main 现状全部通过）。
2. 后续工作流：逐项清理 R5 旁路预设 → 清零告警 → 将 R4/R5 升级为 FAIL，并纳入 `governance:check` 聚合。
