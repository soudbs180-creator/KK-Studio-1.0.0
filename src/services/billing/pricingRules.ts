/**
 * 计费与倍率解析规则事实唯一源 (Fact-of-Truth Shared Pricing Rules)
 * 
 * 此模块可在 Vercel Edge Runtime 和浏览器端双侧（同构）导入。
 * 包含供应商价格映射、计费模式转换、分组倍率解析和响应数据标准化规则。
 */

// ============== 类型定义 ==============

export const BillingMode = {
  TIMES: 'times',     // 按次计费
  TOKENS: 'tokens'    // 按 Token 计费
} as const;

export type BillingMode = typeof BillingMode[keyof typeof BillingMode];

// 前端通用的计费配置格式接口
export interface PricingConfig {
  modelId: string;
  modelName: string;
  inputPrice: number;  // 每 1M tokens 的价格 (或单次价格)
  outputPrice: number; // 每 1M tokens 的价格
  groupRatio: number;  // 分组倍率
  currency: string;
  type: 'tokens' | 'times';
}

// 统一标准化的计费属性结构，融合前后端所需字段
export interface NormalizedBilling extends PricingConfig {
  provider?: string;
  providerLabel?: string;
  provider_label?: string;
  providerLogo?: string;
  provider_logo?: string;
  description?: string;
  tags?: string[];
  availableGroups?: string[];
  tokenGroup?: string;
  billingType: string; // 原始计费类型如 'token', 'per_request', 'multiplier' 等
  endpointType?: string;
  endpointTypes?: string[];
  modelRatio?: number;
  modelPrice?: number;
  completionRatio?: number;
  sizeRatio?: Record<string, number>;
  groupModelRatio?: Record<string, number>;
  groupSizeRatio?: any;
  groupModelPrice?: any;
  quotaType?: number;
}

// 供解析返回的结构
export type PricingRow = Record<string, any>;
export type ParsedPayload = { data: PricingRow[]; groupRatio: Record<string, number> };
export type DiscoveryTarget = { key: string; url: string; accept: string };

// ============== 1. 供应商 Token 单价基准映射 ==============

export const ProviderPriceMap: Record<string, { input: number; output: number }> = {
  'openai': { input: 0.15, output: 0.60 },     // 经典 GPT-4o-mini 基准美金价格 (每 1M tokens)
  'anthropic': { input: 3.00, output: 15.00 },   // Claude 3.5 Sonnet 基准美金价格
  'google': { input: 0.075, output: 0.30 },     // Gemini 1.5 Flash 基准美金价格
  'deepseek': { input: 0.14, output: 0.28 },     // DeepSeek Chat V3 基准美金价格
  'alibaba': { input: 2.00, output: 6.00 },       // 通义千问 Qwen 基准价格
  'bytedance': { input: 2.00, output: 6.00 },     // 豆包模型基准价格
  'tencent': { input: 2.00, output: 6.00 },       // 腾讯混元基准价格
  'zhipu': { input: 2.00, output: 6.00 },         // 智谱 GLM 基准价格
  'moonshot': { input: 12.00, output: 12.00 },    // Kimi 基准价格
  'minimax': { input: 0.15, output: 0.60 },       // MiniMax 基准价格
  'xai': { input: 2.00, output: 10.00 },          // Grok 基准价格
};

// ============== 2. 计费模式判断规则 ==============

/**
 * 判断是按次计费还是按 Token 计费
 */
export function getBillingMode(rawType: unknown, rawQuotaType?: unknown): BillingMode {
  const raw = String(rawType ?? rawQuotaType ?? '').trim().toLowerCase();
  if (/按次|times|per.?request|request|fixed|image/i.test(raw)) {
    return BillingMode.TIMES;
  }
  return BillingMode.TOKENS;
}

// ============== 3. 分组倍率解析函数 ==============

/**
 * 从文本中强力解析出数字形式的分组倍率。
 * 支持 "vip: 2.0"、"default: 1.5"、"1.5"、"×2.0" 等各种格式。
 */
