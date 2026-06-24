#!/usr/bin/env node
/**
 * @file check-provider-presets.mjs
 * @module scripts/governance
 * @description 供应商预设治理校验（官方 vs 中转站）。
 *   把“一个中转站 = 一个预设、官方与中转不混淆、relay 必须按运营商文档执行”
 *   变成 CI 可强制的红线，并自动揪出绕过 dispatcher/providerProfiles 的遗留旁路预设。
 *
 *   规则（详见 docs/governance/PROVIDER_PRESET_RULES.md）：
 *     R1 每个 profile 必须声明 providerKind ∈ {official, relay, byok-reverse-proxy}
 *     R2 profile.id（含 aliases）全局唯一
 *     R3 一个 host(domain) 只能归属一个 profile —— “一个中转站 = 一个预设”
 *     R4 relay 必须提供 strictDocs.source（按运营商文档执行的依据）
 *     R6 relay 不得借用官方品牌密钥名（GEMINI/OPENAI/..._API_KEY）——官方/中转命名隔离
 *     R7 已知 relay 的 authKeyEnv 必须与 provider 身份一致，不得串用其它中转站密钥名
 *     R5 检测绕过注册表的遗留散装预设（仅告警，不阻断 CI；待后续工作流清理）
 *
 *   退出码：硬性违规(R1~R3/R6/R7) 非零；R4/R5 仅告警，保持 main 绿色。
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const profilesPath = resolve(repoRoot, 'server/lib/dispatcher/providerProfiles.js');

if (!existsSync(profilesPath)) {
  console.error(`[FAIL] 找不到唯一供应商真相来源：${profilesPath}`);
  process.exit(1);
}

const { PROVIDER_PROFILES } = require(profilesPath);

if (!Array.isArray(PROVIDER_PROFILES) || PROVIDER_PROFILES.length === 0) {
  console.error('[FAIL] PROVIDER_PROFILES 为空或非数组。');
  process.exit(1);
}

/** relay 预设可豁免 strictDocs 的通用兜底条目（无固定运营商文档）。 */
const DOCS_EXEMPT_RELAY_IDS = new Set([
  'generic-openai-compatible',
  'one-api-new-api-compatible',
  'ollama-openai-compatible',
]);

const ALLOWED_PROVIDER_KINDS = new Set(['official', 'relay', 'byok-reverse-proxy']);
const RELAY_AUTHKEY_EXPECTATIONS = [
  { idPattern: /vodeshop/i, expected: 'VODESHOP_RELAY_API_KEY' },
  { idPattern: /apimart/i, expected: 'APIMART_API_KEY' },
  { idPattern: /12ai/i, expected: 'TWELVEAI_API_KEY' },
  { idPattern: /wuyin|suchuang/i, expected: 'WUYIN_API_KEY' },
];

const errors = [];
const warnings = [];

const seenIds = new Map();
const domainOwners = new Map();

