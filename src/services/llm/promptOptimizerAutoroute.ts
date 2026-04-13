type PromptOptimizerMode = 'image' | 'ppt' | string | undefined;

export type PromptOptimizerArchetypeId =
  | 'balanced'
  | 'product-hero'
  | 'cinematic-scene'
  | 'ui-infographic'
  | 'ppt-narrative';

type PromptOptimizerTaskType =
  | 'ecommerce_hero'
  | 'lifestyle_photo'
  | 'ui'
  | 'infographic'
  | 'other';

type PromptOptimizerAutorouteInput = {
  mode?: PromptOptimizerMode;
  aspectRatio?: string;
  referenceImageCount?: number;
};

export type PromptOptimizerAutorouteDecision = {
  strategyId: PromptOptimizerArchetypeId;
  strategyTitle: string;
  taskType: PromptOptimizerTaskType;
  missingInputHints: string[];
  instruction: string;
};

const ROUTES: Record<PromptOptimizerArchetypeId, PromptOptimizerAutorouteDecision> = {
  balanced: {
    strategyId: 'balanced',
    strategyTitle: '通用增强',
    taskType: 'other',
    missingInputHints: ['核心主体', '风格方向', '光线氛围', '构图重点'],
    instruction:
      'Clarify the core subject, style, lighting, and composition while preserving the user intent. Fill only the minimum missing details needed for a strong result.',
  },
  'product-hero': {
    strategyId: 'product-hero',
    strategyTitle: '电商主图',
    taskType: 'ecommerce_hero',
    missingInputHints: ['产品主体', '卖点焦点', '拍摄角度', '背景与材质'],
    instruction:
      'Optimize for premium ecommerce hero imagery with clear product separation, clean staging, studio lighting, material realism, and copy-safe composition.',
  },
  'cinematic-scene': {
    strategyId: 'cinematic-scene',
    strategyTitle: '电影感场景',
    taskType: 'lifestyle_photo',
    missingInputHints: ['主体身份', '场景环境', '情绪氛围', '镜头语言'],
    instruction:
      'Optimize for cinematic storytelling with subject identity, environment, mood, lens language, believable depth, and coherent lighting.',
  },
  'ui-infographic': {
    strategyId: 'ui-infographic',
    strategyTitle: '界面与版式',
    taskType: 'ui',
    missingInputHints: ['界面类型', '信息层级', '配色风格', '展示场景'],
    instruction:
      'Optimize for interface, dashboard, infographic, or editorial layouts with strong hierarchy, grid discipline, text-safe spacing, and restrained visual noise.',
  },
  'ppt-narrative': {
    strategyId: 'ppt-narrative',
    strategyTitle: 'PPT 叙事',
    taskType: 'infographic',
    missingInputHints: ['页面主题', '版式层级', '主视觉', '配色方向'],
    instruction:
      'Optimize for slide-ready visuals with deck consistency, presentation-safe hierarchy, uncluttered composition, and strong focal grouping.',
  },
};

const PRODUCT_PATTERN =
  /(product|packshot|hero|listing|amazon|商品|产品|耳机|手机|香水|电商|主图|包装|瓶子|鞋|手表|口红|A\+)/i;
const UI_PATTERN =
  /(ui|dashboard|data board|b2b saas|看板|海报|版式|信息图|infographic|layout|landing page|app|web|界面|数据看板|卡片设计)/i;
const CINEMATIC_PATTERN =
  /(portrait|photo|photography|film|cinematic|travel|street|lifestyle|写实|摄影|电影感|人像|街拍|旅拍)/i;

export function inferPromptOptimizationArchetype(
  rawPrompt: string,
  mode: PromptOptimizerMode = 'image',
): PromptOptimizerArchetypeId {
  const normalizedMode = String(mode || '').toLowerCase();
  const normalizedPrompt = String(rawPrompt || '').trim().toLowerCase();

  if (normalizedMode === 'ppt') {
    return 'ppt-narrative';
  }
  if (PRODUCT_PATTERN.test(normalizedPrompt) || normalizedMode === 'ecommerce') {
    return 'product-hero';
  }
  if (UI_PATTERN.test(normalizedPrompt)) {
    return 'ui-infographic';
  }
  if (CINEMATIC_PATTERN.test(normalizedPrompt)) {
    return 'cinematic-scene';
  }
  return 'balanced';
}

export function resolveAutomaticOptimizationRoute(
  rawPrompt: string,
  options?: PromptOptimizerAutorouteInput,
): PromptOptimizerAutorouteDecision {
  const archetypeId = inferPromptOptimizationArchetype(rawPrompt, options?.mode);
  return ROUTES[archetypeId];
}

export function buildAutomaticOptimizationInstruction(
  rawPrompt: string,
  options?: PromptOptimizerAutorouteInput,
): string {
  const route = resolveAutomaticOptimizationRoute(rawPrompt, options);
  const ratio = options?.aspectRatio || '1:1';
  const lines = [
    `Automatic optimization archetype: ${route.strategyTitle}.`,
    route.instruction,
    `Missing slot priority: ${route.missingInputHints.join(', ')}.`,
    `Target aspect ratio: ${ratio}.`,
  ];

  if ((options?.referenceImageCount || 0) > 0) {
    lines.push(
      'Reference image priority: preserve subject identity, palette, composition cues, and material consistency from the attached reference images.',
    );
  } else {
    lines.push('No reference images are attached, so infer only the minimum missing details.');
  }

  if (String(rawPrompt || '').trim().length < 18) {
    lines.push(
      'The raw prompt is brief, so expand it conservatively around the missing slot priority instead of inventing a new concept.',
    );
  }

  return lines.join(' ');
}