export function parseGroupMultiplier(raw: string): number {
  if (!raw) return 1.0;
  
  const trimmed = raw.trim();
  
  // 1. 尝试直接转换为数字
  const directNum = Number(trimmed);
  if (!isNaN(directNum) && isFinite(directNum)) {
    return directNum;
  }
  
  // 2. 如果包含冒号，提取冒号后的内容进行解析
  const colonIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');
  if (colonIndex !== -1) {
    const valuePart = trimmed.slice(colonIndex + 1).trim();
    const cleanValue = valuePart.replace(/[xX*×\s]/g, '');
    const num = Number(cleanValue);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  
  // 3. 正则表达式兜底：查找第一个浮点数或整数
  const match = trimmed.match(/\d+(?:\.\d+)?/);
  if (match) {
    const num = Number(match[0]);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  
  return 1.0;
}

// ============== 4. 响应字段的标准化映射 ==============

/**
 * 根据模型 ID 智能推断供应商名称
 */
export function inferProviderFromModel(model: string): string | undefined {
  const raw = String(model || '').toLowerCase();
  if (!raw) return undefined;
  if (raw.includes('gemini') || raw.includes('imagen') || raw.includes('veo')) return 'Google';
  if (raw.includes('gpt') || raw.includes('o1') || raw.includes('o3') || raw.includes('dall-e')) return 'OpenAI';
  if (raw.includes('claude')) return 'Anthropic';
  if (raw.includes('deepseek')) return 'DeepSeek';
  if (raw.includes('qwen') || raw.includes('wanx')) return 'Alibaba';
  if (raw.includes('doubao')) return 'ByteDance';
  if (raw.includes('hunyuan')) return 'Tencent';
  if (raw.includes('glm') || raw.includes('zhipu')) return '智谱';
  if (raw.includes('moonshot') || raw.includes('kimi')) return 'Moonshot';
  if (raw.includes('minimax')) return 'MiniMax';
  if (raw.includes('xai') || raw.includes('grok')) return 'xAI';
  if (raw.includes('pixverse')) return 'PixVerse';
  if (raw.includes('luma')) return 'Luma';
  if (raw.includes('runway')) return 'Runway';
  return undefined;
}

/**
 * 转换和规格化数值
 */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * 格式化字符串数组
 */
export function normalizeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const result = value.map((item) => String(item || '').trim()).filter(Boolean);
    return result.length ? result : undefined;
  }
  if (typeof value === 'string') {
    const result = value.split(/[,|/、\s]+/).map((item) => item.trim()).filter(Boolean);
    return result.length ? result : undefined;
  }
  return undefined;
}

/**
 * 格式化计费类型
 */
export function normalizeBillingType(value: unknown, quotaType?: unknown): string {
  const raw = String(value ?? quotaType ?? '').trim().toLowerCase();
  if (!raw) return 'token';
  if (/按次|per.?request|request|fixed|image/i.test(raw)) return 'per_request';
  if (/按量|token|tokens|quota/i.test(raw)) return 'token';
  if (/倍率|multiplier|ratio/i.test(raw)) return 'multiplier';
  return raw;
}

/**
 * 格式化端点类型
 */
export function normalizeEndpointType(value: unknown, modelName?: string): string | undefined {
  const raw = String(value || '').trim().toLowerCase();
  if (raw) return raw;
  const model = String(modelName || '').toLowerCase();
  if (!model) return undefined;
  if (model.includes('gemini') || model.includes('imagen') || model.includes('veo')) return 'gemini';
  if (model.includes('claude')) return 'anthropic';
  return 'openai';
}

/**
 * 格式化倍率映射关系
 */
