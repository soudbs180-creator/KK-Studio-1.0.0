/**
 * PPT 视觉一致性提示词生成与归一化模块
 * 
 * 资深架构师设计：移植并优化自 OpenTU 的大纲生成及提示词编译逻辑，
 * 用于在前端进行多版式提示词构建，提升生图一致性。
 */

export type PPTLayoutType =
  | 'cover'
  | 'toc'
  | 'title-body'
  | 'image-text'
  | 'comparison'
  | 'ending';

export interface PPTPageSpec {
  layout: PPTLayoutType;
  title: string;
  subtitle?: string;
  bullets?: string[];
  imagePrompt?: string;
  notes?: string;
}

export interface PPTStyleSpec {
  visualStyle: string;
  colorPalette: string;
  typography: string;
  layout: string;
  decorativeElements: string;
  avoid?: string;
}

export interface PPTOutline {
  title: string;
  styleSpec?: PPTStyleSpec;
  pages: PPTPageSpec[];
}

export interface PPTGenerateOptions {
  pageCount?: 'short' | 'normal' | 'long';
  language?: string;
  extraRequirements?: string;
  referenceImages?: string[];
}

const PAGE_COUNT_RANGES: Record<string, { min: number; max: number }> = {
  short: { min: 5, max: 7 },
  normal: { min: 8, max: 12 },
  long: { min: 13, max: 18 },
};

const LAYOUT_DESCRIPTIONS: Record<PPTLayoutType, string> = {
  cover: '封面页 - 用于PPT开头，包含主标题和副标题',
  toc: '目录页 - 展示PPT的章节结构',
  'title-body': '标题正文页 - 最常用的版式，标题 + 要点列表',
  'image-text': '图文页 - 同时包含文字信息和视觉表达',
  comparison: '对比页 - 左右对比两个概念或事物',
  ending: '结尾页 - 用于PPT结尾，包含感谢语或总结',
};

const LAYOUT_GUIDANCE: Record<PPTLayoutType, string> = {
  cover: '建立整套 PPT 的主视觉基调：一个强视觉锚点、少量大字标题、充足留白，避免信息堆叠。',
  toc: '使用清晰的章节导航结构：编号、分组线或轨道式布局，目录项节奏统一，并延续封面视觉母题。',
  'title-body': '使用稳定内容页版式：标题区、正文区、视觉锚点区明确分层，要点可转为卡片、标签或步骤块。',
  'image-text': '使用图文平衡版式：一侧承载视觉锚点，另一侧承载文字层级，两侧对齐到同一网格。',
  comparison: '使用左右或上下对比结构：两组信息尺寸、间距和组件样式对称，差异用同一强调色体系标注。',
  ending: '做收束页：回扣核心视觉母题，保留一个总结性视觉锚点和简洁行动/结束语，不新增新画画风。',
};

const STYLE_FIELD_TEXT_LIMIT = 480;
const STYLE_REQUIREMENT_TEXT_LIMIT = 280;

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function createDefaultPPTStyleSpec(options: PPTGenerateOptions = {}): PPTStyleSpec {
  const extraRequirements = options.extraRequirements?.trim()
    ? truncateText(options.extraRequirements.trim(), STYLE_REQUIREMENT_TEXT_LIMIT)
    : '';
  const visualStyle = extraRequirements
    ? `professional modern premium presentation design, incorporate this user style requirement consistently: ${extraRequirements}`
    : 'professional modern premium presentation design, clean keynote style, polished SaaS editorial look';

  return {
    visualStyle,
    colorPalette:
      'warm white or very light neutral background as 70% base, deep charcoal text, one consistent accent color as 10% highlight, muted supporting colors as 20% surfaces, no random palette changes',
    typography:
      'consistent geometric sans-serif, bold concise titles, clear body hierarchy, same font mood, size scale, and weight system on every slide',
    layout:
      'stable 16:9 grid, generous margins, repeated header/title rhythm, reusable cards/charts/content blocks, balanced whitespace, one clear visual anchor per slide',
    decorativeElements:
      'subtle geometric shapes, thin dividers, soft shadows, restrained icons, repeated visual motif and component style across slides',
    avoid:
      'do not switch art styles, do not change color families between slides, do not use mismatched fonts, do not create busy backgrounds',
  };
}

