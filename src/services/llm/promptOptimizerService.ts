import type { PromptOptimizerResult } from '../../types';
import { keyManager } from '../auth/keyManager';
import {
    buildAutomaticOptimizationInstruction,
    resolveAutomaticOptimizationRoute,
} from './promptOptimizerAutoroute.ts';
import { llmService } from './LLMService';

type ReferenceImageInput = {
    mimeType: string;
    data: string;
};

type PromptOptimizationOptions = {
    preferredModelId?: string;
    aspectRatio?: string;
    imageSize?: string;
    mode?: string;
    referenceImages?: ReferenceImageInput[];
    supportsThinking?: boolean;
    thinkingMode?: 'minimal' | 'high';
};

type PromptOptimizationStrategy = 'reasoning-native' | 'structure-first';
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

const OPTIMIZER_CACHE_KEY = 'kk_prompt_optimizer_cache_v4';
const OPTIMIZER_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CJK_PATTERN = /[\u3400-\u9fff]/;

const DEFAULT_TABS: PromptOptimizerResult['ui_payload']['tabs'] = [
    { id: 'raw', label_zh: '未优化', label_en: 'Raw' },
    { id: 'opt', label_zh: '已优化', label_en: 'Optimized' },
];

const HUMAN_DEFAULT_TABS: PromptOptimizerResult['ui_payload']['tabs'] = [
    { id: 'raw', label_zh: '未优化', label_en: 'Raw' },
    { id: 'opt', label_zh: '已优化', label_en: 'Optimized' },
];

const DEFAULT_NEGATIVE_CONSTRAINTS = [
    'Avoid adding extra subjects that change the original idea.',
    'Avoid clutter, weak focal hierarchy, and muddy lighting.',
    'Avoid broken anatomy, distorted geometry, or low-detail textures.',
];

