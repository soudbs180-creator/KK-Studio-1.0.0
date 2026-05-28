import type {
  EcommerceEditableTaskState,
  EcommerceSeriesTemplate,
  EcommerceTaskAssetRoleBinding,
  PromptOptimizerResult,
} from '../../types';
import {
  buildAutomaticOptimizationInstruction,
  resolveAutomaticOptimizationRoute,
  type PromptOptimizerArchetypeId,
} from './promptOptimizerAutoroute.ts';

export type ReferenceImageInput = {
  mimeType: string;
  data: string;
};

export type PromptOptimizationRulebookOptions = {
  preferredModelId?: string;
  aspectRatio?: string;
  imageSize?: string;
  mode?: string;
  referenceImages?: ReferenceImageInput[];
  supportsThinking?: boolean;
  thinkingMode?: 'minimal' | 'high';
  ecommerceContext?: {
    taskState: EcommerceEditableTaskState;
    seriesTemplate: EcommerceSeriesTemplate;
    assetRoles: EcommerceTaskAssetRoleBinding[];
    outputTarget?: {
      label: string;
      aspectRatio: string;
      imageSize: string;
    };
  };
};

export type PromptOptimizationStrategy = 'reasoning-native' | 'structure-first';

type RulebookProfile = {
  taskType: PromptOptimizerResult['params']['task_type'];
  style: string;
  composition: string;
  camera: string;
  lighting: string;
  background: string;
  materialDetails: string;
  textAndFacts: string;
  negativeConstraints: string[];
  validationChecks: string[];
};

export const LOCAL_RULEBOOK_MODEL_ID = 'local-rulebook';

const HUMAN_DEFAULT_TABS: PromptOptimizerResult['ui_payload']['tabs'] = [
  { id: 'raw', label_zh: '未优化', label_en: 'Raw' },
  { id: 'opt', label_zh: '已优化', label_en: 'Optimized' },
];

const DEFAULT_NEGATIVE_CONSTRAINTS = [
  'Do not change the original user intent, product identity, or required subject.',
  'Avoid adding unrelated subjects, messy focal hierarchy, muddy lighting, or low-detail textures.',
  'Avoid broken anatomy, distorted geometry, unreadable text, and over-processed artifacts.',
];

const DEFAULT_VALIDATION_CHECKS = [
  'The core subject and action are explicit.',
  'Composition, lighting, style, and aspect ratio support the requested outcome.',
  'Reference images, text, and factual requirements have clear roles when present.',
];