for (const profile of PROVIDER_PROFILES) {
  const id = profile && profile.id;
  if (!id) {
    errors.push('R2 存在缺少 id 的 profile。');
    continue;
  }

  // R2 唯一 id / alias
  for (const candidate of [id, ...(Array.isArray(profile.aliases) ? profile.aliases : [])]) {
    if (seenIds.has(candidate)) {
      errors.push(`R2 重复 profile id/alias "${candidate}"（与 "${seenIds.get(candidate)}" 冲突）。`);
    } else {
      seenIds.set(candidate, id);
    }
  }

  // R1 providerKind 合法
  if (!ALLOWED_PROVIDER_KINDS.has(profile.providerKind)) {
    errors.push(`R1 profile "${id}" 缺少合法 providerKind（应为 official、relay 或 byok-reverse-proxy）。`);
  }

  // R3 一个 host 只能归属一个 profile —— 一个中转站 = 一个预设
  for (const domain of Array.isArray(profile.domains) ? profile.domains : []) {
    const host = String(domain).trim().toLowerCase();
    if (!host) continue;
    if (domainOwners.has(host)) {
      errors.push(`R3 host "${host}" 同时归属 "${domainOwners.get(host)}" 与 "${id}" —— 一个中转站不得有两个预设。`);
    } else {
      domainOwners.set(host, id);
    }
  }

  // R4 relay 必须挂运营商文档
  if (
    profile.providerKind === 'relay'
    && !DOCS_EXEMPT_RELAY_IDS.has(id)
    && !(profile.strictDocs && profile.strictDocs.source)
  ) {
    warnings.push(`R4 relay "${id}" 未声明 strictDocs.source（无法保证严格按运营商文档执行，存在“没按文档”的错误行为风险）。`);
  }

  // R6 relay 不得借用官方品牌密钥名（官方/中转命名隔离，硬性）
  if (
    profile.providerKind === 'relay'
    && typeof profile.authKeyEnv === 'string'
    && /(GEMINI|OPENAI|ANTHROPIC|CLAUDE|AZURE)_API_KEY/i.test(profile.authKeyEnv)
  ) {
    errors.push(`R6 relay "${id}" 不得借用官方品牌密钥名 "${profile.authKeyEnv}"（官方/中转命名必须隔离）。`);
  }

  // R7 已知 relay 的显式密钥名不得串用其它中转站身份。
  if (profile.providerKind === 'relay' && typeof profile.authKeyEnv === 'string') {
    const expectation = RELAY_AUTHKEY_EXPECTATIONS.find((item) => item.idPattern.test(id));
    if (expectation && profile.authKeyEnv !== expectation.expected) {
      errors.push(`R7 relay "${id}" 的 authKeyEnv 必须为 "${expectation.expected}"，当前为 "${profile.authKeyEnv}"。`);
    }
  }
}

// R5 遗留旁路预设（绕过 dispatcher/providerProfiles 的散装实现）
const LEGACY_BYPASS = [
  ['config/model_service_config.json', 'transit/vodeshop 预设未纳入 PROVIDER_PROFILES，且 apiKeyEnv=GEMINI_API_KEY 混淆官方/中转命名（违背官方 vs 中转区分）。'],
  ['server/providers/suchuangProvider.js', '独立 provider 适配应折叠进 wuyin-suchuang-form profile + 统一 adapter。'],
];
// 已知的 Vercel 部署代理薄层（非散装预设，仅做边缘反代转发，不含独立计费逻辑）
const VERCEL_PROXY_KNOWN = [
  'api/pricing-proxy.js',
];
for (const [rel, why] of LEGACY_BYPASS) {
  if (existsSync(resolve(repoRoot, rel))) {
    warnings.push(`R5 遗留旁路预设：${rel} —— ${why}`);
  }
}
for (const rel of VERCEL_PROXY_KNOWN) {
  if (existsSync(resolve(repoRoot, rel))) {
    // INFO 级别：Vercel 部署所需的代理薄层，不阻断也不告警
  }
}

// 报告
console.log(`供应商预设校验：profiles=${PROVIDER_PROFILES.length}，唯一 host=${domainOwners.size}`);
const officialCount = PROVIDER_PROFILES.filter((p) => p.providerKind === 'official').length;
const relayCount = PROVIDER_PROFILES.filter((p) => p.providerKind === 'relay').length;
const browserSessionCount = PROVIDER_PROFILES.filter((p) => p.providerKind === 'byok-reverse-proxy').length;
console.log(`  官方(official)=${officialCount}，中转(relay)=${relayCount}，浏览器会话/反代(byok-reverse-proxy)=${browserSessionCount}`);
for (const w of warnings) console.log(`  [WARN] ${w}`);
for (const e of errors) console.error(`  [FAIL] ${e}`);

if (errors.length > 0) {
  console.error(`\n校验未通过：${errors.length} 项硬性违规（R1~R3/R6/R7）。`);
  process.exit(1);
}
console.log(`\n校验通过：0 项硬性违规，${warnings.length} 项告警（需在后续工作流清理遗留旁路预设）。`);