const DEFAULT_VALIDATION_CHECKS = [
    'Core subject is explicit and unambiguous.',
    'Style, composition, and lighting all support the requested goal.',
    'Prompt is compact enough to avoid unnecessary token cost.',
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

const readOptimizerCache = (): Record<string, OptimizerCacheEntry> => {
    try {
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
        && !/(close-up|wide shot|macro|top view|composition|layout|淇媿|鐗瑰啓|鏋勫浘|闀滃ご|鐗堝紡)/i.test(lowerInput)
    ) {
        genericMissingInputs.push('鏋勫浘銆侀暅澶存垨鐗堝紡閲嶇偣');
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

const getReadableFallbackOptimizedZh = (strategy: PromptOptimizationStrategy): string => (
    strategy === 'reasoning-native'
        ? '已按支持思考的模型优化为“目标 + 约束 + 结果导向”的精简提示词。'
        : '已按不带思考能力的模型优化为更显式的结构化提示词。'
);

const buildOptimizerMeta = ({
    version,
    timestamp,
    route,
    strategy,
    validationStatus,
}: {
    version: string;
    timestamp: string;
    route: { strategyId: string; strategyTitle: string };
    strategy: PromptOptimizationStrategy;
    validationStatus: 'ready' | 'needs-review';
}): PromptOptimizerRouteMeta => ({
    version,
    timestamp,
    optimization_mode: 'auto',
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

const inferTaskType = (
    input: string,
    mode?: string,
): PromptOptimizerResult['params']['task_type'] => {
    const lowerInput = input.toLowerCase();

    if (mode === 'ppt') return 'infographic';
    if (/(icon|sticker|emoji|button|图标|贴纸)/i.test(lowerInput)) return 'icon_set';
    if (/(amazon|ecommerce|hero|kv|packshot|product photo|product shot|产品|主图|商品)/i.test(lowerInput)) return 'ecommerce_hero';
    if (/(dashboard|poster|infographic|ui|app|landing page|看板|海报|界面|版式)/i.test(lowerInput)) {
        return /(ui|app|dashboard|界面)/i.test(lowerInput) ? 'ui' : 'infographic';
    }
    if (/(logo|logomark|brand mark|标志)/i.test(lowerInput)) return 'logo';
    if (/(portrait|street|travel|outdoor|lifestyle|人物|街景|旅拍|户外)/i.test(lowerInput)) return 'lifestyle_photo';
    return 'other';
};

const getTaskDefaults = (
    taskType: PromptOptimizerResult['params']['task_type'],
    mode?: string,
) => {
    const pptComposition = 'presentation-safe hierarchy, strong focal grouping, text-safe spacing';

    switch (taskType) {
        case 'icon_set':
            return {
                style: 'clean, consistent icon family with simplified geometry',
                composition: 'centered set layout with even spacing',
                lighting: 'soft ambient light with crisp edge definition',
                background: 'white or transparent clean background',
            };
        case 'ecommerce_hero':
            return {
                style: 'premium commercial product visualization',
                composition: mode === 'ppt' ? pptComposition : 'hero composition with a dominant subject and tidy staging',
                lighting: 'controlled studio lighting with polished highlights and clean shadows',
                background: 'minimal premium backdrop that keeps full attention on the product',
            };
        case 'lifestyle_photo':
            return {
                style: 'cinematic lifestyle photography with believable detail',
                composition: mode === 'ppt' ? pptComposition : 'natural framing with depth and story-driven balance',
                lighting: 'naturalistic lighting that supports the intended mood',
                background: 'authentic real-world environment with moderate depth',
            };
        case 'logo':
            return {
                style: 'memorable brand mark with clean geometry',
                composition: 'centered silhouette-first design optimized for clarity',
                lighting: 'flat presentation suitable for vector-like output',
                background: 'clean neutral background with strong contrast',
            };
        case 'ui':
        case 'infographic':
            return {
                style: 'modern interface or editorial layout language',
                composition: mode === 'ppt' ? pptComposition : 'grid-based layout with strong hierarchy and ample whitespace',
                lighting: 'clean and even lighting or illustrative shading that preserves clarity',
                background: 'controlled canvas with intentional spacing and text-safe zones',
            };
        default:
            return {
                style: 'high-quality visual direction tailored to the subject',
                composition: mode === 'ppt' ? pptComposition : 'clear focal hierarchy with balanced negative space',
                lighting: 'coherent lighting that supports realism and depth',
                background: 'supportive background that does not compete with the main subject',
            };
    }
};

const resolveStrategy = (options?: PromptOptimizationOptions): PromptOptimizationStrategy => {
    if (options?.supportsThinking) {
        return 'reasoning-native';
    }
    return 'structure-first';
};

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

const buildHeuristicPrompt = (
    input: string,
    strategy: PromptOptimizationStrategy,
    options?: PromptOptimizationOptions,
): string => {
    const taskType = inferTaskType(input, options?.mode);
    const defaults = getTaskDefaults(taskType, options?.mode);
    const extraInstruction = truncateText(buildAutomaticOptimizationInstruction(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
    }), 220);

    if (strategy === 'reasoning-native') {
        return truncateText([
            input,
            `Target outcome: ${defaults.style}.`,
            `Composition: ${defaults.composition}.`,
            `Lighting: ${defaults.lighting}.`,
            `Background: ${defaults.background}.`,
            options?.aspectRatio ? `Aspect ratio ${options.aspectRatio}.` : '',
            extraInstruction ? `Additional constraint: ${extraInstruction}.` : '',
        ].filter(Boolean).join(' '), 900);
    }

    return truncateText([
        `Subject: ${input}.`,
        `Style: ${defaults.style}.`,
        `Composition: ${defaults.composition}.`,
        `Lighting: ${defaults.lighting}.`,
        `Background: ${defaults.background}.`,
        options?.aspectRatio ? `Aspect ratio: ${options.aspectRatio}.` : '',
        'Quality goal: clear subject separation, intentional hierarchy, and realistic detail where appropriate.',
        extraInstruction ? `Additional instruction: ${extraInstruction}.` : '',
    ].filter(Boolean).join(' '), 1100);
};

const buildFallbackResult = (
    input: string,
    strategy: PromptOptimizationStrategy,
    options?: PromptOptimizationOptions,
): PromptOptimizerResult => {
    const autoroute = resolveAutomaticOptimizationRoute(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
    });
    const taskType = autoroute.taskType === 'other'
        ? inferTaskType(input, options?.mode)
        : autoroute.taskType;
    const defaults = getTaskDefaults(taskType, options?.mode);
    const missingInputs = detectReadableMissingInputs(input, autoroute, options?.mode);
    const readableOptimizedZh = getReadableFallbackOptimizedZh(strategy);
    const confidence: PromptOptimizerResult['confidence'] =
        missingInputs.length >= 3 ? 'low' : missingInputs.length > 0 ? 'medium' : 'high';

    return {
        raw_prompt_original: input,
        optimized_prompt_en: buildHeuristicPrompt(input, strategy, options),
        /*
        legacy_optimized_prompt_zh_display: strategy === 'reasoning-native'
            ? '已按支持思考的模型优化为“目标 + 约束 + 结果导向”的精简提示词。'
            : '已按不带思考能力的模型优化为更显式的结构化提示词。',
        */
        optimized_prompt_zh_display: readableOptimizedZh,
        negative_constraints: [...DEFAULT_NEGATIVE_CONSTRAINTS],
        assumptions: normalizeTextList([
            `Automatic route: ${autoroute.strategyTitle}`,
            strategy === 'reasoning-native'
                ? 'Lean into the target model’s native reasoning instead of over-scripting it.'
                : 'Expanded the prompt structure because the target model benefits from explicit guidance.',
            input.trim().length < 18 ? 'Filled missing style and lighting details conservatively.' : '',
        ], 4),
        validation_checks: [...DEFAULT_VALIDATION_CHECKS],
        missing_inputs: missingInputs,
        confidence,
        params: {
            task_type: taskType,
            subject: input,
            style: defaults.style,
            composition: defaults.composition,
            lighting: defaults.lighting,
            background: defaults.background,
            materials: [],
            color_palette: [],
            aspect_ratio: options?.aspectRatio || '1:1',
        },
        ui_payload: {
            tabs: HUMAN_DEFAULT_TABS,
            default_tab: 'opt',
        },
        meta: buildOptimizerMeta({
            version: 'prompt-optimizer-fallback-v4',
            timestamp: new Date().toISOString(),
            route: autoroute,
            strategy,
            validationStatus: missingInputs.length > 0 ? 'needs-review' : 'ready',
        }),
    };
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
) => {
    const autoroute = resolveAutomaticOptimizationRoute(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
    });
    const refSign = (options?.referenceImages || [])
        .map((ref) => `${cleanText(ref.mimeType).toLowerCase()}:${cleanText(ref.data).slice(0, 32)}`)
        .join('|');

    return [
        cleanText(options?.preferredModelId).toLowerCase(),
        cleanText(options?.aspectRatio).toLowerCase(),
        cleanText(options?.imageSize).toLowerCase(),
        cleanText(options?.mode).toLowerCase(),
        autoroute.strategyId,
        strategy,
        input.trim(),
        cleanText(options?.thinkingMode).toLowerCase(),
        String(!!options?.supportsThinking),
        refSign,
    ].join('::');
};

const pickOptimizerModel = (preferredModelId?: string): string | null => {
    // Avoid silently consuming admin/system credits for behind-the-scenes prompt optimization.
    const models = keyManager.getGlobalModelList().filter((model) => model.type === 'chat' && !model.isSystemInternal);
    if (models.length === 0) return null;

    if (preferredModelId) {
        const exact = models.find((model) => model.id === preferredModelId);
        if (exact) return exact.id;

        const suffix = preferredModelId.split('@')[1];
        if (suffix) {
            const sameSuffix = models.find((model) => model.id.endsWith(`@${suffix}`));
            if (sameSuffix) return sameSuffix.id;
        }
    }

    const preferred = models.find((model) => model.id.toLowerCase().includes('gemini-2.5-flash'));
    return preferred ? preferred.id : models[0].id;
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
    });
    const missingInputs = detectReadableMissingInputs(input, autoroute, options?.mode);
    const autoInstruction = buildAutomaticOptimizationInstruction(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
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
        `Automatic route: ${autoroute.strategyTitle}`,
        `Route task type: ${autoroute.taskType}`,
        `Additional optimization instructions: ${truncateText(autoInstruction, 320)}`,
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
): PromptOptimizerResult => {
    const fallback = buildFallbackResult(input, strategy, options);
    const autoroute = resolveAutomaticOptimizationRoute(input, {
        mode: options?.mode,
        aspectRatio: options?.aspectRatio,
        referenceImageCount: options?.referenceImages?.length || 0,
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
        }),
    };
};

