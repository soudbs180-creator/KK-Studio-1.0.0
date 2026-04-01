/**
 * Cost Estimation Service
 * Tracks daily API usage costs based on updated pricing models.
 * Includes 30-day history and recent 50 detailed entries.
 */

import { ModelType, ImageSize } from '../../types';
import { getModelPricing, getRefImageTokenEstimate, getImageTokenEstimate } from '../model/modelPricing';
import { determineKeyType, keyManager, type KeySlot } from '../auth/keyManager';
import { tempUserService } from '../auth/tempUserService';
import { registerCostSyncHandler } from './costSyncBridge';

// --- Interfaces ---

export interface CostEntry {
    id: string;
    model: string; // Can be "model@source"
    imageSize: ImageSize;
    count: number;
    costUsd: number;
    timestamp: number;
    details?: string;
    tokens?: number;
    requestPath?: string;
    requestBodyPreview?: string;
    pythonSnippet?: string;
}

export interface CostDebugMeta {
    requestPath?: string;
    requestBodyPreview?: string;
    pythonSnippet?: string;
}

export interface CostBreakdownItem {
    model: string;
    imageSize: ImageSize;
    count: number;
    tokens: number;
    cost: number;
}

export interface DayStats {
    date: string;
    totalCostUsd: number;
    totalImages: number;
    totalTokens: number;
    breakdown: CostBreakdownItem[];
}

export interface CostHistory {
    daily: DayStats[]; // Limit 30 days
    recent: CostEntry[]; // Limit 50 entries
}

export interface UsageStats {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number; // Explicit cost from provider
}

export interface ResolveImageCostOptions {
    model: string;
    imageSize?: ImageSize;
    count?: number;
    prompt?: string;
    promptLength?: number;
    referenceImageCount?: number;
    keySlotId?: string;
    provider?: string;
    providerLabel?: string;
    promptTokens?: unknown;
    completionTokens?: unknown;
    totalTokens?: unknown;
    explicitCost?: unknown;
    storedCost?: unknown;
    storedCostSource?: unknown;
}

export interface ResolvedImageCost {
    cost: number;
    source: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none';
    usedPricingSnapshot: boolean;
}

// --- Storage Keys ---
const HISTORY_STORAGE_KEY = 'kk_studio_cost_history';
const BUDGET_STORAGE_KEY = 'kk_studio_daily_budget';

// --- State ---
let currentUserId: string | null = null;
let isSyncing = false;
let syncTimer: any = null;

// --- Helpers ---

function getTodayString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

function toFiniteNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function loadHistory(): CostHistory {
    try {
        const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Migrate old format or ensure structure
            if (!data.daily) data.daily = [];
            if (!data.recent) data.recent = [];
            return data;
        }
    } catch (e) {
        console.warn('[CostService] Failed to load history:', e);
    }
    return { daily: [], recent: [] };
}

function saveHistory(data: CostHistory): void {
    try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[CostService] Failed to save history:', e);
    }
}

/**
 * Parses "model@source" into { modelId, source }
 */
