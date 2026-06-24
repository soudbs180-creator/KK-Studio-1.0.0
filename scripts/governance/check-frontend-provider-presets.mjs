#!/usr/bin/env node
/**
 * @file check-frontend-provider-presets.mjs
 * @module scripts/governance
 * @description Frontend provider preset guardrail. Backend PROVIDER_PROFILES is the
 *              authority, but UI preset files must not introduce new duplicate
 *              relay/provider identities. Existing legacy shortcuts are reported
 *              as warnings until they are migrated to model/capability aliases.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const keyManagerPresetPath = resolve(repoRoot, 'apps/web/src/services/auth/keyManagerProviderPresets.ts');
const apiSettingsPresetPath = resolve(repoRoot, 'apps/web/src/components/settings/apiProviderPresets.ts');
const frontendProviderRegistryPath = resolve(repoRoot, 'apps/web/src/services/api/providerRegistry.ts');
const providerDisplayPath = resolve(repoRoot, 'apps/web/src/utils/providerDisplay.ts');
const providerStrategyPath = resolve(repoRoot, 'apps/web/src/services/api/providerStrategy.ts');

const errors = [];
const warnings = [];

const ALLOWED_LEGACY_ALIAS_IDS = new Map([
]);

const REQUIRED_RELAY_HOST_PATTERNS = [
  'openrouter\\.ai',
  'apimart\\.ai',
  'gpt-best\\.com',
  'wuyinkeji\\.com',
  '12ai\\.org',
];

const EXPECTED_RUNTIME_STRATEGIES = [
  { id: 'openrouter', label: 'OpenRouter' },
  { id: '12ai', label: '12AI' },
  { id: 'wuyinkeji', label: 'Wuyin / Suchuang' },
  { id: 'gpt-best', label: 'GPT-Best' },
  { id: 'apimart', label: 'APIMart' },
];

const EXPECTED_RUNTIME_STRATEGY_GAPS = [
];

function readSource(filePath) {
  if (!existsSync(filePath)) {
    errors.push(`缺少前端 Provider 预设文件: ${filePath}`);
    return '';
  }
  return readFileSync(filePath, 'utf8');
}

function safeHost(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function collectKeyManagerPresets(source) {
  const result = [];
  const entryPattern = /['"]([^'"]+)['"]\s*:\s*\{([\s\S]*?)\n\s*\},/g;
  let match;
  while ((match = entryPattern.exec(source))) {
    const [, id, body] = match;
    const baseMatch = body.match(/baseUrl\s*:\s*['"]([^'"]*)['"]/);
    if (!baseMatch) continue;
    result.push({
      id,
      baseUrl: baseMatch[1],
      host: safeHost(baseMatch[1]),
      file: 'keyManagerProviderPresets.ts',
    });
  }
  return result;
}

function collectApiSettingsPresets(source) {
  const result = [];
  const inlinePattern = /\{\s*name:\s*['"]([^'"]+)['"][\s\S]*?baseUrl:\s*['"]([^'"]*)['"][\s\S]*?kind:\s*['"]relay['"][\s\S]*?\}/g;
  let match;
  while ((match = inlinePattern.exec(source))) {
    const [, name, baseUrl] = match;
    result.push({
      id: name,
      baseUrl,
      host: safeHost(baseUrl),
      file: 'apiProviderPresets.ts',
    });
  }
  return result;
}

function canonicalKey(entry) {
  const aliasTarget = ALLOWED_LEGACY_ALIAS_IDS.get(entry.id);
  return aliasTarget || entry.id;
}

function checkDuplicateHosts(entries) {
  const byHost = new Map();
  for (const entry of entries) {
    if (!entry.host || entry.host === 'localhost' || entry.host === '127.0.0.1') {
      continue;
    }
    const bucket = byHost.get(entry.host) || [];
    bucket.push(entry);
    byHost.set(entry.host, bucket);
  }

  for (const [host, bucket] of byHost.entries()) {
    if (bucket.length <= 1) continue;
    const canonicalIds = new Set(bucket.map(canonicalKey));
    if (canonicalIds.size === 1) {
      warnings.push(
        `legacy frontend provider alias: host=${host}, entries=${bucket.map((item) => `${item.file}:${item.id}`).join(', ')}. `
        + 'Keep as warning until shortcut presets are migrated to model/capability aliases.',
      );
      continue;
    }
    errors.push(
      `duplicate frontend relay provider host: host=${host}, entries=${bucket.map((item) => `${item.file}:${item.id}`).join(', ')}`,
    );
  }
}

function checkDisplayIdentityGovernance(frontendRegistrySource, providerDisplaySource) {
  if (!/PROVIDER_HOST_ALIAS_RULES/.test(frontendRegistrySource)) {
    errors.push('R8 前端 providerRegistry.ts 必须集中声明 PROVIDER_HOST_ALIAS_RULES。');
  }
  if (!/resolveProviderAliasFromBaseUrl/.test(frontendRegistrySource)) {
    errors.push('R8 前端 providerRegistry.ts 必须导出 resolveProviderAliasFromBaseUrl。');
  }
  for (const requiredPattern of REQUIRED_RELAY_HOST_PATTERNS) {
    if (!frontendRegistrySource.includes(requiredPattern)) {
      errors.push(`R8 前端 providerRegistry.ts 缺少已知 relay host 规则: ${requiredPattern}`);
    }
  }
  if (!/resolveProviderAliasFromBaseUrl\(target\.baseUrl\)/.test(providerDisplaySource)) {
    errors.push('R8 providerDisplay.ts 必须优先通过 resolveProviderAliasFromBaseUrl(target.baseUrl) 修正 relay 平台身份。');
  }
  if (/RELAY_HOST_PROVIDER_ALIASES/.test(providerDisplaySource)) {
    errors.push('R8 providerDisplay.ts 不得维护第二份 relay host map；必须复用 providerRegistry.ts。');
  }
}

function checkRuntimeStrategyCoverage(providerStrategySource) {
  for (const strategy of EXPECTED_RUNTIME_STRATEGIES) {
    if (!providerStrategySource.includes(`id: '${strategy.id}'`)) {
      errors.push(`R9 providerStrategy.ts 缺少运行时策略: ${strategy.label} (${strategy.id})。`);
    }
  }
  for (const gap of EXPECTED_RUNTIME_STRATEGY_GAPS) {
    if (!providerStrategySource.includes(`id: '${gap.id}'`)) {
      warnings.push(`R9 运行时策略待补齐: ${gap.label} (${gap.id})。${gap.reason}`);
    }
  }
}

const keyManagerSource = readSource(keyManagerPresetPath);
const apiSettingsSource = readSource(apiSettingsPresetPath);
const frontendProviderRegistrySource = readSource(frontendProviderRegistryPath);
const providerDisplaySource = readSource(providerDisplayPath);
const providerStrategySource = readSource(providerStrategyPath);

const keyManagerEntries = collectKeyManagerPresets(keyManagerSource);
const apiSettingsEntries = collectApiSettingsPresets(apiSettingsSource);

if (keyManagerEntries.length === 0) {
  errors.push('未能解析 keyManagerProviderPresets.ts 中的 PROVIDER_PRESETS。');
}
if (apiSettingsEntries.length === 0) {
  errors.push('未能解析 apiProviderPresets.ts 中的 relay PROVIDER_PRESETS。');
}

checkDuplicateHosts(keyManagerEntries);
checkDuplicateHosts(apiSettingsEntries);
checkDisplayIdentityGovernance(frontendProviderRegistrySource, providerDisplaySource);
checkRuntimeStrategyCoverage(providerStrategySource);

console.log(`[governance:frontend-providers] keyManager presets=${keyManagerEntries.length}, api settings relay presets=${apiSettingsEntries.length}`);
for (const warning of warnings) console.log(`  [WARN] ${warning}`);
for (const error of errors) console.error(`  [FAIL] ${error}`);

if (errors.length > 0) {
  console.error(`\n[FAIL] 前端 Provider 预设治理失败：${errors.length} 项硬性违规。`);
  process.exit(1);
}

console.log(`\n[PASS] 前端 Provider 预设治理通过，${warnings.length} 项历史别名/运行时缺口告警。`);