export const optimizePromptForImage = async (
    rawPrompt: string,
    options?: PromptOptimizationOptions,
): Promise<PromptOptimizationResult> => {
    const input = cleanText(rawPrompt);
    if (!input) throw new Error('Prompt is empty');

    const strategy = resolveStrategy(options);
    const resolvedOptions: PromptOptimizationOptions = { ...options };

    const cacheKey = buildOptimizerCacheKey(input, strategy, resolvedOptions);
    const cache = readOptimizerCache();
    const cached = cache[cacheKey];
    if (cached && (Date.now() - cached.createdAt) < OPTIMIZER_CACHE_TTL_MS) {
        return cached.result;
    }

    const modelId = pickOptimizerModel(resolvedOptions.preferredModelId);
    if (!modelId) {
        const fallback = buildFallbackResult(input, strategy, resolvedOptions);
        return {
            optimizedEn: fallback.optimized_prompt_en,
            optimizedZh: fallback.optimized_prompt_zh_display,
            usedModelId: 'fallback',
            fullResult: fallback,
        };
    }

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
        });

        const parsed = extractJsonObject(raw);
        const fullResult = sanitizePromptOptimizerResult(parsed, input, strategy, resolvedOptions);
        const result: PromptOptimizationResult = {
            optimizedEn: fullResult.optimized_prompt_en,
            optimizedZh: fullResult.optimized_prompt_zh_display,
            usedModelId: modelId,
            fullResult,
        };

        cache[cacheKey] = { result, createdAt: Date.now() };
        writeOptimizerCache(cache);
        return result;
    } catch (error) {
        console.warn('[Optimizer] Falling back to heuristic optimization.', error);
        const fallback = buildFallbackResult(input, strategy, resolvedOptions);
        return {
            optimizedEn: fallback.optimized_prompt_en,
            optimizedZh: fallback.optimized_prompt_zh_display,
            usedModelId: 'fallback',
            fullResult: fallback,
        };
    }
};
