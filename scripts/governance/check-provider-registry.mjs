#!/usr/bin/env node
/**
 * @file check-provider-registry.mjs
 * @module scripts/governance
 * @description 供应商注册表静态治理拦截门禁（WS-1）
 *
 * 强制执行以下规则：
 *   1. 排他性校验：所有条目的 id、host、pricingSource.url (当为 online 时) 必须全局唯一，禁止重复。
 *   2. kind 完备校验：kind 必须存在且属于限制枚举 (official | relay | byok-reverse-proxy)。
 *   3. 密钥命名解耦：当中转站 kind === 'relay' 时，其 auth.keyRef 禁止引用官方密钥环境变量名，以防止混淆。
 *   4. 中转站语义隔离：已知 relay 的 auth.keyRef 必须与 provider 身份一致，不得串用其它中转站密钥名。
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const registryPath = resolve(repoRoot, 'server/lib/dispatcher/providerRegistry.js');

let getProvider, listProviders;
try {
  const registryModule = require(registryPath);
  getProvider = registryModule.getProvider;
  listProviders = registryModule.listProviders;
} catch (error) {
  console.error(`[FAIL] 无法加载供应商注册表模块: ${registryPath}`, error.message);
  process.exit(1);
}

const providers = listProviders();
if (!Array.isArray(providers) || providers.length === 0) {
  console.error('[FAIL] 供应商注册表数据加载为空或格式错误。');
  process.exit(1);
}

const errors = [];
const seenIds = new Set();
const seenHosts = new Set();
const seenPricingUrls = new Set();

const OFFICIAL_KEY_REGEX = /^(GEMINI|OPENAI|ANTHROPIC|CLAUDE|AZURE)_API_KEY$/i;
const ALLOWED_KINDS = ['official', 'relay', 'byok-reverse-proxy'];
const RELAY_KEYREF_EXPECTATIONS = [
  { idPattern: /gpt-best/i, expected: 'GPT_BEST_API_KEY' },
  { idPattern: /vodeshop/i, expected: 'VODESHOP_RELAY_API_KEY' },
  { idPattern: /apimart/i, expected: 'APIMART_API_KEY' },
  { idPattern: /12ai/i, expected: 'TWELVEAI_API_KEY' },
  { idPattern: /wuyin|suchuang/i, expected: 'WUYIN_API_KEY' },
];

for (const provider of providers) {
  const { id, kind, host, auth, pricingSource } = provider;

  // 1. 基础字段非空检查 (Zod 已解析, 此处作保险)
  if (!id) {
    errors.push('存在缺 id 的供应商注册条目。');
    continue;
  }

  // 2. kind 完备校验
  if (!kind || !ALLOWED_KINDS.includes(kind)) {
    errors.push(`供应商 "${id}" 的 kind "${kind}" 不合法 (必须为 official, relay 或 byok-reverse-proxy 之一)。`);
  }

  // 3. 排他性校验：ID 查重
  if (seenIds.has(id)) {
    errors.push(`排他性违规: 重复的供应商 ID "${id}"。`);
  } else {
    seenIds.add(id);
  }

  // 3. 排他性校验：Host 查重
  if (host) {
    const cleanHost = host.trim().toLowerCase();
    if (seenHosts.has(cleanHost)) {
      errors.push(`排他性违规: 供应商 "${id}" 的 host "${cleanHost}" 与其他条目重复。`);
    } else {
      seenHosts.add(cleanHost);
    }
  }

  // 3. 排他性校验：pricingSource.url 查重
  if (pricingSource && pricingSource.sourceType === 'online' && pricingSource.url) {
    const cleanUrl = pricingSource.url.trim().toLowerCase();
    if (seenPricingUrls.has(cleanUrl)) {
      errors.push(`排他性违规: 供应商 "${id}" 的 pricingSource.url "${cleanUrl}" 与其他条目重复。`);
    } else {
      seenPricingUrls.add(cleanUrl);
    }
  }

  // 4. 密钥命名解耦
  if (kind === 'relay' && auth && auth.keyRef) {
    const keyRef = auth.keyRef.trim();
    if (OFFICIAL_KEY_REGEX.test(keyRef)) {
      errors.push(`安全合规违规: 中转站 (relay) "${id}" 的 auth.keyRef "${auth.keyRef}" 不得借用官方环境变量名（官方/中转命名必须绝对隔离）。`);
    }

    const expectation = RELAY_KEYREF_EXPECTATIONS.find((item) => item.idPattern.test(id));
    if (expectation && keyRef !== expectation.expected) {
      errors.push(`安全合规违规: 中转站 (relay) "${id}" 的 auth.keyRef 必须为 "${expectation.expected}"，当前为 "${keyRef}"。`);
    }
  }
}

// 报告与拦截
console.log(`[governance:registry] 静态治理校验: 注册项数量=${providers.length}, 唯一 host 数量=${seenHosts.size}`);

if (errors.length > 0) {
  console.error(`\n[FAIL] 供应商注册表强规则校验失败, 发现 ${errors.length} 项硬性违规:\n`);
  for (const err of errors) {
    console.error(`  - [FAIL] ${err}`);
  }
  process.exit(1);
}

console.log('\n[PASS] 供应商注册表静态治理校验成功，0 项违规。');
process.exit(0);
