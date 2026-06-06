type PromptOptimizerMode = 'image' | 'ppt' | string | undefined;

export type PromptOptimizerArchetypeId =
  | 'balanced'
  | 'product-hero'
  | 'portrait-photo'
  | 'cinematic-scene'
  | 'ui-infographic'
  | 'ppt-narrative'
  | 'creative-composite'
  | 'image-editing'
  | 'interior-space'
  | 'social-marketing';

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
  preferredArchetypeId?: string; // 🎯 [New] 手动选择场景模式
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
  'portrait-photo': {
    strategyId: 'portrait-photo',
    strategyTitle: '人像摄影',
    taskType: 'lifestyle_photo',
    missingInputHints: ['人物身份', '表情姿态', '服装造型', '背景与光线'],
    instruction:
      'Optimize for realistic portrait or headshot imagery with preserved identity, flattering framing, believable skin texture, eye focus, and coherent wardrobe/background styling.',
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
  'creative-composite': {
    strategyId: 'creative-composite',
    strategyTitle: '创意合成',
    taskType: 'other',
    missingInputHints: ['合成主体', '空间关系', '统一光源', '材质衔接'],
    instruction:
      'Optimize for controlled creative compositing with clear subject relationships, consistent scale, unified perspective, matching light direction, and believable edge/material blending.',
  },
  'image-editing': {
    strategyId: 'image-editing',
    strategyTitle: '图片编辑修复',
    taskType: 'other',
    missingInputHints: ['编辑目标', '保留区域', '替换内容', '边缘与光影'],
    instruction:
      'Optimize for precise image editing by naming the edit target, preserving untouched regions, matching source perspective, matching lighting, and avoiding visible seams or unintended changes.',
  },
  'interior-space': {
    strategyId: 'interior-space',
    strategyTitle: '室内空间',
    taskType: 'other',
    missingInputHints: ['空间类型', '功能分区', '材质风格', '光照条件'],
    instruction:
      'Optimize for interior and architectural visualization with plausible room geometry, readable layout, realistic materials, straight verticals, and coherent natural or designed lighting.',
  },
  'social-marketing': {
    strategyId: 'social-marketing',
    strategyTitle: '社媒营销',
    taskType: 'infographic',
    missingInputHints: ['平台画幅', '主标题', '产品/卖点', '品牌风格'],
    instruction:
      'Optimize for social covers, posters, and marketing visuals with first-glance hierarchy, headline-safe spacing, platform-aware crop, brand consistency, and legible campaign text.',
  },
};

const PRODUCT_PATTERN =
  /(product|packshot|hero|listing|amazon|商品|产品|耳机|手机|香水|电商|主图|包装|瓶子|鞋|手表|口红|A\+)/i;
const UI_PATTERN =
  /(ui|dashboard|data board|b2b saas|看板|海报|版式|信息图|infographic|layout|landing page|app|web|界面|数据看板|卡片设计)/i;
const PORTRAIT_PATTERN =
  /(portrait|headshot|profile photo|selfie|avatar|face|person|model|人像|头像|自拍|证件照|商务照|人物|模特|脸部)/i;
const CINEMATIC_PATTERN =
  /(film|cinematic|travel|street|lifestyle|storytelling|写实|摄影|电影感|街拍|旅拍|生活方式)/i;
const EDITING_PATTERN =
  /(remove|replace|restore|repair|outpaint|inpaint|reframe|upscale|edit|background replacement|修复|移除|去除|替换|扩图|重绘|局部重绘|背景替换|抠图|擦除)/i;
const INTERIOR_PATTERN =
  /(interior|room|living room|bedroom|kitchen|floor plan|architecture|furnishing|家装|室内|客厅|卧室|厨房|户型|平面图|软装|硬装|空间设计)/i;
const SOCIAL_PATTERN =
  /(youtube|douyin|tiktok|instagram|cover|thumbnail|poster|campaign|promotion|banner|小红书|抖音|社媒|封面|营销|促销|活动海报|横幅|主视觉)/i;
const CREATIVE_PATTERN =
  /(composite|blend|merge|diorama|isometric|miniature|surreal|recursive|emoji|3d render|合成|融合|拼接|微缩|等距|立体|超现实|创意实验|概念可视化)/i;

export function inferPromptOptimizationArchetype(
  rawPrompt: string,
  mode: PromptOptimizerMode = 'image',
): PromptOptimizerArchetypeId {
  const normalizedMode = String(mode || '').toLowerCase();
  const normalizedPrompt = String(rawPrompt || '').trim().toLowerCase();

  if (normalizedMode === 'ppt') {
    return 'ppt-narrative';
  }
  if (EDITING_PATTERN.test(normalizedPrompt) || /redraw|inpaint|outpaint|edit/.test(normalizedMode)) {
    return 'image-editing';
  }
  if (PRODUCT_PATTERN.test(normalizedPrompt) || normalizedMode === 'ecommerce') {
    return 'product-hero';
  }
  if (UI_PATTERN.test(normalizedPrompt)) {
    return 'ui-infographic';
  }
  if (INTERIOR_PATTERN.test(normalizedPrompt)) {
    return 'interior-space';
  }
  if (SOCIAL_PATTERN.test(normalizedPrompt)) {
    return 'social-marketing';
  }
  if (CREATIVE_PATTERN.test(normalizedPrompt)) {
    return 'creative-composite';
  }
  if (PORTRAIT_PATTERN.test(normalizedPrompt)) {
    return 'portrait-photo';
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
  const archetypeId = (options?.preferredArchetypeId && options.preferredArchetypeId !== 'auto')
    ? (options.preferredArchetypeId as PromptOptimizerArchetypeId)
    : inferPromptOptimizationArchetype(rawPrompt, options?.mode);
  return ROUTES[archetypeId] || ROUTES.balanced;
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