export function generateOutlineSystemPrompt(options: PPTGenerateOptions = {}): string {
  const { pageCount = 'normal', language = '中文' } = options;
  const range = PAGE_COUNT_RANGES[pageCount] || PAGE_COUNT_RANGES.normal;

  return `你是一位专业的PPT大纲设计师。请根据用户提供的主题，生成一份结构清晰、逻辑严密、内容丰富的PPT大纲。

## 输出要求
1. 输出格式：严格JSON，符合 PPTOutline 接口定义
2. 输出语言：所有文本内容使用${language}
3. 页数控制：${range.min}-${range.max}页（不含封面和结尾）
4. 必须以封面页(cover)开头，结尾页(ending)结尾

## 可用版式类型
${Object.entries(LAYOUT_DESCRIPTIONS)
  .map(([type, desc]) => `- ${type}: ${desc}`)
  .join('\n')}

## PPTOutline JSON Schema
\`\`\`typescript
interface PPTOutline {
  title: string;          // PPT总标题，只写演示主题，不要包含“PPT大纲/大纲”等任务标签
  styleSpec: PPTStyleSpec; // 整套PPT共用的全局风格规格
  pages: PPTPageSpec[];   // 所有页面
}

interface PPTStyleSpec {
  visualStyle: string;        // 整体视觉风格，具体且可复用
  colorPalette: string;       // 背景色、主色、辅助色、强调色等色板配置
  typography: string;         // 字体气质与层级规则
  layout: string;             // 16:9网格及布局要求
  decorativeElements: string; // 重复出现的装饰或视觉母题
  avoid?: string;             // 禁止事项
}

interface PPTPageSpec {
  layout: "cover" | "toc" | "title-body" | "image-text" | "comparison" | "ending";
  title: string;          // 页面标题（控制在10个中文字符以内，不要写“封面：”等结构标签）
  subtitle?: string;      // 副标题（cover/ending页使用）
  bullets?: string[];     // 页面要点：除 cover/ending 外必须提供，toc 为目录项
  imagePrompt?: string;   // 视觉概念描述（可选，英文）
  notes?: string;         // 演讲者备注（可选）
}
\`\`\`

## 全局风格规格规则
1. 必须生成 styleSpec，且所有页面都必须共享同一套 styleSpec
2. styleSpec 要具体到可执行的视觉规则，若额外要求中包含风格，必须融合进 styleSpec

## 页面要点硬性规则
1. 除 cover 和 ending 外，每一页都必须包含非空 bullets 数组
2. comparison 页必须填 6 个要点，前 3 个代表左侧，后 3 个代表右侧
3. 每个 bullet 必须是具体内容，10-24 个中文字符

请直接输出 JSON 对象。`;
}

export function generateOutlineUserPrompt(topic: string, options: PPTGenerateOptions = {}): string {
  const { extraRequirements } = options;
  let prompt = `请为以下主题生成PPT大纲：\n\n主题：${topic}`;
  if (extraRequirements) {
    prompt += `\n\n额外要求：${extraRequirements}`;
  }
  prompt += `\n\n请直接输出JSON格式的PPT大纲。`;
  return prompt;
}