const normalizeText = (value: unknown, fallback = ''): string => {
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
      ? value.split(/\r?\n|[;；、•]+/g)
      : [];
  const deduped: string[] = [];
  const seen = new Set<string>();

  rawItems.forEach((item) => {
    const normalized = normalizeText(
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

const getRulebookProfile = (
  routeId: PromptOptimizerArchetypeId,
  mode?: string,
): RulebookProfile => {
  const slideComposition = 'slide-safe hierarchy with a clear focal group, generous text-safe spacing, and uncluttered margins';

  switch (routeId) {
    case 'product-hero':
      return {
        taskType: 'ecommerce_hero',
        style: 'premium commercial product photography with clean staging and high perceived value',
        composition: mode === 'ppt' ? slideComposition : 'hero layout with strong product separation, copy-safe negative space, and tidy staging',
        camera: 'commercial product lens language, controlled perspective, crisp edges, realistic scale',
        lighting: 'controlled studio lighting with polished highlights, clean shadows, and material-revealing reflections',
        background: 'minimal premium backdrop that keeps attention on the product and selling point',
        materialDetails: 'preserve packaging, surface texture, fabric, metal, glass, labels, and product proportions',
        textAndFacts: 'keep brand text and product claims legible; do not invent unsupported specs',
        negativeConstraints: [
          'Do not alter the product identity, logo, packaging, or required selling point.',
          'Avoid cluttered props, cheap catalog lighting, distorted labels, and unrealistic material reflections.',
        ],
        validationChecks: [
          'Product remains the dominant subject.',
          'Selling point and material detail are visible.',
          'Composition leaves safe room for ecommerce copy or badges.',
        ],
      };
    case 'portrait-photo':
      return {
        taskType: 'lifestyle_photo',
        style: 'professional portrait photography with realistic skin, hair, fabric, and expression detail',
        composition: 'portrait framing with flattering headroom, clear eye focus, and natural body posture',
        camera: 'portrait lens language, shallow depth of field when suitable, accurate facial proportions',
        lighting: 'soft key light with believable catchlights and gentle separation from the background',
        background: 'clean contextual backdrop that supports the intended identity and mood',
        materialDetails: 'natural skin texture, individual hair detail, fabric texture, and realistic accessories',
        textAndFacts: 'preserve identity cues from references; avoid invented badges or text',
        negativeConstraints: [
          'Do not change identity, facial structure, or defining features when a reference person is provided.',
          'Avoid plastic skin, extra fingers, warped eyes, and over-smoothed portrait retouching.',
        ],
        validationChecks: [
          'Face and expression are coherent.',
          'Lighting supports the requested mood.',
          'Wardrobe and background match the intended use.',
        ],
      };
    case 'cinematic-scene':
      return {
        taskType: 'lifestyle_photo',
        style: 'cinematic lifestyle photography with believable story, atmosphere, and environmental detail',
        composition: mode === 'ppt' ? slideComposition : 'story-driven framing with depth, foreground/background separation, and a clear focal path',
        camera: 'cinematic lens language, intentional angle, controlled depth of field, and natural motion cues',
        lighting: 'coherent motivated lighting, color grading, and mood-appropriate contrast',
        background: 'authentic environment with enough world-building to feel real without visual noise',
        materialDetails: 'realistic skin, fabric, weathering, props, reflections, and environmental textures',
        textAndFacts: 'avoid random signage unless requested; keep culturally or historically specific details plausible',
        negativeConstraints: [
          'Avoid generic stock-photo staging, muddy shadows, and inconsistent lighting direction.',
          'Avoid adding story elements that contradict the user request.',
        ],
        validationChecks: [
          'Subject, action, and location read immediately.',
          'Lighting and lens choices support the same mood.',
          'Background detail does not overpower the focal subject.',
        ],
      };
    case 'ui-infographic':
      return {
        taskType: 'ui',
        style: 'modern interface, dashboard, infographic, or editorial layout language with restrained visual noise',
        composition: 'grid-based layout with strong information hierarchy, clear groups, and generous text-safe spacing',
        camera: 'front-facing layout presentation or subtle isometric perspective only when it improves clarity',
        lighting: 'clean even lighting or gentle illustrative shading that preserves text and data readability',
        background: 'controlled canvas with intentional whitespace, safe margins, and no distracting decoration',
        materialDetails: 'sharp UI cards, legible labels, consistent icon style, and precise spacing',
        textAndFacts: 'render requested text exactly, keep labels readable, and mark data/diagram facts as accuracy-sensitive',
        negativeConstraints: [
          'Avoid tiny unreadable text, fake charts, random numbers, and decorative clutter.',
          'Avoid bending the layout into generic art language when the user asked for information design.',
        ],
        validationChecks: [
          'Information hierarchy is obvious.',
          'Text-safe zones and margins are preserved.',
          'Facts, labels, and diagrams are treated as accuracy-sensitive.',
        ],
      };
    case 'ppt-narrative':
      return {
        taskType: 'infographic',
        style: 'presentation-ready visual system with clear narrative hierarchy and deck-consistent polish',
        composition: slideComposition,
        camera: 'flat or gently dimensional slide visual language that supports scanning from a distance',
        lighting: 'clean, calm lighting or illustrative shading that keeps titles and key points readable',
        background: 'presentation-safe background with enough contrast for overlays and speaker-friendly focus',
        materialDetails: 'crisp shapes, readable labels, consistent visual metaphors, and minimal decorative noise',
        textAndFacts: 'keep headline and labels concise, legible, and faithful to the slide topic',
        negativeConstraints: [
          'Avoid dense poster composition, unreadable microtext, and decorative elements that compete with the message.',
          'Avoid inventing data or claims that the prompt did not provide.',
        ],
        validationChecks: [
          'Slide topic is visible at first glance.',
          'Visual hierarchy supports a presentation audience.',
          'Text areas remain readable and uncluttered.',
        ],
      };
    case 'creative-composite':
      return {
        taskType: 'other',
        style: 'controlled creative composite with coherent physics, scale, texture, and perspective',
        composition: 'clear multi-subject arrangement with explicit spatial relationships and a readable focal order',
        camera: 'consistent lens perspective across all combined elements',
        lighting: 'shared lighting direction, matching shadows, and unified color grade',
        background: 'environment that explains how the combined subjects belong together',
        materialDetails: 'consistent texture scale, contact shadows, reflections, and edge blending',
        textAndFacts: 'keep conceptual labels or diagrams exact when requested',
        negativeConstraints: [
          'Avoid mismatched scale, pasted edges, inconsistent shadows, and physically impossible overlaps.',
          'Avoid adding extra subjects that dilute the concept.',
        ],
        validationChecks: [
          'All subjects share one perspective and light source.',
          'Spatial relationships are understandable.',
          'The concept remains faithful to the raw prompt.',
        ],
      };
    case 'image-editing':
      return {
        taskType: 'other',
        style: 'precise image editing instruction with minimal unintended changes',
        composition: 'preserve the original composition unless the user explicitly requests reframing or outpainting',
        camera: 'match the source image perspective, lens feel, and depth of field',
        lighting: 'match the source image lighting direction, shadow softness, and color temperature',
        background: 'keep the source background stable unless it is the requested edit target',
        materialDetails: 'blend edits through matching texture, grain, edge quality, and reflections',
        textAndFacts: 'do not alter existing text unless explicitly requested; preserve factual visual evidence',
        negativeConstraints: [
          'Do not modify untouched regions, identity, logos, or composition outside the requested edit.',
          'Avoid visible masks, seams, halos, inconsistent grain, and lighting mismatch.',
        ],
        validationChecks: [
          'Requested edit is specific and localized.',
          'Unedited areas remain unchanged.',
          'Lighting, perspective, and texture match the source image.',
        ],
      };
    case 'interior-space':
      return {
        taskType: 'other',
        style: 'interior or architectural visualization with realistic spatial proportions and material finish',
        composition: 'room-scale framing with readable layout, circulation, and functional zones',
        camera: 'architectural lens language with straight verticals and believable field of view',
        lighting: 'natural daylight or designed interior lighting with physically plausible shadows',
        background: 'complete room context with walls, floor, ceiling, furniture, and decor held in proportion',
        materialDetails: 'accurate wood, stone, fabric, metal, glass, wall finish, and floor texture',
        textAndFacts: 'respect floor-plan constraints and avoid inventing structural changes when references are supplied',
        negativeConstraints: [
          'Avoid impossible room geometry, warped furniture, floating objects, and mismatched materials.',
          'Avoid changing the floor plan unless explicitly requested.',
        ],
        validationChecks: [
          'Spatial layout remains plausible.',
          'Materials and lighting feel physically consistent.',
          'Design changes match the requested room function.',
        ],
      };
    case 'social-marketing':
      return {
        taskType: 'infographic',
        style: 'high-impact social media or marketing visual with premium polish and clear conversion focus',
        composition: 'strong first-glance focal hierarchy with headline-safe space and platform-aware crop',
        camera: 'brand-appropriate visual language, either photographic or designed, with clear product or offer focus',
        lighting: 'punchy but controlled lighting and color contrast that remains readable on small screens',
        background: 'clean campaign backdrop with enough energy for social feeds without crowding the message',
        materialDetails: 'sharp product detail, clean typography zones, consistent brand color and asset treatment',
        textAndFacts: 'render campaign text exactly and keep claims concise, legible, and unsupported-claim free',
        negativeConstraints: [
          'Avoid unreadable headline text, generic ad clutter, exaggerated claims, and off-brand colors.',
          'Avoid cropping out the product, offer, or key visual on vertical/social formats.',
        ],
        validationChecks: [
          'The first-glance message is clear.',
          'Text and product remain readable in the target aspect ratio.',
          'Brand style stays consistent.',
        ],
      };
    case 'balanced':
    default:
      return {
        taskType: 'other',
        style: 'high-quality visual direction tailored to the original subject and intended use',
        composition: mode === 'ppt' ? slideComposition : 'clear focal hierarchy with balanced negative space and readable subject placement',
        camera: 'appropriate camera or layout perspective chosen to make the subject understandable',
        lighting: 'coherent lighting that supports realism, depth, and the intended mood',
        background: 'supportive background that adds context without competing with the main subject',
        materialDetails: 'realistic detail, clean edges, consistent texture, and polished finish where appropriate',
        textAndFacts: 'keep any requested text exact and treat factual diagrams or labels as accuracy-sensitive',
        negativeConstraints: [...DEFAULT_NEGATIVE_CONSTRAINTS],
        validationChecks: [...DEFAULT_VALIDATION_CHECKS],
      };
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

  return normalizeTextList([
    ...route.missingInputHints,
    ...genericMissingInputs,
  ], 4);
};

const buildReferenceRoleInstruction = (referenceImageCount: number): string => {
  if (referenceImageCount <= 0) {
    return 'Reference image roles: no reference images are attached; infer only the minimum missing details and do not invent a different concept.';
  }

  return [
    `Reference image roles: ${referenceImageCount} reference image${referenceImageCount > 1 ? 's' : ''} attached.`,
    'Use them to preserve subject identity, pose/composition cues, palette, material consistency, logos/text, and source-image lighting when relevant.',
    'Do not blindly copy unrelated artifacts from the references.',
  ].join(' ');
};

const summarizeEcommerceContext = (options?: PromptOptimizationRulebookOptions): string[] => {
  const context = options?.ecommerceContext;
  if (!context) return [];

  const task = context.taskState;
  const taskProduct = (task as { product?: { name?: string; category?: string } }).product;
  const outputLabel = context.outputTarget?.label || task.outputTypeLabel || '';
  const roleLabels = context.assetRoles.map((role) => role.normalizedLabel).filter(Boolean);
  const copy = [
    task.copy.headline,
    task.copy.highlight,
    task.copy.cta,
  ].map((item) => normalizeText(item)).filter(Boolean);

  return normalizeTextList([
    outputLabel ? `Ecommerce output target: ${outputLabel}` : '',
    task.sparseUserIntent ? `User selling intent: ${task.sparseUserIntent}` : '',
    taskProduct?.name ? `Product name: ${taskProduct.name}` : '',
    taskProduct?.category ? `Product category: ${taskProduct.category}` : '',
    task.style.effect ? `Series effect: ${task.style.effect}` : '',
    context.seriesTemplate.styleProfile.tone ? `Series tone: ${context.seriesTemplate.styleProfile.tone}` : '',
    roleLabels.length > 0 ? `Asset role bindings: ${roleLabels.join(', ')}` : '',
    copy.length > 0 ? `Copy to preserve: ${copy.join(' / ')}` : '',
    context.outputTarget?.aspectRatio ? `Delivery aspect ratio: ${context.outputTarget.aspectRatio}` : '',
    context.outputTarget?.imageSize ? `Delivery size: ${context.outputTarget.imageSize}` : '',
  ], 10);
};

const buildOptimizedPrompt = ({
  input,
  options,
  profile,
  routeTitle,
  routeInstruction,
  strategy,
}: {
  input: string;
  options?: PromptOptimizationRulebookOptions;
  profile: RulebookProfile;
  routeTitle: string;
  routeInstruction: string;
  strategy: PromptOptimizationStrategy;
}): string => {
  const referenceImageCount = options?.referenceImages?.length || 0;
  const ecommerceLines = summarizeEcommerceContext(options);
  const aspectRatio = options?.aspectRatio || options?.ecommerceContext?.outputTarget?.aspectRatio || '1:1';
  const imageSize = options?.imageSize || options?.ecommerceContext?.outputTarget?.imageSize || 'default';
  const strategyLine = strategy === 'reasoning-native'
    ? 'Prompt density: compact, goal-led, and constraint-rich for a model with native reasoning.'
    : 'Prompt density: explicit and structured so a non-reasoning model can follow every visual field directly.';

  return truncateText([
    `Original intent to preserve exactly: "${input}".`,
    `Local optimization route: ${routeTitle}.`,
    ecommerceLines.length > 0 ? `Structured ecommerce context to preserve: ${ecommerceLines.join(' | ')}.` : '',
    `Subject and action: keep the user's original subject, action, product names, domain terms, and professional wording intact.`,
    `Scene and background: ${profile.background}.`,
    `Composition and format: ${profile.composition}. Aspect ratio: ${aspectRatio}. Target size: ${imageSize}.`,
    `Style direction: ${profile.style}.`,
    `Camera or layout control: ${profile.camera}.`,
    `Lighting and color: ${profile.lighting}.`,
    `Materials and fine detail: ${profile.materialDetails}.`,
    `Text, labels, and factual constraints: ${profile.textAndFacts}.`,
    buildReferenceRoleInstruction(referenceImageCount),
    `Route guidance: ${truncateText(routeInstruction, 280)}.`,
    strategyLine,
    `Negative constraints: ${profile.negativeConstraints.concat(DEFAULT_NEGATIVE_CONSTRAINTS).slice(0, 5).join(' ')}`,
  ].filter(Boolean).join('\n'), strategy === 'reasoning-native' ? 1100 : 1400);
};

const buildOptimizedZh = (
  routeTitle: string,
  strategy: PromptOptimizationStrategy,
  referenceImageCount: number,
  hasEcommerceContext: boolean,
): string => {
  const strategyText = strategy === 'reasoning-native'
    ? '按“目标 + 关键约束 + 结果导向”压缩为精简结构。'
    : '按“主体/场景/构图/镜头/光线/材质/限制”展开为显式结构。';
  const referenceText = referenceImageCount > 0
    ? `已加入 ${referenceImageCount} 张参考图的职责说明。`
    : '未检测到参考图，已限制为保守补全。';
  const ecommerceText = hasEcommerceContext
    ? '已保留电商任务里的商品、卖点、尺寸和系列风格。'
    : '';

  return normalizeText([
    `本地规则已按「${routeTitle}」优化提示词，`,
    strategyText,
    referenceText,
    ecommerceText,
  ].filter(Boolean).join(' '));
};

export const resolvePromptOptimizationStrategy = (
  options?: PromptOptimizationRulebookOptions,
): PromptOptimizationStrategy => (
  options?.supportsThinking ? 'reasoning-native' : 'structure-first'
);

export const buildPromptOptimizerLocalRulebookResult = (
  rawPrompt: string,
  strategy: PromptOptimizationStrategy,
  options?: PromptOptimizationRulebookOptions,
): PromptOptimizerResult => {
  const input = normalizeText(rawPrompt);
  const route = resolveAutomaticOptimizationRoute(input, {
    mode: options?.mode,
    aspectRatio: options?.aspectRatio,
    referenceImageCount: options?.referenceImages?.length || 0,
  });
  const profile = getRulebookProfile(route.strategyId, options?.mode);
  const routeInstruction = buildAutomaticOptimizationInstruction(input, {
    mode: options?.mode,
    aspectRatio: options?.aspectRatio,
    referenceImageCount: options?.referenceImages?.length || 0,
  });
  const missingInputs = detectReadableMissingInputs(input, route, options?.mode);
  const ecommerceLines = summarizeEcommerceContext(options);
  const referenceImageCount = options?.referenceImages?.length || 0;
  const confidence: PromptOptimizerResult['confidence'] =
    missingInputs.length >= 3 ? 'low' : missingInputs.length > 0 ? 'medium' : 'high';

  return {
    raw_prompt_original: input,
    optimized_prompt_en: buildOptimizedPrompt({
      input,
      options,
      profile,
      routeTitle: route.strategyTitle,
      routeInstruction,
      strategy,
    }),
    optimized_prompt_zh_display: buildOptimizedZh(
      route.strategyTitle,
      strategy,
      referenceImageCount,
      ecommerceLines.length > 0,
    ),
    negative_constraints: normalizeTextList([
      ...profile.negativeConstraints,
      ...DEFAULT_NEGATIVE_CONSTRAINTS,
    ], 6),
    assumptions: normalizeTextList([
      `本地规则策略：${route.strategyTitle}`,
      strategy === 'reasoning-native'
        ? '目标模型支持思考，因此保留更紧凑的目标与约束。'
        : '目标模型未声明强思考能力，因此使用更显式的结构化提示词。',
      referenceImageCount > 0 ? '参考图用于身份、构图、材质、配色和文字职责，不作为无关元素来源。' : '',
      ecommerceLines.length > 0 ? '电商结构化上下文优先于泛化艺术描述。' : '',
    ], 5),
    validation_checks: normalizeTextList([
      ...profile.validationChecks,
      ...DEFAULT_VALIDATION_CHECKS,
    ], 7),
    missing_inputs: missingInputs,
    confidence,
    params: {
      task_type: profile.taskType,
      subject: input,
      style: profile.style,
      composition: profile.composition,
      lighting: profile.lighting,
      background: profile.background,
      materials: normalizeTextList(profile.materialDetails.split(/,\s*|、/g), 5),
      color_palette: [],
      aspect_ratio: options?.aspectRatio || options?.ecommerceContext?.outputTarget?.aspectRatio || '1:1',
    },
    ui_payload: {
      tabs: HUMAN_DEFAULT_TABS,
      default_tab: 'opt',
    },
    meta: {
      version: 'prompt-optimizer-local-rulebook-v1',
      timestamp: new Date().toISOString(),
      optimization_mode: 'auto',
      engine: 'local-rulebook',
      ai_status: 'skipped',
      route_id: route.strategyId,
      route_title: route.strategyTitle,
      strategy,
      validation_status: missingInputs.length > 0 ? 'needs-review' : 'ready',
    },
  };
};
