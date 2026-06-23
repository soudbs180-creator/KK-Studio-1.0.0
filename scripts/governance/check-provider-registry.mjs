// scripts/governance/check-provider-registry.mjs
// 中文注释：供应商注册表 CI 静态治理与防歧义校验脚本

import providerProfiles from '../../server/lib/dispatcher/providerProfiles.js';
const { PROVIDER_PROFILES } = providerProfiles;

console.log('[CI Governance] 正在执行供应商注册表静态与安全校验...');

const seenIds = new Set();
const seenHosts = new Set();
const seenPricingUrls = new Set();

const OFFICIAL_ENV_KEYS = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

let hasError = false;

for (const profile of PROVIDER_PROFILES) {
  // 1. 唯一性排他校验
  if (seenIds.has(profile.id)) {
    console.error(`[ERROR] 发现重复的供应商 ID: ${profile.id}`);
    hasError = true;
  }
  seenIds.add(profile.id);

  if (Array.isArray(profile.domains)) {
    for (const domain of profile.domains) {
      if (seenHosts.has(domain)) {
        console.error(`[ERROR] 供应商 '${profile.id}' 绑定的域名 '${domain}' 已被其他供应商占用，存在冲突！`);
        hasError = true;
      }
      seenHosts.add(domain);
    }
  }

  if (profile.catalogUrl) {
    if (seenPricingUrls.has(profile.catalogUrl)) {
      console.error(`[ERROR] 发现重复的在线定价来源 URL: ${profile.catalogUrl}`);
      hasError = true;
    }
    seenPricingUrls.add(profile.catalogUrl);
  }

  // 2. kind 完备性校验
  const kind = profile.providerKind || profile.kind;
  if (!kind) {
    console.error(`[ERROR] 供应商 '${profile.id}' 缺少 kind/providerKind 属性定义`);
    hasError = true;
  } else if (!['official', 'relay', 'byok-reverse-proxy'].includes(kind)) {
    console.error(`[ERROR] 供应商 '${profile.id}' 的 kind '${kind}' 不合法`);
    hasError = true;
  }

  // 3. 密钥命名解耦检查
  if (kind === 'relay') {
    const envKey = profile.apiKeyEnv || (profile.auth && profile.auth.keyRef);
    if (envKey && OFFICIAL_ENV_KEYS.includes(envKey)) {
      console.error(`[ERROR] 安全拦截: 中转供应商 '${profile.id}' 错误地引用了官方默认密钥 '${envKey}'！中转站密钥命名必须保持独立与隔离。`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.error('[CI Governance] 🔴 供应商注册表校验未通过，CI 失败！');
  process.exit(1);
} else {
  console.log('[CI Governance] 🟢 供应商注册表静态校验通过！所有 ID、域名、计费来源及密钥隔离校验合规。');
  process.exit(0);
}