export function formatPPTCommonPrompt(styleSpec: PPTStyleSpec, options: PPTGenerateOptions = {}): string {
  const { language = '中文' } = options;
  return `整套 PPT 公共提示词，所有页面都必须遵守：
- 输出必须是一整页幻灯片设计，不要只生成插画、背景图或局部元素。
- 文字语言：${language}
- 画面比例：16:9，留白合理。
- 所有页面必须严格遵守公共提示词，不得为单页另起一套画风、色板、字体。

## 全局风格规格
- 整体视觉风格：${styleSpec.visualStyle}
- 色板规则：${styleSpec.colorPalette}
- 字体规则：${styleSpec.typography}
- 布局规则：${styleSpec.layout}
- 装饰元素：${styleSpec.decorativeElements}
- 禁止事项：${styleSpec.avoid || '不得偏离上述全局风格规格'}`;
}

export function generateSlideImagePrompt(
  outline: Pick<PPTOutline, 'title' | 'pages' | 'styleSpec'>,
  page: PPTPageSpec,
  pageIndex: number,
  options: PPTGenerateOptions = {}
): string {
  const totalPages = outline.pages.length;
  const pageRole =
    page.layout === 'cover'
      ? '开场主视觉页'
      : page.layout === 'ending'
      ? '结束页'
      : page.layout === 'toc'
      ? '章节导航页'
      : `第 ${pageIndex} 页内容页`;
  
  const bullets = page.bullets?.map(normalizeInlineText).filter(Boolean) || [];
  const textContent = [
    page.title,
    page.subtitle,
    page.layout !== 'cover' && page.layout !== 'ending' ? bullets.join('；') : ''
  ].filter(Boolean).map(t => `- "${t}"`).join('\n');

  return `请生成一张完整的 16:9 PowerPoint 幻灯片图片，适合直接作为 PPT 第 ${pageIndex}/${totalPages} 页使用。

## 画面可见文字
${textContent}

## 设计参考信息
- 演示主题：${outline.title}
- 当前页用途：${pageRole}
- 版式参考：${page.layout}
- 版式指导：${LAYOUT_GUIDANCE[page.layout]}
- 视觉概念：${page.imagePrompt || '围绕内容安排主次关系'}

请只生成最终幻灯片画面。`;
}

function parseAndNormalizeOutline(jsonStr: string, options: PPTGenerateOptions): PPTOutline | null {
  const parsed = JSON.parse(jsonStr);
  
  const rawPages = Array.isArray(parsed.pages)
    ? parsed.pages
    : Array.isArray(parsed.slides)
    ? parsed.slides
    : null;

  if (!rawPages || rawPages.length === 0) return null;

  const title = parsed.title || parsed.topic || parsed.theme || 'PPT 大纲';
  const styleSpec = parsed.styleSpec || parsed.style || createDefaultPPTStyleSpec(options);

  const pages = rawPages.map((page: any, index: number): PPTPageSpec => {
    const pageTitle = page.title || `第 ${index + 1} 页`;
    const layout = page.layout || (index === 0 ? 'cover' : index === rawPages.length - 1 ? 'ending' : 'title-body');
    const bullets = Array.isArray(page.bullets) ? page.bullets : (Array.isArray(page.points) ? page.points : []);

    return {
      layout,
      title: pageTitle,
      subtitle: page.subtitle,
      bullets: bullets.map((b: any) => String(b).trim()).filter(Boolean),
      imagePrompt: page.imagePrompt || page.visualPrompt,
      notes: page.notes || page.speakerNotes,
    };
  });

  return { title, styleSpec, pages };
}

export function parseOutlineResponse(response: string, options: PPTGenerateOptions = {}): PPTOutline {
  let cleaned = response.trim();
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  try {
    const outline = parseAndNormalizeOutline(cleaned, options);
    if (outline) return outline;
  } catch (err) {
    // 尝试做基础的 JSON 修复 (替换尾部逗号等)
    try {
      const fixed = cleaned
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/(['"])?(\w+)(['"])?\s*:/g, '"$2":')
        .replace(/:\s*'([^']*)'/g, ':"$1"');
      const outline = parseAndNormalizeOutline(fixed, options);
      if (outline) return outline;
    } catch {}
  }

  throw new Error('PPT 大纲解析失败，模型未返回标准的 JSON 格式大纲。');
}
