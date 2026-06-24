import type { CapabilityRouteAssignment, PromptOptimizerResult } from '../../types';
import { keyManager } from '../auth/keyManager';
import {
    isCustomRoutingEnabled,
    resolveCapabilityRouteAssignment,
} from '../api/capabilityRouteAssignments';
import {
    buildAutomaticOptimizationInstruction,
    resolveAutomaticOptimizationRoute,
} from './promptOptimizerAutoroute.ts';
import {
    buildPromptOptimizerLocalRulebookResult,
    LOCAL_RULEBOOK_MODEL_ID,
    resolvePromptOptimizationStrategy,
    type PromptOptimizationRulebookOptions,
    type PromptOptimizationStrategy,
} from './promptOptimizerRulebook.ts';
import { generationService as llmService } from './generationService';

type PromptOptimizationOptions = PromptOptimizationRulebookOptions;
type PromptOptimizerRouteMeta = PromptOptimizerResult['meta'] & {
    route_id?: string;
    route_title?: string;
};

type OptimizerCacheEntry = {
    result: PromptOptimizationResult;
    createdAt: number;
};

export interface PromptOptimizationResult {
    optimizedEn: string;
    optimizedZh: string;
    usedModelId: string;
    fullResult?: PromptOptimizerResult;
}

const OPTIMIZER_CACHE_KEY = 'kk_prompt_optimizer_cache_v6';
const LEGACY_OPTIMIZER_CACHE_KEYS = ['kk_prompt_optimizer_cache_v5', 'kk_prompt_optimizer_cache_v4'];
const OPTIMIZER_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CJK_PATTERN = /[\u3400-\u9fff]/;

const HUMAN_DEFAULT_TABS: PromptOptimizerResult['ui_payload']['tabs'] = [
    { id: 'raw', label_zh: '未优化', label_en: 'Raw' },
    { id: 'opt', label_zh: '已优化', label_en: 'Optimized' },
];

const OPTIMIZER_SYSTEM_PROMPT = `You are a prompt optimization architect for image-generation workflows.

You will receive:
- the user prompt
- target model context
- whether the target model has native thinking
- automatic route guidance
- route-aware optimization constraints

Your task:
1. clarify the goal, constraints, missing details, and likely failure modes
2. produce a better prompt without changing the user's intent
3. adapt the optimization style to the target model capability

Rules:
- Output valid JSON only.
- Never reveal chain-of-thought.
- If the target model supports thinking, keep optimized_prompt_en compact, outcome-oriented, and constraint-rich.
- If the target model does not support thinking, make optimized_prompt_en more explicit and structured.
- optimized_prompt_en must be English only.
- optimized_prompt_zh_display must be concise Chinese.
- Keep arrays short and useful.

Required JSON:
{
  "raw_prompt_original": "string",
  "optimized_prompt_en": "string",
  "optimized_prompt_zh_display": "string",
  "negative_constraints": ["string"],
  "assumptions": ["string"],
  "validation_checks": ["string"],
  "missing_inputs": ["string"],
  "confidence": "low | medium | high",
  "params": {
    "task_type": "icon_set | ecommerce_hero | lifestyle_photo | infographic | logo | ui | other",
    "subject": "string",
    "style": "string",
    "composition": "string",
    "lighting": "string",
    "background": "string",
    "materials": ["string"],
    "color_palette": ["string"],
    "aspect_ratio": "string"
  },
  "ui_payload": {
    "tabs": [
      { "id": "raw", "label_zh": "未优化", "label_en": "Raw" },
      { "id": "opt", "label_zh": "已优化", "label_en": "Optimized" }
    ],
    "default_tab": "opt"
  },
  "meta": {
    "version": "prompt-optimizer-v4",
    "timestamp": "ISO string"
  }
}`;

const cleanText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return normalized || fallback;
};

const cleanDiagnosticToken = (value: unknown): string => {
    const normalized = cleanText(value);
    return /^[A-Za-z0-9_.:-]{1,80}$/.test(normalized) ? normalized : '';
};

export const summarizePromptOptimizerError = (error: unknown): string => {
    const record = typeof error === 'object' && error ? error as Record<string, unknown> : {};
    const name = cleanDiagnosticToken(error instanceof Error ? error.name : record.name) || 'Error';
    const code = cleanDiagnosticToken(record.code);
    const status = cleanDiagnosticToken(record.status || record.statusCode);
    return [name, code ? `code=${code}` : '', status ? `status=${status}` : '']
        .filter(Boolean)
        .join(' ');
};