export function normalizeRatioMap(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const normalized = Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, raw]) => {
    const parsed = toNumber(raw);
    if (parsed !== undefined) {
      acc[String(key)] = parsed;
    }
    return acc;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * 标准化单行 API 计费字段映射
 */
export function normalizeApiResponse(raw: unknown, groupRatioMap: Record<string, number> = {}): NormalizedBilling | null {
  if (!raw || typeof raw !== 'object') return null;

  const item = raw as Record<string, any>;
  const modelId = String(item.model ?? item.model_id ?? item.modelId ?? item.model_name ?? item.modelName ?? item.name ?? item.id ?? '').trim();
  if (!modelId) return null;

  const modelName = String(item.model_name ?? item.modelName ?? item.model ?? item.model_id ?? item.name ?? '').trim();
  const quotaType = item.quota_type ?? item.quotaType;
  
  const provider = String(
    item.provider ?? item.provider_name ?? item.providerName ?? item.vendor ?? item.manufacturer ?? item.owned_by ?? inferProviderFromModel(modelName) ?? ''
  ).trim() || undefined;
  
  const providerLabel = String(item.provider_label ?? item.providerLabel ?? provider ?? '').trim() || undefined;

  const billingType = normalizeBillingType(item.billing_type ?? item.billingType ?? item.type, quotaType);
  const mode = getBillingMode(billingType, quotaType);
  const type = mode === BillingMode.TIMES ? 'times' as const : 'tokens' as const;

  // 价格提取
  const perRequestPrice = toNumber(
    item.perRequestPrice ?? item.per_request_price ?? item.price_per_image ?? item.price ?? item.modelPrice ?? item.model_price
  );
  
  let inputPrice = toNumber(
    item.inputPrice ?? item.input_price ?? item.price ?? item.modelPrice ?? item.model_price
  ) ?? (type === 'times' ? perRequestPrice : undefined) ?? 0;
  
  let outputPrice = toNumber(
    item.outputPrice ?? item.output_price ?? item.completionPrice ?? item.completion_price
  ) ?? (type === 'times' ? 0 : inputPrice);

  // 如果价格全部为 0 且供应商已知，尝试使用基准映射兜底
  if (inputPrice === 0 && outputPrice === 0 && provider) {
    const defaultPrice = ProviderPriceMap[provider.toLowerCase()];
    if (defaultPrice) {
      inputPrice = defaultPrice.input;
      outputPrice = defaultPrice.output;
    }
  }

  // 分组倍率提取
  const groupKey = String(item.group ?? item.groupId ?? item.group_id ?? item.token_group ?? item.tokenGroup ?? '').trim();
  let groupRatio = toNumber(item.groupRatio ?? item.group_ratio ?? item.groupMultiplier ?? item.group_multiplier);
  
  if (groupRatio === undefined) {
    if (groupKey && groupRatioMap[groupKey] !== undefined) {
      groupRatio = toNumber(groupRatioMap[groupKey]);
    } else if (groupRatioMap.default !== undefined) {
      groupRatio = toNumber(groupRatioMap.default);
    }
  }
  if (groupRatio === undefined) {
    groupRatio = 1.0;
  }

  return {
    modelId,
    modelName: modelName || modelId,
    provider,
    provider_label: providerLabel,
    provider_logo: String(item.provider_logo ?? item.providerLogo ?? item.logo ?? item.icon ?? '').trim() || undefined,
    description: String(item.description ?? '').trim() || undefined,
    tags: normalizeStringArray(item.tags ?? item.tag ?? item.labels ?? item.label),
    availableGroups: normalizeStringArray(item.available_groups ?? item.availableGroups ?? item.enable_groups ?? item.enableGroups),
    tokenGroup: groupKey || undefined,
    billingType,
    endpointType: normalizeEndpointType(
      item.endpoint_type ?? item.endpointType ?? item.supported_endpoint_types?.[0] ?? item.supportedEndpointTypes?.[0] ?? item.endpoint,
      modelName
    ),
    endpointTypes: normalizeStringArray(
      item.endpoint_types ?? item.endpointTypes ?? item.supported_endpoint_types ?? item.supportedEndpointTypes
    ),
    modelRatio: toNumber(item.model_ratio ?? item.modelRatio ?? item.price_ratio ?? item.priceRatio),
    modelPrice: toNumber(item.model_price ?? item.modelPrice ?? item.price ?? item.per_request_price),
    completionRatio: toNumber(item.completion_ratio ?? item.completionRatio ?? item.output_ratio ?? item.outputRatio),
    sizeRatio: normalizeRatioMap(item.size_ratio ?? item.sizeRatio ?? item.size_ratios ?? item.sizeRatios),
    groupModelRatio: normalizeRatioMap(
      item.group_model_ratio ?? item.groupModelRatio ?? item.group_model_ratios ?? item.groupModelRatios
    ),
    groupSizeRatio: item.group_size_ratio ?? item.groupSizeRatio,
    groupModelPrice: item.group_model_price ?? item.groupModelPrice,
    quotaType,
    
    // 兼容前端 PricingConfig 的计算属性
    inputPrice: type === 'times' ? (perRequestPrice ?? inputPrice) : inputPrice,
    outputPrice,
    groupRatio,
    currency: String(item.currency ?? 'USD').trim() || 'USD',
    type,
  };
}

// ============== 5. HTML 及 Loose JSON 解析辅助方法 (提取自 pricing-proxy) ==============

export const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

export const stripTags = (text: string): string =>
  decodeHtmlEntities(text.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export const looksLikeHtml = (text: string): boolean => {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<body');
};

export const isPricingLikeObject = (value: unknown): value is PricingRow => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const row = value as PricingRow;
  const model = row.model ?? row.model_name ?? row.modelName ?? row.name ?? row.model_id;
  if (typeof model !== 'string' || !model.trim()) return false;

  return [
    row.model_ratio,
    row.modelRatio,
    row.model_price,
    row.modelPrice,
    row.completion_ratio,
    row.completionRatio,
    row.size_ratio,
    row.sizeRatio,
    row.group_model_ratio,
    row.groupModelRatio,
    row.quota_type,
    row.quotaType,
  ].some((field) => field !== undefined && field !== null);
};

export const collectPricingRows = (value: unknown, results: PricingRow[] = [], seen = new WeakSet<object>()): PricingRow[] => {
  if (!value || typeof value !== 'object') return results;

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (isPricingLikeObject(item)) {
        const normalized = normalizeApiResponse(item);
        if (normalized) results.push(normalized);
        return;
      }
      collectPricingRows(item, results, seen);
    });
    return results;
  }

  if (seen.has(value as object)) return results;
  seen.add(value as object);

  if (isPricingLikeObject(value)) {
    const normalized = normalizeApiResponse(value);
    if (normalized) results.push(normalized);
  }

  Object.values(value as Record<string, unknown>).forEach((child) => collectPricingRows(child, results, seen));
  return results;
};

