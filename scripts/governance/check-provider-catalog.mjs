#!/usr/bin/env node
/**
 * @file check-provider-catalog.mjs
 * @module scripts/governance
 * @description 比对共享 Canonical Catalog 数据事实源与现有前后端提供商数据的静态治理校验（P5）
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const frontendRegistryPath = resolve(repoRoot, 'apps/web/src/services/api/providerRegistry.ts');
const backendRegistryPath = resolve(repoRoot, 'services/api/lib/dispatcher/providerRegistry.js');

// 1. 加载并构建 Shared Catalog 引用
let CANONICAL_PROVIDER_CATALOG;
try {
  // 因为 @kk/shared 已经被打包到 dist/index.cjs 目录，我们可以直接动态 require 它
  const sharedModule = require(resolve(repoRoot, 'packages/shared/dist/index.cjs'));
  CANONICAL_PROVIDER_CATALOG = sharedModule.CANONICAL_PROVIDER_CATALOG;
} catch (error) {
  console.error('[FAIL] 无法加载共享模块 @kk/shared 中的 CANONICAL_PROVIDER_CATALOG。请确保运行过 npm run build。', error.message);
  process.exit(1);
}

if (!Array.isArray(CANONICAL_PROVIDER_CATALOG) || CANONICAL_PROVIDER_CATALOG.length === 0) {
  console.error('[FAIL] 共享的大模型供应商目录为空。');
  process.exit(1);
}

// 2. 加载后端 Registry 数据
let backendProviders;
try {
  const backendRegistry = require(backendRegistryPath);
  backendProviders = backendRegistry.listProviders();
} catch (error) {
  console.error(`[FAIL] 无法加载后端供应商注册表: ${backendRegistryPath}`, error.message);
  process.exit(1);
}

// 3. 读取并解析前端 Registry 文本
let frontendSource;
try {
  frontendSource = readFileSync(frontendRegistryPath, 'utf8');
} catch (error) {
  console.error(`[FAIL] 无法读取前端供应商注册表文件: ${frontendRegistryPath}`, error.message);
  process.exit(1);
}

const errors = [];

// 辅助匹配前端 ID 字典
const CATALOG_TO_FRONTEND_ID_MAP = {
  google: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  volcengine: 'Volcengine',
  aliyun: 'Aliyun',
  tencent: 'Tencent',
  siliconflow: 'SiliconFlow',
  openrouter: 'OpenRouter',
  apimart: 'APIMart',
  'gpt-best': 'GPTBest',
  wuyinkeji: 'Wuyin',
  '12ai': '12AI',
  flow2api: 'Flow2API',
  custom: 'Custom',
  systemproxy: 'SystemProxy'
};

// 辅助匹配后端 ID 字典
const CATALOG_TO_BACKEND_ID_MAP = {
  google: 'google-gemini-official',
  openai: 'openai-official',
  anthropic: 'anthropic-official',
  deepseek: 'deepseek-official',
  volcengine: 'volcengine-ark-openai-compatible',
  aliyun: 'dashscope-openai-compatible',
  tencent: 'tencent',
  siliconflow: 'siliconflow-openai-compatible',
  openrouter: 'openrouter-openai-compatible',
  apimart: 'apimart-openai-compatible',
  'gpt-best': 'gpt-best-openai-compatible',
  wuyinkeji: 'wuyin-suchuang-form',
  '12ai': '12ai-documented-multi-protocol',
  flow2api: 'flow2api-openai-compatible', // 在后端被 normalize 处理
};

// 正则解析前端 PROVIDER_REGISTRY 块
function getFrontendMetadata(id) {
  const feId = CATALOG_TO_FRONTEND_ID_MAP[id];
  if (!feId) return null;

  // 正则寻找类似于 `Google: { ... }` 或者是 `'Google': { ... }` 的结构
  const pattern = new RegExp(`['"]?${feId}['"]?\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`, 'i');
  const match = frontendSource.match(pattern);
  if (!match) return null;

  const body = match[1];
  const kindMatch = body.match(/kind\s*:\s*['"]([^'"]*)['"]/);
  const urlMatch = body.match(/defaultBaseUrl\s*:\s*['"]([^'"]*)['"]/);
  const labelMatch = body.match(/label\s*:\s*['"]([^'"]*)['"]/);

  return {
    kind: kindMatch ? kindMatch[1] : undefined,
    defaultBaseUrl: urlMatch ? urlMatch[1] : undefined,
    label: labelMatch ? labelMatch[1] : undefined
  };
}

console.log(`[governance:catalog] 开始执行 Canonical Provider Catalog 比对校验...`);

for (const catalogItem of CANONICAL_PROVIDER_CATALOG) {
  const { id, category, keyRef, defaultBaseUrl, uiIdentity } = catalogItem;

  // === A. 前端元数据校验 ===
  const feMeta = getFrontendMetadata(id);
  if (!feMeta) {
    if (id !== 'systemproxy' && id !== 'custom') { // 这两个在前端以特定形式展现或隐藏
      errors.push(`[FRONTEND DRIFT] 前端注册表中未找到提供商: "${id}"。请核对 apps/web/src/services/api/providerRegistry.ts`);
    }
  } else {
    // 校验 kind 分类对应性
    const expectedFeKind = category === 'official' ? 'official' : (category === 'relay' ? 'relay' : (category === 'custom' ? 'custom' : 'system'));
    if (feMeta.kind !== expectedFeKind) {
      errors.push(`[FRONTEND DRIFT] 提供商 "${id}" 种类不一致: Catalog为 "${expectedFeKind}"，而前端为 "${feMeta.kind}"。`);
    }
    // 校验 defaultBaseUrl 一致性
    if (defaultBaseUrl && feMeta.defaultBaseUrl && defaultBaseUrl.trim().replace(/\/+$/, '') !== feMeta.defaultBaseUrl.trim().replace(/\/+$/, '')) {
      errors.push(`[FRONTEND DRIFT] 提供商 "${id}" baseUrl 不一致: Catalog为 "${defaultBaseUrl}"，而前端为 "${feMeta.defaultBaseUrl}"。`);
    }
  }

  // === B. 后端 Registry 校验 ===
  const beId = CATALOG_TO_BACKEND_ID_MAP[id];
  if (beId) {
    const beProvider = backendProviders.find(p => p.id === beId);
    if (!beProvider) {
      // 允许 flow2api 这种暂时只在前端/策略管理的服务商在后端未被强注册
      if (id !== 'flow2api') {
        errors.push(`[BACKEND DRIFT] 后端注册表中未找到提供商: "${beId}" (Catalog id: "${id}")。`);
      }
    } else {
      // 1. 校验 keyRef 命名一致性
      if (keyRef && beProvider.auth && beProvider.auth.keyRef !== keyRef) {
        errors.push(`[BACKEND DRIFT] 提供商 "${id}" 密钥引用漂移: Catalog为 "${keyRef}"，而后端为 "${beProvider.auth.keyRef}"。`);
      }
      // 2. 校验 kind 映射
      const expectedBeKind = category === 'official' ? 'official' : (category === 'relay' ? 'relay' : 'byok-reverse-proxy');
      if (beProvider.kind !== expectedBeKind) {
        errors.push(`[BACKEND DRIFT] 提供商 "${id}" kind 不一致: Catalog为 "${expectedBeKind}"，而后端为 "${beProvider.kind}"。`);
      }
    }
  }
}

// 4. 报告校验状态
if (errors.length > 0) {
  console.error(`\n[FAIL] Catalog 强一致性校验失败，发现 ${errors.length} 项架构配置漂移:\n`);
  for (const err of errors) {
    console.error(`  - [FAIL] ${err}`);
  }
  process.exit(1);
}

console.log(`[PASS] Canonical Provider Catalog 比对成功。前后端数据源强一致，0 项漂移。`);
process.exit(0);