const truncateText = (value: string, maxLength: number): string => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
};

const normalizeTextList = (value: unknown, maxItems = 6): string[] => {
    const rawItems = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/\r?\n|[;；•]+/g)
            : [];

    const deduped: string[] = [];
    const seen = new Set<string>();

    rawItems.forEach((item) => {
        const normalized = cleanText(
            String(item || '')
                .replace(/^[-*+\d.)\s]+/, '')
                .replace(/\s{2,}/g, ' '),
        );
        if (!normalized) return;

        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(normalized);
    });

    return deduped.slice(0, maxItems);
};

const buildOptimizerCacheFingerprint = (value: string): string => {
    const normalized = cleanText(value);
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i += 1) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `${normalized.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const redactOptimizerCacheResult = (result: PromptOptimizationResult): PromptOptimizationResult => ({
    ...result,
    fullResult: result.fullResult
        ? {
            ...result.fullResult,
            raw_prompt_original: '<omitted:prompt>',
            params: {
                ...result.fullResult.params,
                subject: '<omitted:prompt>',
            },
        }
        : undefined,
});

const readOptimizerCache = (): Record<string, OptimizerCacheEntry> => {
    try {
        LEGACY_OPTIMIZER_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
        const raw = localStorage.getItem(OPTIMIZER_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeOptimizerCache = (cache: Record<string, OptimizerCacheEntry>) => {
    try {
        localStorage.setItem(OPTIMIZER_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Ignore cache write failures.
    }
};

const collectReadableGenericMissingInputs = (
    input: string,
    mode?: string,
): string[] => {
    const lowerInput = input.toLowerCase();
    const genericMissingInputs: string[] = [];

    if (input.trim().length < 18) {
        genericMissingInputs.push('核心主体或关键对象');
    }
    if (!/(cinematic|minimal|photoreal|vector|3d|flat|watercolor|插画|写实|扁平|电影感|海报|ui|dashboard|logo|图标|产品|product)/i.test(lowerInput)) {
        genericMissingInputs.push('风格或表现方式');
    }
    if (!/(light|lighting|studio|rim light|sunset|golden hour|夜景|逆光|柔光|棚拍|光线)/i.test(lowerInput)) {
        genericMissingInputs.push('光线或场景环境');
    }
    if (
        mode !== 'ppt'
        && !/(close-up|wide shot|macro|top view|composition|layout|俯拍|特写|构图|镜头|版式)/i.test(lowerInput)
    ) {
        genericMissingInputs.push('构图、镜头或版式重点');
    }

    return genericMissingInputs;
};

const detectReadableMissingInputs = (
    input: string,
    route: { missingInputHints: string[] },
    mode?: string,
): string[] => {
    const genericMissingInputs = collectReadableGenericMissingInputs(input, mode);
    if (input.trim().length >= 18) {
        return normalizeTextList(genericMissingInputs, 4);
    }

    const prioritizedMissingInputs = [
        ...route.missingInputHints,
        ...genericMissingInputs,
    ];

    return normalizeTextList(prioritizedMissingInputs, 4);
    /*
    const lowerInput = input.toLowerCase();
    const missing: string[] = [];

    if (input.trim().length < 18) {
        missing.push('核心主体或关键对象');
    }
    if (!/(cinematic|minimal|photoreal|vector|3d|flat|watercolor|插画|写实|扁平|电影感|海报|ui|dashboard|logo|图标|产品|product)/i.test(lowerInput)) {
        missing.push('风格或表现方式');
    }
    if (!/(light|lighting|studio|rim light|sunset|golden hour|夜景|逆光|柔光|棚拍|光线)/i.test(lowerInput)) {
        missing.push('光线或场景环境');
    }
    if (
        mode !== 'ppt'
        && !/(close-up|wide shot|macro|top view|composition|layout|俯拍|特写|构图|镜头|版式)/i.test(lowerInput)
    ) {
        missing.push('构图、镜头或版式重点');
    }

    if (input.trim().length < 18) {
        missing.push(...route.missingInputHints);
    }

    return normalizeTextList(missing, 4);
    */
};

const buildOptimizerMeta = ({
    version,
    timestamp,
    route,
    strategy,
    validationStatus,
    engine,
    aiStatus,
    optMode,
}: {
    version: string;
    timestamp: string;
    route: { strategyId: string; strategyTitle: string };
    strategy: PromptOptimizationStrategy;
    validationStatus: 'ready' | 'needs-review';
    engine: 'local-rulebook' | 'ai-enhanced';
    aiStatus: 'skipped' | 'enhanced' | 'failed-fallback';
    optMode?: 'auto' | 'manual';
}): PromptOptimizerRouteMeta => ({
    version,
    timestamp,
    optimization_mode: optMode || 'auto',
    engine,
    ai_status: aiStatus,
    route_id: route.strategyId,
    route_title: route.strategyTitle,
    strategy,
    validation_status: validationStatus,
});

/* legacy missing-input helper removed during autoroute migration
    const lowerInput = input.toLowerCase();
    const missing: string[] = [];

    if (input.trim().length < 18) {
        missing.push('具体主体或关键对象');
    }
    if (!/(cinematic|minimal|photoreal|vector|3d|flat|watercolor|插画|写实|扁平|电影感|海报|ui|dashboard|logo|图标|产品|product)/i.test(lowerInput)) {
        missing.push('风格或表现方式');
    }
    if (!/(light|lighting|studio|rim light|sunset|golden hour|夜景|逆光|柔光|棚拍|光线)/i.test(lowerInput)) {
        missing.push('光线或场景环境');
    }
    if (
        mode !== 'ppt'
        && !/(close-up|wide shot|macro|top view|composition|layout|俯拍|特写|构图|镜头|版式)/i.test(lowerInput)
    ) {
        missing.push('构图、镜头或版式重点');
    }

    return normalizeTextList(missing, 4);
}; */

const buildStrategyHint = (
    strategy: PromptOptimizationStrategy,
    options?: PromptOptimizationOptions,
): string => {
    if (strategy === 'reasoning-native') {
        return options?.thinkingMode === 'high'
            ? 'Target model supports native thinking. Keep the prompt compact, goal-led, and constraint-rich. Do not over-script the reasoning.'
            : 'Target model supports native thinking. Prefer concise intent, constraints, and desired outcome over explicit step-by-step scaffolding.';
    }

    return 'Target model does not have strong native thinking. Make the prompt explicit and structured so the model can follow subject, style, composition, lighting, and constraints directly.';
};

const normalizeConfidence = (
    value: unknown,
    fallback: PromptOptimizerResult['confidence'] = 'medium',
): PromptOptimizerResult['confidence'] => {
    const normalized = cleanText(value, fallback).toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
        return normalized;
    }
    return fallback;
};

const normalizeTaskType = (
    value: unknown,
    fallback: PromptOptimizerResult['params']['task_type'],
): PromptOptimizerResult['params']['task_type'] => {
    const normalized = cleanText(value, fallback).toLowerCase().replace(/\s+/g, '_');
    const valid: PromptOptimizerResult['params']['task_type'][] = [
        'icon_set',
        'ecommerce_hero',
        'lifestyle_photo',
        'infographic',
        'logo',
        'ui',
        'other',
    ];
    return valid.includes(normalized as PromptOptimizerResult['params']['task_type'])
        ? normalized as PromptOptimizerResult['params']['task_type']
        : fallback;
};

const buildOptimizerCacheKey = (
    input: string,
    strategy: PromptOptimizationStrategy,
    options?: PromptOptimizationOptions,
    aiModelId?: string,
    aiRouteId?: string,
) => {
    const autoroute = resolveAutomaticOptimizationRoute(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
        preferredArchetypeId: options?.preferredArchetypeId,
    });
    const refSign = (options?.referenceImages || [])
        .map((ref) => `${cleanText(ref.mimeType).toLowerCase()}:${buildOptimizerCacheFingerprint(ref.data)}`)
        .join('|');

    return [
        'ai-enhanced',
        cleanText(aiModelId).toLowerCase(),
        cleanText(aiRouteId).toLowerCase(),
        cleanText(options?.preferredModelId).toLowerCase(),
        cleanText(options?.aspectRatio).toLowerCase(),
        cleanText(options?.imageSize).toLowerCase(),
        cleanText(options?.mode).toLowerCase(),
        cleanText(options?.preferredArchetypeId).toLowerCase(),
        autoroute.strategyId,
        strategy,
        buildOptimizerCacheFingerprint(input),
        cleanText(options?.thinkingMode).toLowerCase(),
        String(!!options?.supportsThinking),
        refSign,
        buildOptimizerCacheFingerprint(options?.ecommerceContext?.taskState?.taskId || ''),
        buildOptimizerCacheFingerprint(options?.ecommerceContext?.outputTarget?.label || ''),
    ].join('::');
};

const resolveModelCandidate = (
    models: ReturnType<typeof keyManager.getGlobalModelList>,
    modelId?: string,
) => {
    if (!modelId) {
        return null;
    }

    const exact = models.find((model) => model.id === modelId);
    if (exact) {
        return exact.id;
    }

    const suffix = modelId.split('@')[1];
    if (!suffix) {
        return null;
    }

    const sameSuffix = models.find((model) => model.id.endsWith(`@${suffix}`));
    return sameSuffix?.id || null;
};

const decodeRouteToken = (value: string | null | undefined): string => {
    try {
        return decodeURIComponent(String(value || '').trim().toLowerCase());
    } catch {
        return String(value || '').trim().toLowerCase();
    }
};

const extractModelRouteTarget = (modelId: string): string => {
    const decodedSuffix = decodeRouteToken(modelId.split('@')[1]);
    if (!decodedSuffix) return '';
    if (decodedSuffix.startsWith('slot_key_')) return decodedSuffix.slice(5);
    if (decodedSuffix.startsWith('slot_')) return decodedSuffix.slice(5);
    if (decodedSuffix.startsWith('provider_')) return decodedSuffix;
    return decodedSuffix;
};

const resolveRouteScopedModelCandidate = (
    models: ReturnType<typeof keyManager.getGlobalModelList>,
    routeId?: string,
) => {
    const normalizedRouteId = decodeRouteToken(routeId);
    if (!normalizedRouteId) return null;

    const routeCandidates = models.filter((model) => {
        const target = extractModelRouteTarget(model.id);
        return target === normalizedRouteId
            || target === `provider_${normalizedRouteId}`
            || decodeRouteToken(model.id.split('@')[1]) === normalizedRouteId;
    });

    const preferred = routeCandidates.find((model) => model.id.toLowerCase().includes('gemini-2.5-flash'));
    return preferred?.id || routeCandidates[0]?.id || null;
};

const resolveExplicitOptimizerAiRoute = (): CapabilityRouteAssignment | undefined => {
    if (!isCustomRoutingEnabled()) {
        return undefined;
    }

    const assignment = resolveCapabilityRouteAssignment('prompt_optimizer');
    if (!assignment?.enabled) {
        return undefined;
    }

    return assignment.primaryModelId || assignment.primaryRouteId ? assignment : undefined;
};

const pickOptimizerModel = (optimizerRoute: CapabilityRouteAssignment): string | null => {
    // 简体中文注释：AI 增强只能消费用户显式配置的聊天链路，避免后台优化偷偷走系统积分模型。
    const models = keyManager.getGlobalModelList().filter((model) => model.type === 'chat' && !model.isSystemInternal);
    if (models.length === 0) return null;

    const routedModelId = resolveModelCandidate(models, optimizerRoute.primaryModelId);
    if (routedModelId) {
        return routedModelId;
    }

    const routeScopedModelId = resolveRouteScopedModelCandidate(models, optimizerRoute.primaryRouteId);
    if (routeScopedModelId) {
        return routeScopedModelId;
    }

    return null;
};

const extractJsonObject = (text: string): any => {
    const normalized = cleanText(
        text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/g, ''),
    );
    const candidates = [normalized];

    const firstBrace = normalized.indexOf('{');
    const lastBrace = normalized.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.push(normalized.slice(firstBrace, lastBrace + 1));
    }

    candidates.push(...candidates.map((candidate) => candidate.replace(/,\s*([}\]])/g, '$1')));

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch {
            // Try next candidate.
        }
    }

    throw new Error('Optimizer returned non-JSON output');
};

const buildOptimizationUserMessage = (
    input: string,
    strategy: PromptOptimizationStrategy,
    options?: PromptOptimizationOptions,
): string => {
    const autoroute = resolveAutomaticOptimizationRoute(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
        preferredArchetypeId: options?.preferredArchetypeId,
    });
    const missingInputs = detectReadableMissingInputs(input, autoroute, options?.mode);
    const autoInstruction = buildAutomaticOptimizationInstruction(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
        preferredArchetypeId: options?.preferredArchetypeId,
    });

    return [
        `Raw prompt: "${input}"`,
        `Target generation model: ${options?.preferredModelId || 'unknown'}`,
        `Target model native thinking support: ${options?.supportsThinking ? 'yes' : 'no'}`,
        `Requested thinking mode: ${options?.thinkingMode || 'minimal'}`,
        `Optimization strategy: ${strategy}`,
        `Strategy guidance: ${buildStrategyHint(strategy, options)}`,
        `Aspect ratio: ${options?.aspectRatio || '1:1'}`,
        `Image size: ${options?.imageSize || 'default'}`,
        `Mode: ${options?.mode || 'image'}`,
        `Reference images attached: ${options?.referenceImages?.length || 0}`,
        options?.ecommerceContext ? [
            'Structured ecommerce context:',
            `- task id: ${options.ecommerceContext.taskState.taskId}`,
            `- output label: ${options.ecommerceContext.outputTarget?.label || options.ecommerceContext.taskState.outputTypeLabel}`,
            `- sparse intent: ${options.ecommerceContext.taskState.sparseUserIntent || 'none'}`,
            `- role bindings: ${options.ecommerceContext.assetRoles.map((role) => role.normalizedLabel).join(', ') || 'none'}`,
            `- series tone: ${options.ecommerceContext.seriesTemplate.styleProfile.tone}`,
            `- copy headline: ${options.ecommerceContext.taskState.copy.headline || 'auto'}`,
            `- copy highlight: ${options.ecommerceContext.taskState.copy.highlight || 'auto'}`,
        ].join('\n') : '',
        `Automatic route: ${autoroute.strategyTitle}`,
        `Route task type: ${autoroute.taskType}`,
        `Additional optimization instructions: ${truncateText(autoInstruction, 320)}`,
        'Preserve requirement semantics, domain terminology, product nouns, and professional phrasing from the raw prompt.',
        'Do not flatten the prompt into generic art language. Keep the optimized prompt aligned with the requested scene, workflow, and specialist vocabulary.',
        missingInputs.length > 0
            ? `Likely underspecified areas: ${missingInputs.join(', ')}`
            : 'Likely underspecified areas: none detected',
        'Return valid JSON only.',
    ].join('\n');
};

const sanitizePromptOptimizerResult = (
    parsed: any,
    input: string,
    strategy: PromptOptimizationStrategy,
    options?: PromptOptimizationOptions,
    fallbackResult?: PromptOptimizerResult,
): PromptOptimizerResult => {
    const fallback = fallbackResult || buildPromptOptimizerLocalRulebookResult(input, strategy, options);
    const autoroute = resolveAutomaticOptimizationRoute(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
        preferredArchetypeId: options?.preferredArchetypeId,
    });
    const params = typeof parsed?.params === 'object' && parsed.params ? parsed.params : {};
    const missingInputs = normalizeTextList(parsed?.missing_inputs, 6);
    const normalizedMissingInputs = missingInputs.length > 0
        ? missingInputs
        : (fallback.missing_inputs || []);

    let optimizedPromptEn = cleanText(parsed?.optimized_prompt_en);
    if (!optimizedPromptEn || CJK_PATTERN.test(optimizedPromptEn)) {
        optimizedPromptEn = fallback.optimized_prompt_en;
    }

    if (strategy === 'reasoning-native' && optimizedPromptEn.length > 950) {
        optimizedPromptEn = fallback.optimized_prompt_en;
    }
    if (strategy === 'structure-first' && optimizedPromptEn.length < 48) {
        optimizedPromptEn = fallback.optimized_prompt_en;
    }

    return {
        raw_prompt_original: input,
        optimized_prompt_en: truncateText(optimizedPromptEn, 1200),
        optimized_prompt_zh_display: cleanText(parsed?.optimized_prompt_zh_display, fallback.optimized_prompt_zh_display),
        negative_constraints: normalizeTextList(parsed?.negative_constraints, 8).length > 0
            ? normalizeTextList(parsed?.negative_constraints, 8)
            : fallback.negative_constraints,
        assumptions: normalizeTextList(parsed?.assumptions, 6).length > 0
            ? normalizeTextList(parsed?.assumptions, 6)
            : fallback.assumptions,
        validation_checks: normalizeTextList(parsed?.validation_checks, 8).length > 0
            ? normalizeTextList(parsed?.validation_checks, 8)
            : fallback.validation_checks,
        missing_inputs: normalizedMissingInputs,
        confidence: normalizedMissingInputs.length >= 3
            ? 'low'
            : normalizeConfidence(parsed?.confidence, fallback.confidence),
        params: {
            task_type: normalizeTaskType(params.task_type, fallback.params.task_type),
            subject: cleanText(params.subject, fallback.params.subject),
            style: cleanText(params.style, fallback.params.style),
            composition: cleanText(params.composition, fallback.params.composition),
            lighting: cleanText(params.lighting, fallback.params.lighting),
            background: cleanText(params.background, fallback.params.background),
            materials: normalizeTextList(params.materials, 5),
            color_palette: normalizeTextList(params.color_palette, 5),
            aspect_ratio: cleanText(params.aspect_ratio, fallback.params.aspect_ratio),
        },
        ui_payload: {
            tabs: HUMAN_DEFAULT_TABS,
            default_tab: 'opt',
        },
        meta: buildOptimizerMeta({
            version: cleanText(parsed?.meta?.version, 'prompt-optimizer-v4'),
            timestamp: cleanText(parsed?.meta?.timestamp, new Date().toISOString()),
            route: autoroute,
            strategy,
            validationStatus: normalizedMissingInputs.length > 0 ? 'needs-review' : 'ready',
            engine: 'ai-enhanced',
            aiStatus: 'enhanced',
            optMode: (!options?.preferredArchetypeId || options.preferredArchetypeId === 'auto') ? 'auto' : 'manual',
        }),
    };
};

export const optimizePromptForImage = async (
    rawPrompt: string,
    options?: PromptOptimizationOptions,
): Promise<PromptOptimizationResult> => {
    const input = cleanText(rawPrompt);
    if (!input) throw new Error('Prompt is empty');

    const strategy = resolvePromptOptimizationStrategy(options);
    const resolvedOptions: PromptOptimizationOptions = { ...options };
    const localFallback = buildPromptOptimizerLocalRulebookResult(input, strategy, resolvedOptions);
    const localResult: PromptOptimizationResult = {
        optimizedEn: localFallback.optimized_prompt_en,
        optimizedZh: localFallback.optimized_prompt_zh_display,
        usedModelId: LOCAL_RULEBOOK_MODEL_ID,
        fullResult: localFallback,
    };

    const optimizerRoute = resolveExplicitOptimizerAiRoute();
    if (!optimizerRoute) {
        return localResult;
    }

    const modelId = pickOptimizerModel(optimizerRoute);
    if (!modelId) {
        return localResult;
    }

    const cacheKey = buildOptimizerCacheKey(
        input,
        strategy,
        resolvedOptions,
        modelId,
        optimizerRoute.primaryRouteId || optimizerRoute.primaryModelId,
    );
    const cache = readOptimizerCache();
    const cached = cache[cacheKey];
    if (cached && (Date.now() - cached.createdAt) < OPTIMIZER_CACHE_TTL_MS) {
        return cached.result;
    }

    const preferredKeyId = optimizerRoute?.primaryRouteId && keyManager.getKey(optimizerRoute.primaryRouteId)
        ? optimizerRoute.primaryRouteId
        : undefined;

    try {
        const raw = await llmService.chat({
            modelId,
            messages: [
                { role: 'system', content: OPTIMIZER_SYSTEM_PROMPT },
                { role: 'user', content: buildOptimizationUserMessage(input, strategy, resolvedOptions) },
            ],
            inlineData: resolvedOptions.referenceImages,
            stream: false,
            maxTokens: 1600,
            temperature: 0.2,
            preferredKeyId,
        });

        const parsed = extractJsonObject(raw);
        const fullResult = sanitizePromptOptimizerResult(parsed, input, strategy, resolvedOptions, localFallback);
        const result: PromptOptimizationResult = {
            optimizedEn: fullResult.optimized_prompt_en,
            optimizedZh: fullResult.optimized_prompt_zh_display,
            usedModelId: modelId,
            fullResult,
        };

        const cacheSafeResult = redactOptimizerCacheResult(result);
        cache[cacheKey] = { result: cacheSafeResult, createdAt: Date.now() };
        writeOptimizerCache(cache);
        return result;
    } catch (error) {
        console.warn('[Optimizer] AI enhancement failed, using local rulebook result.', summarizePromptOptimizerError(error));
        const fallback: PromptOptimizerResult = {
            ...localFallback,
            meta: {
                ...localFallback.meta,
                ai_status: 'failed-fallback',
            },
        };
        return {
            optimizedEn: fallback.optimized_prompt_en,
            optimizedZh: fallback.optimized_prompt_zh_display,
            usedModelId: LOCAL_RULEBOOK_MODEL_ID,
            fullResult: fallback,
        };
    }
};