export const collectGroupRatios = (value: unknown, results: Record<string, number>[] = [], seen = new WeakSet<object>()): Record<string, number>[] => {
  if (!value || typeof value !== 'object') return results;

  if (Array.isArray(value)) {
    value.forEach((item) => collectGroupRatios(item, results, seen));
    return results;
  }

  if (seen.has(value as object)) return results;
  seen.add(value as object);

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/group[_-]?ratio/i.test(key)) {
      const ratioMap = normalizeRatioMap(child);
      if (ratioMap) results.push(ratioMap);
    }
    collectGroupRatios(child, results, seen);
  }

  return results;
};

export const mergeRows = (...groups: PricingRow[][]): PricingRow[] => {
  const merged = new Map<string, PricingRow>();

  groups.flat().forEach((row) => {
    const modelName = String(row.model_name || row.model || '').trim();
    if (!modelName) return;

    const existing = merged.get(modelName) || {};
    const sizeRatio = normalizeRatioMap(row.size_ratio) || normalizeRatioMap(existing.size_ratio);
    const groupModelRatio = normalizeRatioMap(row.group_model_ratio) || normalizeRatioMap(existing.group_model_ratio);

    merged.set(modelName, {
      ...existing,
      ...row,
      model: row.model || existing.model || modelName,
      model_name: modelName,
      model_ratio: row.model_ratio ?? existing.model_ratio,
      model_price: row.model_price ?? existing.model_price,
      completion_ratio: row.completion_ratio ?? existing.completion_ratio,
      quota_type: row.quota_type ?? existing.quota_type,
      size_ratio: sizeRatio,
      group_model_ratio: groupModelRatio,
      group_size_ratio: row.group_size_ratio ?? existing.group_size_ratio,
      group_model_price: row.group_model_price ?? existing.group_model_price,
    });
  });

  return Array.from(merged.values());
};

export const mergeGroupRatios = (...groups: Array<Record<string, number> | undefined>): Record<string, number> =>
  groups.reduce<Record<string, number>>((acc, group) => {
    if (!group) return acc;
    return { ...acc, ...group };
  }, {});

export const tryParseJson = (text: string): unknown | null => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const tryParseLooseJson = (text: string): unknown | null => {
  const trimmed = text.trim().replace(/;$/, '');
  if (!trimmed) return null;

  const direct = tryParseJson(trimmed);
  if (direct) return direct;

  const normalized = trimmed
    .replace(/([{,]\s*)([A-Za-z0-9_$-]+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => `: "${value.replace(/"/g, '\\"')}"`)
    .replace(/,\s*([}\]])/g, '$1');

  return tryParseJson(normalized);
};