export function parseModelSource(fullModelId: string): { modelId: string; source: string } {
    if (!fullModelId) return { modelId: 'Unknown', source: 'Unknown' };

    if (fullModelId.includes('@')) {
        const [model, source] = fullModelId.split('@');
        return {
            modelId: model.split('|')[0].replace(/^models\//, ''),
            source: source || 'Custom'
        };
    }
    return { modelId: fullModelId.split('|')[0].replace(/^models\//, ''), source: 'Official' }; // Default to Official if no @
}

function getSnapshotNumber(
    source: Record<string, any> | undefined,
    key: string
): number | undefined {
    if (!source) return undefined;
    const direct = source[key];
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
    if (typeof direct === 'string' && direct.trim() !== '') {
        const parsed = Number(direct);
        if (Number.isFinite(parsed)) return parsed;
    }

    const caseInsensitiveKey = Object.keys(source).find((entry) => entry.toLowerCase() === key.toLowerCase());
    if (!caseInsensitiveKey) return undefined;

    const fallback = source[caseInsensitiveKey];
    if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
    if (typeof fallback === 'string' && fallback.trim() !== '') {
        const parsed = Number(fallback);
        if (Number.isFinite(parsed)) return parsed;
    }

    return undefined;
}

function findDefaultGroupKey(map: Record<string, unknown> | undefined): string | undefined {
    if (!map) return undefined;

    return Object.keys(map).find((key) => key.trim().toLowerCase() === 'default');
}

function resolveSnapshotGroupRatio(
    groupRatio: unknown,
    options?: { allowArbitraryFallback?: boolean }
): number {
    if (typeof groupRatio === 'number' && Number.isFinite(groupRatio)) return groupRatio;
    if (groupRatio && typeof groupRatio === 'object' && !Array.isArray(groupRatio)) {
        const map = groupRatio as Record<string, unknown>;
        const defaultKey = findDefaultGroupKey(map);
        const direct =
            (defaultKey ? map[defaultKey] : undefined) ??
            (options?.allowArbitraryFallback === false
                ? undefined
                : Object.values(map).find((value) => typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')));

        if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
        if (typeof direct === 'string' && direct.trim() !== '') {
            const parsed = Number(direct);
            if (Number.isFinite(parsed)) return parsed;
        }
    }
    return 1;
}

function resolveSizeRatio(sizeRatioMap: Record<string, number> | undefined, size: ImageSize): number {
    if (!sizeRatioMap) return 1;

    const rawSize = typeof size === 'object' && size !== null && 'width' in size && 'height' in size
        ? `${(size as any).width}x${(size as any).height}`
        : String(size || '');

    const normalized = rawSize.toLowerCase();
    const candidates = new Set<string>([
        rawSize,
        normalized,
        rawSize.replace(/x/gi, '*'),
        normalized.replace(/x/gi, '*'),
    ]);

    if (normalized === '1k' || normalized === '1024x1024') {
        candidates.add('1K');
        candidates.add('1024x1024');
        candidates.add('1024*1024');
    } else if (normalized === '2k' || normalized === '2048x2048') {
        candidates.add('2K');
        candidates.add('2048x2048');
        candidates.add('2048*2048');
    } else if (normalized === '4k' || normalized === '4096x4096') {
        candidates.add('4K');
        candidates.add('4096x4096');
        candidates.add('4096*4096');
    }

    for (const candidate of candidates) {
        const ratio = getSnapshotNumber(sizeRatioMap as Record<string, any>, candidate);
        if (ratio !== undefined) return ratio;
    }

    return 1;
}

function getPreferredGroupKey(
    preferredGroup: string | undefined,
    map: Record<string, any> | undefined
): string | undefined {
    if (!map) return undefined;
    if (preferredGroup) {
        const exact = Object.keys(map).find((key) => key === preferredGroup);
        if (exact) return exact;
        const normalized = preferredGroup.trim().toLowerCase();
        const insensitive = Object.keys(map).find((key) => key.trim().toLowerCase() === normalized);
        if (insensitive) return insensitive;

        return findDefaultGroupKey(map);
    }

    return findDefaultGroupKey(map) || Object.keys(map)[0];
}

function getScopedGroupEntry<T>(
    map: Record<string, T> | undefined,
    preferredGroup: string | undefined
): T | undefined {
    if (!map) return undefined;

    const groupKey = getPreferredGroupKey(preferredGroup, map);
    if (groupKey) return map[groupKey];

    if (preferredGroup && preferredGroup.trim() !== '') {
        return undefined;
    }

    return Object.values(map)[0];
}

export function hasPricingSnapshotForKeySlot(keySlotId?: string): boolean {
    if (!keySlotId) return false;
    return Boolean(keyManager.getProviderForKeySlot(keySlotId)?.pricingSnapshot);
}

function isOfficialBuiltinPricingSlot(keySlotId?: string): boolean {
    if (!keySlotId) return false;

    const slot = keyManager.getEffectiveKey(keySlotId) || keyManager.getKey(keySlotId);
    if (!slot) return false;

    const provider = slot.provider;
    const normalizedBaseUrl = String(slot.baseUrl || '').trim().toLowerCase();
    const looksOfficialByRuntime = determineKeyType(provider, slot.baseUrl) === 'official';
    const looksOfficialByLegacyStorage = !normalizedBaseUrl && (provider === 'Google' || provider === 'OpenAI');

    return looksOfficialByRuntime || looksOfficialByLegacyStorage;
}

function normalizeProviderIdentityValue(value?: string): string {
    return String(value || '').trim().toLowerCase();
}

const GOOGLE_OFFICIAL_PROVIDER_ALIASES = new Set([
    'google',
    'google api',
    'google official',
    'google official api',
    '\u8c37\u6b4c',
    '\u8c37\u6b4c\u5b98\u65b9\u63a5\u53e3',
]);

const OPENAI_OFFICIAL_PROVIDER_ALIASES = new Set([
    'openai',
    'openai api',
    'openai official',
    'openai official api',
    'openai \u5b98\u65b9\u63a5\u53e3',
]);

function matchesKnownOfficialProviderAlias(value: string): boolean {
    return GOOGLE_OFFICIAL_PROVIDER_ALIASES.has(value) || OPENAI_OFFICIAL_PROVIDER_ALIASES.has(value);
}

function hasOfficialAliasMatch(
    provider: string,
    providerLabel: string,
    aliases: ReadonlySet<string>
): boolean {
    const providerMatches = provider !== '' && aliases.has(provider);
    const labelMatches = providerLabel !== '' && aliases.has(providerLabel);

    if (!providerMatches && !labelMatches) {
        return false;
    }

    // If one side explicitly points to another known official provider family,
    // do not infer "official". Arbitrary user-defined labels should not block
    // official fallback pricing for Google/OpenAI routes.
    if (provider !== '' && !providerMatches && matchesKnownOfficialProviderAlias(provider)) {
        return false;
    }

    if (providerLabel !== '' && !labelMatches && matchesKnownOfficialProviderAlias(providerLabel)) {
        return false;
    }

    return true;
}

function hasCanonicalOfficialProviderIdentity(provider?: string, providerLabel?: string): boolean {
    const normalizedProvider = normalizeProviderIdentityValue(provider);
    const normalizedLabel = normalizeProviderIdentityValue(providerLabel);

    return hasOfficialAliasMatch(normalizedProvider, normalizedLabel, GOOGLE_OFFICIAL_PROVIDER_ALIASES)
        || hasOfficialAliasMatch(normalizedProvider, normalizedLabel, OPENAI_OFFICIAL_PROVIDER_ALIASES);
}

function canUseBuiltinEstimateWithoutResolvedKey(options: ResolveImageCostOptions): boolean {
    if (!hasCanonicalOfficialProviderIdentity(options.provider, options.providerLabel)) {
        return false;
    }

    return Boolean(getModelPricing(options.model));
}

function calculateCostFromTokenFormula(
    model: string,
    imageSize: ImageSize,
    count: number,
    usage: {
        promptTokens?: unknown;
        completionTokens?: unknown;
        totalTokens?: unknown;
    }
): number | undefined {
    const pricing = getModelPricing(model);
    if (!pricing || (!pricing.inputPerMillionTokens && !pricing.outputPerMillionTokens)) {
        return undefined;
    }

    let promptTokens = toFiniteNumber(usage.promptTokens);
    let completionTokens = toFiniteNumber(usage.completionTokens);
    const totalTokens = toFiniteNumber(usage.totalTokens);

    if (promptTokens === undefined && completionTokens !== undefined && totalTokens !== undefined) {
        promptTokens = Math.max(0, totalTokens - completionTokens);
    }

    if (completionTokens === undefined && promptTokens !== undefined && totalTokens !== undefined) {
        completionTokens = Math.max(0, totalTokens - promptTokens);
    }

    if (promptTokens === undefined && completionTokens === undefined && totalTokens !== undefined) {
        const estimatedOutputTokens = getImageTokenEstimate(model, imageSize) * Math.max(1, count || 1);
        if (estimatedOutputTokens > 0) {
            completionTokens = Math.min(totalTokens, estimatedOutputTokens);
            promptTokens = Math.max(0, totalTokens - completionTokens);
        } else {
            promptTokens = totalTokens;
            completionTokens = 0;
        }
    }

    if (promptTokens === undefined && completionTokens === undefined) {
        return undefined;
    }

    const inputCost = ((promptTokens || 0) / 1_000_000) * (pricing.inputPerMillionTokens || 0);
    const outputCost = ((completionTokens || 0) / 1_000_000) * (pricing.outputPerMillionTokens || 0);
    const totalCost = inputCost + outputCost;

    if (!Number.isFinite(totalCost)) {
        return undefined;
    }

    if (totalCost <= 0) {
        return totalTokens !== undefined && totalTokens > 0 ? 0.000001 : 0;
    }

    return totalCost;
}

export function resolveImageCost(options: ResolveImageCostOptions): ResolvedImageCost {
    const imageSize = options.imageSize || ImageSize.SIZE_1K;
    const count = Math.max(1, Number(options.count || 1));
    const promptLength = typeof options.promptLength === 'number'
        ? Math.max(0, options.promptLength)
        : String(options.prompt || '').length;
    const referenceImageCount = Math.max(0, Number(options.referenceImageCount || 0));
    const explicitCost = toFiniteNumber(options.explicitCost);
    const storedCost = toFiniteNumber(options.storedCost);
    const usedPricingSnapshot = hasPricingSnapshotForKeySlot(options.keySlotId);
    const normalizedStoredCostSource = typeof options.storedCostSource === 'string'
        ? options.storedCostSource.trim().toLowerCase()
        : '';
    const trustedStoredCostSource = normalizedStoredCostSource === 'explicit' || normalizedStoredCostSource === 'snapshot'
        ? normalizedStoredCostSource
        : undefined;
    const resolvedKeySlot = options.keySlotId
        ? keyManager.getEffectiveKey(options.keySlotId) || keyManager.getKey(options.keySlotId)
        : undefined;
    const isKeyedModelWithoutPricingSnapshot = Boolean(options.keySlotId) && !usedPricingSnapshot;
    const canUseBuiltinEstimateForKeyedModel = !isKeyedModelWithoutPricingSnapshot
        || isOfficialBuiltinPricingSlot(options.keySlotId)
        || (!resolvedKeySlot && canUseBuiltinEstimateWithoutResolvedKey(options));

    const estimateCost = (): number | undefined => {
        try {
            const estimate = calculateCost(
                options.model,
                imageSize,
                count,
                promptLength,
                referenceImageCount,
                options.keySlotId
            );
            return estimate.cost;
        } catch {
            return undefined;
        }
    };
    const tokenFormulaCost = calculateCostFromTokenFormula(
        options.model,
        imageSize,
        count,
        {
            promptTokens: options.promptTokens,
            completionTokens: options.completionTokens,
            totalTokens: options.totalTokens,
        }
    );

    if (usedPricingSnapshot) {
        const snapshotCost = estimateCost();
        if (snapshotCost !== undefined && snapshotCost > 0) {
            return { cost: snapshotCost, source: 'snapshot', usedPricingSnapshot };
        }
    }

    if (isKeyedModelWithoutPricingSnapshot && !canUseBuiltinEstimateForKeyedModel) {
        if (explicitCost !== undefined) {
            return { cost: explicitCost, source: 'explicit', usedPricingSnapshot };
        }

        if (trustedStoredCostSource && storedCost !== undefined) {
            return {
                cost: storedCost,
                source: trustedStoredCostSource,
                usedPricingSnapshot,
            };
        }

        if (tokenFormulaCost !== undefined && tokenFormulaCost > 0 && canUseBuiltinEstimateForKeyedModel) {
            return { cost: tokenFormulaCost, source: 'estimated', usedPricingSnapshot };
        }

        return { cost: 0, source: 'none', usedPricingSnapshot };
    }

    if (explicitCost !== undefined && (explicitCost > 0 || !options.keySlotId)) {
        return { cost: explicitCost, source: 'explicit', usedPricingSnapshot };
    }

    if (storedCost !== undefined && (storedCost > 0 || !options.keySlotId)) {
        return { cost: storedCost, source: 'stored', usedPricingSnapshot };
    }

    if (tokenFormulaCost !== undefined && tokenFormulaCost > 0) {
        return { cost: tokenFormulaCost, source: 'estimated', usedPricingSnapshot };
    }

    const estimatedCost = estimateCost();
    if (estimatedCost !== undefined && (estimatedCost > 0 || (explicitCost === undefined && storedCost === undefined))) {
        return { cost: estimatedCost, source: 'estimated', usedPricingSnapshot };
    }

    if (explicitCost !== undefined) {
        return { cost: explicitCost, source: 'explicit', usedPricingSnapshot };
    }

    if (storedCost !== undefined) {
        return { cost: storedCost, source: 'stored', usedPricingSnapshot };
    }

    return { cost: 0, source: 'none', usedPricingSnapshot };
}

// --- Core Logic ---

export const calculateCost = (
    fullModelId: string,
    size: ImageSize,
    count: number,
    promptLen: number = 0,
    refCount: number = 0,
    keySlotId?: string
): { cost: number; details: string; tokens: number } => {
    let cost = 0;
    let details = '';
    let tokens = 0;

    const { modelId } = parseModelSource(fullModelId);
    const normalizedId = modelId.toLowerCase();

    // =============== 新版 API 接口自定义计费逻辑 ===============
    if (keySlotId) {
        const slot = keyManager.getEffectiveKey(keySlotId) || keyManager.getKey(keySlotId);
        const linkedProvider = keyManager.getProviderForKeySlot(keySlotId);

        if (linkedProvider?.pricingSnapshot) {
            const snap = linkedProvider.pricingSnapshot;
            const preferredGroup = slot?.group || linkedProvider.group;
            const hasExplicitPreferredGroup = Boolean(preferredGroup && preferredGroup.trim() !== '');
            const mPrice = getSnapshotNumber(snap.modelPrices, modelId) ?? getSnapshotNumber(snap.modelPrices, normalizedId);
            let mRatio = getSnapshotNumber(snap.modelRatios, modelId) ?? getSnapshotNumber(snap.modelRatios, normalizedId);
            const groupRatioKey = getPreferredGroupKey(preferredGroup, snap.groupRatioMap);
            const gRatio =
                (groupRatioKey ? getSnapshotNumber(snap.groupRatioMap, groupRatioKey) : undefined) ??
                (hasExplicitPreferredGroup && snap.groupRatioMap
                    ? 1
                    : resolveSnapshotGroupRatio(snap.groupRatioMap ?? snap.groupRatio, {
                        allowArbitraryFallback: !hasExplicitPreferredGroup
                    }));
            const groupModelRatioMap = snap.groupModelRatioMaps?.[modelId] || snap.groupModelRatioMaps?.[normalizedId];
            const groupModelRatioKey = getPreferredGroupKey(preferredGroup, groupModelRatioMap);
            const gmRatio =
                (groupModelRatioKey ? getSnapshotNumber(groupModelRatioMap, groupModelRatioKey) : undefined) ??
                (groupModelRatioMap && hasExplicitPreferredGroup
                    ? undefined
                    : getSnapshotNumber(snap.groupModelRatios, modelId) ??
                      getSnapshotNumber(snap.groupModelRatios, normalizedId)) ??
                1;

            const sRatioObj = snap.sizeRatios?.[modelId] || snap.sizeRatios?.[normalizedId];
            const groupSizeMap = snap.groupSizeRatios?.[modelId] || snap.groupSizeRatios?.[normalizedId];
            const groupSizeObj = getScopedGroupEntry(groupSizeMap, preferredGroup);
            const sRatio = Math.max(resolveSizeRatio(sRatioObj, size), resolveSizeRatio(groupSizeObj, size));
            const groupPriceMap = snap.groupModelPrices?.[modelId] || snap.groupModelPrices?.[normalizedId];
            const groupPriceKey = getPreferredGroupKey(preferredGroup, groupPriceMap);
            const groupPriceOverride = getScopedGroupEntry(groupPriceMap, preferredGroup);
            const overrideModelPrice = getSnapshotNumber(groupPriceOverride as Record<string, any> | undefined, 'modelPrice');
            const overrideModelRatio = getSnapshotNumber(groupPriceOverride as Record<string, any> | undefined, 'modelRatio');
            const overrideCompletionRatio = getSnapshotNumber(groupPriceOverride as Record<string, any> | undefined, 'completionRatio');
            const hasGroupTokenOverride = overrideModelRatio !== undefined || overrideCompletionRatio !== undefined;

            if (overrideModelPrice !== undefined) {
                cost = overrideModelPrice * gRatio * sRatio * count;
                details = `API按次(分组覆盖): $${overrideModelPrice}/img | 组=${preferredGroup || groupPriceKey || 'default'} | 尺寸×${sRatio} | 分组×${gRatio}`;
                return { cost, details, tokens: 0 };
            }

            // 如果是按次计费
            if (mPrice !== undefined && !hasGroupTokenOverride) {
                cost = mPrice * gRatio * gmRatio * sRatio * count;
                details = `API按次: $${mPrice}/img | 组=${preferredGroup || groupRatioKey || 'default'} | 尺寸×${sRatio} | 分组×${gRatio} | 模型组×${gmRatio}`;
                return { cost, details, tokens: 0 };
            }

            // 否则尝试按 token 混合计费
            if (mRatio !== undefined || hasGroupTokenOverride) {
                const textTokens = Math.ceil(promptLen / 4);
                const refTokens = refCount * 560;
                const inputTokens = textTokens + refTokens;

                const outputTokensPerImage = getImageTokenEstimate(normalizedId, size);
                const outputTokens = count * outputTokensPerImage;

                let cRatio =
                    getSnapshotNumber(snap.completionRatios, modelId) ??
                    getSnapshotNumber(snap.completionRatios, normalizedId) ??
                    1;

                if (overrideModelRatio !== undefined) {
                    mRatio = overrideModelRatio;
                }

                if (overrideCompletionRatio !== undefined) {
                    cRatio = overrideCompletionRatio;
                }

                // 计算总倍率下的等效标准 token（通常 OneAPI 的 model_ratio 表示按 500000 等效于 $1 的计价倍率）
                // 具体计价常数因站点而异；如果没有自定义，系统当前使用兜底价格：0.002 / 1000 => 2 / 1000000
                const baseRate = 2.0 / 1000000; // $0.002 per 1k ratio

                const effectiveModelRatio = mRatio ?? 1;
                const inputCost = inputTokens * baseRate * effectiveModelRatio * gRatio * gmRatio;
                const outputCost = outputTokens * baseRate * effectiveModelRatio * cRatio * sRatio * gRatio * gmRatio;

                cost = Math.max(0.000001, inputCost + outputCost);
                tokens = inputTokens + outputTokens;
                details = `API按量: ${tokens} Toks | 组=${preferredGroup || groupPriceKey || groupRatioKey || 'default'} | 模型×${effectiveModelRatio} | 补全×${cRatio} | 尺寸×${sRatio} | 分组×${gRatio} | 模型组×${gmRatio}`;
                return { cost, details, tokens };
            }
        }
    }
    // =========================================================

    const pricing = getModelPricing(normalizedId);

    // Prioritize Pricing Registry
    if (pricing) {
        if (pricing.pricePerImage) {
            cost = pricing.pricePerImage * count;
            details = `Fixed: $${pricing.pricePerImage}/img`;
            return { cost, details, tokens: 0 };
        }

        if (pricing.inputPerMillionTokens || pricing.outputPerMillionTokens) {
            const textTokens = Math.ceil(promptLen / 4);
            const refTokens = refCount * (pricing.refImageTokens || 560);
            const inputTokens = textTokens + refTokens;

            const outputTokensPerImage = getImageTokenEstimate(normalizedId, size);
            const outputTokens = count * outputTokensPerImage;

            const inputCost = (inputTokens / 1_000_000) * (pricing.inputPerMillionTokens || 0);
            const outputCost = (outputTokens / 1_000_000) * (pricing.outputPerMillionTokens || 0);

            cost = Math.max(0.000001, inputCost + outputCost);
            tokens = inputTokens + outputTokens;
            details = `Pricing: ${tokens} Toks`;
            return { cost, details, tokens };
        }
    }

    // Fallback Hardcoded Logic (only if not in registry)
    // ... (Keep generic fallbacks if necessary, but registry should cover most)

    // Simple fallback for unknown models
    return { cost: 0, details: 'Unknown Model', tokens: 0 };
};

export function recordCost(
    model: string,
    imageSize: ImageSize,
    count: number,
    prompt: string = '',
    refImageCount: number = 0,
    usage?: UsageStats,
    debugMeta?: CostDebugMeta,
    keySlotId?: string
): void {
    if (count <= 0) return;

    const history = loadHistory();
    const todayStr = getTodayString();

    // 1. Calculate Cost
    let { cost, details, tokens } = calculateCost(model, imageSize, count, prompt.length, refImageCount, keySlotId);

    if (usage) {
        const estimatedDetails = details;
        if (usage.totalTokens !== undefined) {
            tokens = usage.totalTokens;
            details = `Actual: ${tokens} Toks`;
        }
        if (usage.cost !== undefined) {
            cost = usage.cost;
            details += ` | Cost: $${cost.toFixed(6)}`;
            if (estimatedDetails) {
                details += ` | Est: ${estimatedDetails}`;
            }
        } else if (usage.totalTokens !== undefined) {
            // Re-calculate cost based on actual tokens if pricing exists
            const { modelId } = parseModelSource(model);
            const pricing = getModelPricing(modelId);
            if (pricing && (pricing.inputPerMillionTokens || pricing.outputPerMillionTokens)) {
                // Approximate split if not provided
                const pTokens = usage.promptTokens || 0;
                const cTokens = usage.completionTokens || (usage.totalTokens - pTokens);
                const iCost = (pTokens / 1000000) * (pricing.inputPerMillionTokens || 0);
                const oCost = (cTokens / 1000000) * (pricing.outputPerMillionTokens || 0);
                cost = iCost + oCost;
            }
        }
    }

    // 2. Create Entry
    const newEntry: CostEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        model,
        imageSize,
        count,
        costUsd: cost,
        timestamp: Date.now(),
        details,
        tokens,
        requestPath: debugMeta?.requestPath,
        requestBodyPreview: debugMeta?.requestBodyPreview,
        pythonSnippet: debugMeta?.pythonSnippet
    };

    // 3. Update Recent List (Max 50)
    history.recent.unshift(newEntry);
    if (history.recent.length > 50) {
        history.recent = history.recent.slice(0, 50);
    }

    // 4. Update Daily Stats (Max 30 Days)
    let dayStats = history.daily.find(d => d.date === todayStr);
    if (!dayStats) {
        dayStats = {
            date: todayStr,
            totalCostUsd: 0,
            totalImages: 0,
            totalTokens: 0,
            breakdown: []
        };
        history.daily.unshift(dayStats); // Newest day first
    }

    // Update Totals
    dayStats.totalCostUsd += cost;
    dayStats.totalImages += count;
    dayStats.totalTokens += tokens;

    // Update Breakdown
    const breakdownKey = `${model}_${imageSize}`;
    let breakdownItem = dayStats.breakdown.find(b => `${b.model}_${b.imageSize}` === breakdownKey);
    if (!breakdownItem) {
        breakdownItem = {
            model,
            imageSize,
            count: 0,
            tokens: 0,
            cost: 0
        };
        dayStats.breakdown.push(breakdownItem);
    }
    breakdownItem.count += count;
    breakdownItem.tokens += tokens;
    breakdownItem.cost += cost;

    // Prune old days (> 30)
    if (history.daily.length > 30) {
        history.daily = history.daily.slice(0, 30);
    }

    saveHistory(history);
    console.log(`[CostService] Recorded: $${cost.toFixed(4)} (${details})`);

    // Trigger Sync
    scheduleSync();
}

// --- Getters ---

export function getTodayCosts(): DayStats {
    const history = loadHistory();
    const today = getTodayString();

    // Try to find today's stats
    let stats = history.daily.find(d => d.date === today);

    // If not found, try to migrate from old storage key just in case
    if (!stats) {
        try {
            const oldKey = 'kk_studio_daily_costs';
            const oldData = localStorage.getItem(oldKey);
            if (oldData) {
                const parsed = JSON.parse(oldData);
                if (parsed.date === today) {
                    // We found legacy data for today, let's use it temporarily or migrate it
                    // For simplicity, return it as DayStats equivalent
                    stats = {
                        date: parsed.date,
                        totalCostUsd: parsed.totalCostUsd || 0,
                        totalImages: parsed.totalImages || 0,
                        totalTokens: parsed.totalTokens || 0,
                        breakdown: [] // Reconstruction might be hard, return empty breakdown
                    };
                }
            }
        } catch (e) {
            // 统计数据解析失败时，返回默认值
            console.warn('[CostService] Failed to parse stats:', e);
        }
    }

    return stats || {
        date: today,
        totalCostUsd: 0,
        totalImages: 0,
        totalTokens: 0,
        breakdown: []
    };
}

export function getHistorySummary(days: number = 30): CostBreakdownItem[] {
    const history = loadHistory();
    const map = new Map<string, CostBreakdownItem>();

    // Aggregate last N days
    const relevantDays = history.daily.slice(0, days);

    relevantDays.forEach(day => {
        day.breakdown.forEach(item => {
            const key = `${item.model}_${item.imageSize}`;
            if (!map.has(key)) {
                const clone = JSON.parse(JSON.stringify(item));
                map.set(key, clone);
            } else {
                const existing = map.get(key)!;
                existing.count += item.count;
                existing.tokens += item.tokens;
                existing.cost += item.cost;
            }
        });
    });

    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

export function getRecentEntries(limit: number = 50): CostEntry[] {
    const history = loadHistory();
    return history.recent.slice(0, limit);
}

// Alias for compatibility if needed, but UI should switch to getHistorySummary
export function getCostsByModel(): CostBreakdownItem[] {
    return getHistorySummary(1); // Default to today/recent if called without args, or change logic
}


// --- Budget & Sync (Kept mostly same) ---

export function getDailyBudget(): number {
    const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
    return stored ? parseFloat(stored) : -1;
}

export function setDailyBudget(amount: number): void {
    localStorage.setItem(BUDGET_STORAGE_KEY, amount.toString());
    scheduleSync();
}

export async function setUserId(userId: string | null): Promise<void> {
    if (currentUserId === userId) return;
    currentUserId = userId;
    if (userId) {
        try {
            await syncWithCloud();
        } catch (e) {
            console.error('[CostService] Initial sync failed:', e);
        }
    }
}

export function getCurrentUserId(): string | null {
    return currentUserId;
}

export async function forceSync(): Promise<boolean> {
    if (!currentUserId) return false;
    await syncWithCloud();
    return true;
}

registerCostSyncHandler(forceSync);

function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        syncWithCloud();
    }, 2000);
}

async function syncWithCloud() {
    if (!currentUserId || isSyncing || currentUserId.startsWith('dev-user-')) return;
    if (tempUserService.getCachedTempUser()) return;
    isSyncing = true;
    try {
        // The migrated architecture persists key-slot/provider billing state via keyManager API sync.
        // Detailed local cost history remains browser-local until a dedicated billing summary contract exists.
        const todayStats = getTodayCosts();
        const slots = keyManager.getSlots();
        const totalBudget = slots.reduce((sum, s: KeySlot) => {
            return sum + (s.budgetLimit > 0 ? s.budgetLimit : 0);
        }, 0);
        const totalUsed = slots.reduce((sum, s: KeySlot) => sum + (s.totalCost || 0), 0);

        console.log('[CostService] Cloud sync skipped; using migrated local summary only.', {
            userId: currentUserId,
            date: todayStats.date,
            dailyCostUsd: todayStats.totalCostUsd,
            dailyTokens: todayStats.totalTokens,
            totalBudget: totalBudget || -1,
            totalUsed,
        });
    } catch (e) {
        console.warn('[CostService] Sync error:', e);
    } finally {
        isSyncing = false;
    }
}