export const parseRatioMapFromText = (text: string): Record<string, number> | undefined => {
  const normalized = stripTags(text);
  if (!normalized) return undefined;

  const matches = Array.from(
    normalized.matchAll(/([A-Za-z0-9_.:/\-\u4e00-\u9fa5]+)\s*[:：]\s*(?:×|x|X|\*)?\s*(\d+(?:\.\d+)?)/g)
  );

  if (!matches.length) return undefined;

  const result = matches.reduce<Record<string, number>>((acc, match) => {
    const key = String(match[1] || '').trim();
    const value = toNumber(match[2]);
    if (key && value !== undefined) acc[key] = value;
    return acc;
  }, {});

  return Object.keys(result).length ? result : undefined;
};

export const extractFirstNumericValue = (text: string): number | undefined => {
  const normalized = stripTags(text).replace(/,/g, '');
  if (!normalized) return undefined;

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? toNumber(match[0]) : undefined;
};

export const extractTableRows = (html: string): PricingRow[] => {
  const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi)).map((match) => match[0]);
  const rows: PricingRow[] = [];

  const findHeaderIndex = (headers: string[], patterns: RegExp[]) =>
    headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));

  for (const table of tables) {
    const rowMatches = Array.from(table.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((match) => match[0]);
    if (rowMatches.length < 2) continue;

    const headerCells = Array.from(rowMatches[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((match) =>
      stripTags(match[1] || '').toLowerCase()
    );
    if (!headerCells.length) continue;

    const modelIndex = findHeaderIndex(headerCells, [/模型|model|名称|name/i]);
    if (modelIndex < 0) continue;

    const basePriceIndex = findHeaderIndex(headerCells, [/基础价|单次|price|价格|per.?request/i]);
    const modelRatioIndex = findHeaderIndex(headerCells, [/模型倍率|model.?ratio|输入倍率|ratio/i]);
    const completionRatioIndex = findHeaderIndex(headerCells, [/completion|输出倍率|补全倍率|output/i]);
    const sizeRatioIndex = findHeaderIndex(headerCells, [/尺寸倍率|size/i]);
    const groupRatioIndex = findHeaderIndex(headerCells, [/分组倍率|group/i]);
    const quotaTypeIndex = findHeaderIndex(headerCells, [/quota|计费方式|类型|type/i]);
    const providerIndex = findHeaderIndex(headerCells, [/供应商|厂商|provider|vendor|manufacturer|owned/i]);
    const tokenGroupIndex = findHeaderIndex(headerCells, [/令牌分组|token.?group|group.?name|用户分组|分组/i]);
    const endpointTypeIndex = findHeaderIndex(headerCells, [/端点|endpoint|接口类型|api.?type/i]);
    const tagsIndex = findHeaderIndex(headerCells, [/标签|tag|label/i]);

    for (const rowHtml of rowMatches.slice(1)) {
      const cells = Array.from(rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((match) => stripTags(match[1] || ''));
      if (!cells.length || !cells[modelIndex]) continue;

      const quotaRaw = quotaTypeIndex >= 0 ? cells[quotaTypeIndex] : '';
      const quotaType = /按次|per.?request|fixed/i.test(quotaRaw) ? 1 : undefined;
      const row = normalizeApiResponse({
        model_name: cells[modelIndex],
        model_price: basePriceIndex >= 0 ? extractFirstNumericValue(cells[basePriceIndex]) : undefined,
        model_ratio: modelRatioIndex >= 0 ? extractFirstNumericValue(cells[modelRatioIndex]) : undefined,
        completion_ratio: completionRatioIndex >= 0 ? extractFirstNumericValue(cells[completionRatioIndex]) : undefined,
        size_ratio: sizeRatioIndex >= 0 ? parseRatioMapFromText(cells[sizeRatioIndex]) : undefined,
        group_model_ratio: groupRatioIndex >= 0 ? parseRatioMapFromText(cells[groupRatioIndex]) : undefined,
        provider: providerIndex >= 0 ? cells[providerIndex] : undefined,
        available_groups: tokenGroupIndex >= 0 ? cells[tokenGroupIndex] : undefined,
        token_group: tokenGroupIndex >= 0 ? cells[tokenGroupIndex] : undefined,
        endpoint_type: endpointTypeIndex >= 0 ? cells[endpointTypeIndex] : undefined,
        tags: tagsIndex >= 0 ? cells[tagsIndex] : undefined,
        quota_type: quotaType,
      });

      if (row) rows.push(row);
    }
  }

  return rows;
};

export const extractEmbeddedJson = (html: string): unknown[] => {
  const matches: unknown[] = [];
  const patterns = [
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi,
    /<script[^>]*id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi,
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
    /window\.__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*;/gi,
    /window\.__NUXT__\s*=\s*({[\s\S]*?})\s*;/gi,
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const parsed = tryParseLooseJson((match[1] || '').trim());
      if (parsed) matches.push(parsed);
    }
  }

  for (const scriptMatch of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const script = scriptMatch[1] || '';
    const assignmentPatterns = [
      /(?:window\.)?[A-Za-z0-9_$]+\s*=\s*({[\s\S]*?});/g,
      /(?:window\.)?[A-Za-z0-9_$]+\s*=\s*(\[[\s\S]*?\]);/g,
      /JSON\.parse\(\s*("(?:(?:\\.|[^"])*)"|'(?:(?:\\.|[^'])*)')\s*\)/g,
    ];

    for (const pattern of assignmentPatterns) {
      for (const match of script.matchAll(pattern)) {
        let raw = String(match[1] || '').trim();
        if (!raw) continue;

        if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
          try {
            raw = JSON.parse(raw);
          } catch {
            raw = raw.slice(1, -1);
          }
        }

        const parsed = typeof raw === 'string' ? tryParseLooseJson(decodeHtmlEntities(raw)) : raw;
        if (parsed) matches.push(parsed);
      }
    }
  }

  return matches;
};

export const discoverDynamicTargets = (html: string, baseUrl: string): DiscoveryTarget[] => {
  const discovered = new Map<string, DiscoveryTarget>();
  const patterns = [
    /["'`](\/[^"'`\s]*(?:pricing|price|quota|billing|model|models)[^"'`\s]*)["'`]/gi,
    /fetch\(\s*["'`](\/[^"'`\s]+)["'`]/gi,
    /axios\.(?:get|post)\(\s*["'`](\/[^"'`\s]+)["'`]/gi,
    /url\s*:\s*["'`](\/[^"'`\s]+)["'`]/gi,
  ];

  const normalizeDiscoveredUrl = (rawUrl: string, bUrl: string) => {
    const trimmed = rawUrl.trim().replace(/\\\//g, '/');
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        const base = new URL(bUrl);
        if (url.origin !== base.origin) return null;
        return url.toString();
      } catch {
        return null;
      }
    }

    if (!trimmed.startsWith('/')) return null;

    try {
      return new URL(trimmed, bUrl).toString();
    } catch {
      return null;
    }
  };

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const candidate = normalizeDiscoveredUrl(match[1] || '', baseUrl);
      if (!candidate) continue;

      if (!/(pricing|price|quota|billing|model|models)/i.test(candidate)) continue;

      discovered.set(candidate, {
        key: `discovered:${new URL(candidate).pathname}`,
        url: candidate,
        accept: /(?:\/api\/|\.json|pricing|quota|billing)/i.test(candidate)
          ? 'application/json, text/plain;q=0.9, */*;q=0.8'
          : 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      });
    }
  }

  return Array.from(discovered.values()).slice(0, 8);
};

export const parsePayload = (text: string): ParsedPayload | null => {
  if (!text.trim()) return null;

  if (looksLikeHtml(text)) {
    const payloads = extractEmbeddedJson(text);
    const rows = mergeRows(...payloads.map((payload) => collectPricingRows(payload)), extractTableRows(text));
    const groupRatio = mergeGroupRatios(
      ...payloads.flatMap((payload) => collectGroupRatios(payload)),
      parseRatioMapFromText(text)
    );
    return rows.length > 0 ? { data: rows, groupRatio } : null;
  }

  const parsed = tryParseLooseJson(text);
  if (!parsed) return null;

  const directGroupRatio =
    normalizeRatioMap((parsed as Record<string, unknown>).group_ratio) ||
    normalizeRatioMap((parsed as Record<string, unknown>).groupRatio);

  return {
    data: mergeRows(collectPricingRows(parsed)),
    groupRatio: mergeGroupRatios(directGroupRatio, ...collectGroupRatios(parsed)),
  };
};
