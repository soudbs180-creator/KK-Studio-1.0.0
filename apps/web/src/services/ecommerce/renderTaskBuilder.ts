import type {
  EcommerceCopyTaskState,
  EcommerceEditableTaskState,
  EcommerceReferenceAnchor,
  EcommerceSeriesTemplate,
  EcommerceTaskAssetRoleBinding,
} from '../../types';
import { resolveEcommerceCopy } from './copyResolver.ts';

type EcommerceAspectRatio = 'auto' | '1:1' | '3:4' | '4:3' | '16:9' | '21:9' | (string & {});
type EcommerceImageSize = '0.5K' | '1K' | '2K' | '4K' | (string & {});

export interface BuildEcommerceRenderTaskInput {
  taskState: EcommerceEditableTaskState;
  seriesTemplate?: EcommerceSeriesTemplate;
  aspectRatio: EcommerceAspectRatio;
  imageSize: EcommerceImageSize;
  productName?: string;
}

export interface EcommerceRenderTask {
  taskId: string;
  templateId?: string;
  prompt: string;
  displayLabel: string;
  aspectRatio: EcommerceAspectRatio;
  imageSize: EcommerceImageSize;
  copy: EcommerceCopyTaskState;
  assetRoles: EcommerceTaskAssetRoleBinding[];
  consistencyChecks: string[];
  missingFields: string[];
  taskState: EcommerceEditableTaskState;
}

function cleanText(value: string | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = cleanText(value);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function normalizeReferenceToken(value: string | undefined): string {
  const text = cleanText(value);
  if (!text) return '';
  return text.startsWith('@') ? text : `@${text}`;
}

function isGenericNumberedImageLabel(value: string | undefined): boolean {
  return /^(?:图|图片|参考图|产品图|补充参考图|手动参考图)\s*\d+$/i.test(cleanText(value));
}

function resolveAnchorDisplayLabel(binding: EcommerceTaskAssetRoleBinding): string {
  if (binding.roleLabel && isGenericNumberedImageLabel(binding.label)) {
    return binding.roleLabel;
  }

  return cleanText(binding.normalizedLabel || binding.label || binding.roleLabel || binding.token || '参考素材');
}

function inferAnchorRoleLabel(binding: EcommerceTaskAssetRoleBinding): string {
  if (binding.roleLabel) return binding.roleLabel;
  const combinedText = [
    binding.label,
    binding.normalizedLabel,
    binding.note,
    ...(binding.mentionTokens || []),
  ].join(' ');

  if (binding.role === 'product') return '产品主图';
  if (binding.role === 'series-template') return '系列风格参考';
  if (/风格|色调|配色|光影|氛围|质感|style|tone|palette/i.test(combinedText)) return '风格参考';
  if (/版式|构图|排版|布局|layout|composition/i.test(combinedText)) return '版式参考';
  if (/场景|背景|环境|scene|background/i.test(combinedText)) return '场景参考';
  if (/文案|文字|copy|text/i.test(combinedText)) return '文案参考';
  if (binding.role === 'extra-reference') return '风格参考';
  if (binding.source === 'upload') return '任务参考';
  return '需求参考';
}

function buildAnchorTokenSuffix(value: string): string {
  const normalized = cleanText(value)
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 10 ? normalized.slice(-10) : normalized || 'ref';
}

function buildReferenceAnchors(assetRoles: EcommerceTaskAssetRoleBinding[]): EcommerceReferenceAnchor[] {
  const drafts: Array<{
    binding: EcommerceTaskAssetRoleBinding;
    anchorId: string;
    roleLabel: string;
    baseToken: string;
  }> = [];
  const seen = new Set<string>();

  for (const binding of assetRoles) {
    const roleLabel = inferAnchorRoleLabel(binding);
    const baseToken = normalizeReferenceToken(
      binding.token
        || (!isGenericNumberedImageLabel(binding.aliasLabel) ? binding.aliasLabel : '')
        || roleLabel,
    );
    const anchorId = binding.anchorId || `${binding.role}:${binding.assetId}`;
    if (!baseToken || seen.has(anchorId)) continue;
    seen.add(anchorId);
    drafts.push({ binding, anchorId, roleLabel, baseToken });
  }

  const tokenCounts = drafts.reduce<Record<string, number>>((counts, draft) => {
    counts[draft.baseToken] = (counts[draft.baseToken] || 0) + 1;
    return counts;
  }, {});

  return drafts.map(({ binding, anchorId, roleLabel, baseToken }) => ({
    anchorId,
    token: tokenCounts[baseToken] > 1
      ? `${baseToken}-${buildAnchorTokenSuffix(binding.assetId || binding.label)}`
      : baseToken,
    roleLabel,
    assetId: binding.assetId,
    label: resolveAnchorDisplayLabel(binding),
    source: binding.source,
    assetRole: binding.role,
    note: binding.note,
  }));
}

function resolveStyleAnchorTokens(
  anchors: EcommerceReferenceAnchor[],
  taskState: EcommerceEditableTaskState,
): string[] {
  const explicitTokens = (taskState.styleAnchorTokens || []).map(normalizeReferenceToken).filter(Boolean);
  if (explicitTokens.length > 0) {
    return Array.from(new Set(explicitTokens));
  }

  const preferred = anchors.filter((anchor) => (
    anchor.assetRole !== 'product'
    && /风格|版式|场景|系列|参考/.test(anchor.roleLabel)
  ));
  const fallback = preferred.length > 0
    ? preferred
    : anchors.filter((anchor) => anchor.assetRole !== 'product');

  return Array.from(new Set(fallback.map((anchor) => anchor.token)));
}

function resolveAnchorRoleInstruction(anchor: EcommerceReferenceAnchor): string {
  if (anchor.assetRole === 'product') {
    return '锁定产品身份、外观、材质、比例和关键结构，不能替换产品。';
  }
  if (/风格|系列/.test(anchor.roleLabel)) {
    return '只提取色调、光影、质感、版式气质和商业氛围，不照抄无关物体。';
  }
  if (/版式|构图/.test(anchor.roleLabel)) {
    return '只参考构图、排版层级、留白和视觉节奏。';
  }
  if (/场景|背景/.test(anchor.roleLabel)) {
    return '只参考场景方向、背景氛围和空间关系。';
  }
  if (/文案/.test(anchor.roleLabel)) {
    return '只参考文字层级、信息密度和商业表达方式。';
  }
  return '按当前任务需求提取有用信息，不复制无关元素。';
}

function formatRoleLine(binding: EcommerceTaskAssetRoleBinding): string {
  const roleLabelMap: Record<EcommerceTaskAssetRoleBinding['role'], string> = {
    product: '产品图',
    reference: '参考图',
    'extra-reference': '补充参考图',
    'series-template': '系列模板图',
    accessory: '配件图',
  };

  const roleLabel = roleLabelMap[binding.role] || binding.role;
  const note = cleanText(binding.note || '');
  const roleName = inferAnchorRoleLabel(binding);
  const token = normalizeReferenceToken(
    binding.token
      || (!isGenericNumberedImageLabel(binding.aliasLabel) ? binding.aliasLabel : '')
      || binding.roleLabel
      || roleName,
  );
  const displayLabel = isGenericNumberedImageLabel(binding.label)
    ? roleName
    : resolveAnchorDisplayLabel(binding);
  return `${roleLabel}：${token || roleName} - ${displayLabel}${note ? `（${note}）` : ''}`;
}

function buildAssetSummary(assetRoles: EcommerceTaskAssetRoleBinding[]): string {
  const ordered = [...assetRoles].sort((left, right) => {
    const parseAliasOrder = (binding: EcommerceTaskAssetRoleBinding): number | null => {
      const match = cleanText(binding.aliasLabel || '').match(/^图(\d+)$/);
      return match ? Number(match[1]) : null;
    };
    const leftAliasOrder = parseAliasOrder(left);
    const rightAliasOrder = parseAliasOrder(right);
    if (leftAliasOrder !== null && rightAliasOrder !== null) {
      return leftAliasOrder - rightAliasOrder;
    }

    const rank = (role: EcommerceTaskAssetRoleBinding['role']): number => {
      switch (role) {
        case 'product':
          return 0;
        case 'reference':
          return 1;
        case 'extra-reference':
          return 2;
        case 'series-template':
          return 3;
        case 'accessory':
          return 4;
        default:
          return 5;
      }
    };

    return rank(left.role) - rank(right.role);
  });

  return ordered.map((binding) => `- ${formatRoleLine(binding)}`).join('\n');
}

function buildConsistencyChecks(
  taskState: EcommerceEditableTaskState,
  seriesTemplate?: EcommerceSeriesTemplate,
): string[] {
  return uniqueStrings([
    ...taskState.consistencyChecks,
    taskState.inherit.keepSeriesStyle ? '保持系列风格一致' : '',
    taskState.inherit.keepFontStyle ? '保持字体风格一致' : '',
    taskState.inherit.keepLayoutStyle ? '保持版式风格一致' : '',
    taskState.inherit.keepCopyStyle ? '保持文案调性一致' : '',
    taskState.inherit.keepPalette ? '保持主色调连续性' : '',
    seriesTemplate?.constraints.mustKeepProductRealistic ? '产品主体必须真实可信' : '',
    seriesTemplate?.constraints.mustKeepConsistency ? '整套图需保持统一的系列识别度' : '',
    ...(seriesTemplate?.constraints.forbiddenElements || []).map((item) => `避免出现 ${item}`),
  ]);
}

function buildStyleAnchorLines(params: {
  anchors: EcommerceReferenceAnchor[];
  styleAnchorTokens: string[];
  seriesTemplate?: EcommerceSeriesTemplate;
}): string[] {
  const styleAnchors = params.anchors.filter((anchor) => params.styleAnchorTokens.includes(anchor.token));
  if (styleAnchors.length > 0) {
    return [
      `- 风格锚点：${styleAnchors.map((anchor) => `${anchor.token}（${anchor.roleLabel}）`).join(' / ')}`,
      '- 整组图片必须从这些锚点提取统一的色调、光影、质感、留白、排版节奏和商业氛围。',
      '- 产品身份始终由产品锚点决定，风格参考不能覆盖产品本身。',
    ];
  }

  const style = params.seriesTemplate?.styleProfile;
  return [
    '- 风格锚点：未提供专门风格参考图，按需求单和系列模板自动分析。',
    `- 自动风格：${cleanText(style?.tone) || '清晰商业风格'}，${cleanText(style?.backgroundStyle) || '干净背景'}，${cleanText(style?.effectStyle) || '克制商业效果'}。`,
  ];
}

function buildReferenceRoleTable(anchors: EcommerceReferenceAnchor[]): string[] {
  if (anchors.length === 0) {
    return ['- 当前任务没有绑定参考图，只能按需求单保守补全，不要虚构产品或无关场景。'];
  }

  return anchors.map((anchor) => (
    `- ${anchor.token}：${anchor.roleLabel}，${resolveAnchorRoleInstruction(anchor)}`
  ));
}

function resolveBusinessSizeTier(taskState: EcommerceEditableTaskState) {
  return taskState.effectiveSizeTier || taskState.sizeTier;
}

function buildBusinessSizeLines(taskState: EcommerceEditableTaskState): string[] {
  const declaredSizeText = cleanText(taskState.declaredSizeText || '');
  const businessSizeTier = resolveBusinessSizeTier(taskState);

  if (taskState.sourceKind !== 'a-plus-module') {
    return declaredSizeText ? [`- Business size: ${declaredSizeText}`] : [];
  }

  if (businessSizeTier === '1464x600') {
    return [
      `- Business size: ${declaredSizeText || '1464*600'}`,
      '- Delivery flow: stage the desktop master first and preserve safe composition room for a later 600*450 mobile version.',
      '- Layout rule: keep the same product focus, copy hierarchy, and brand atmosphere after mobile compaction.',
    ];
  }

  if (businessSizeTier === '970x600') {
    return [
      '- Business size: 970*600',
      '- Delivery flow: output a single desktop/mobile shared composition without a separate mobile conversion step.',
    ];
  }

  if (businessSizeTier === '600x450') {
    return [
      '- Business size: 600*450',
      '- Delivery flow: the final composition is 600*450 and should stay compact and visually consistent with the desktop master logic.',
    ];
  }

  return declaredSizeText
    ? [`- Business size: ${declaredSizeText}`]
    : [];
}

function buildPrompt(params: {
  taskState: EcommerceEditableTaskState;
  seriesTemplate?: EcommerceSeriesTemplate;
  displayLabel: string;
  aspectRatio: EcommerceAspectRatio;
  imageSize: EcommerceImageSize;
  copy: EcommerceCopyTaskState;
  consistencyChecks: string[];
  referenceAnchors: EcommerceReferenceAnchor[];
  styleAnchorTokens: string[];
  productName?: string;
}): string {
  const promptOverride = cleanText(params.taskState.promptOverride || '');
  if (promptOverride) {
    return promptOverride;
  }

  const styleTone = cleanText(params.taskState.style.tone || params.seriesTemplate?.styleProfile.tone);
  const atmosphere = cleanText(params.taskState.style.atmosphere || params.seriesTemplate?.styleProfile.atmosphere);
  const effect = cleanText(params.taskState.style.effect || params.seriesTemplate?.styleProfile.effectStyle);
  const background = cleanText(params.taskState.style.backgroundType || params.seriesTemplate?.styleProfile.backgroundStyle);
  const primaryProductAsset = params.taskState.assetRoles.find((binding) => binding.role === 'product');
  const primaryProductAnchor = params.referenceAnchors.find((anchor) => anchor.assetRole === 'product');
  const primaryProductLabel = cleanText(
    primaryProductAnchor
      ? `${primaryProductAnchor.token}（${primaryProductAnchor.roleLabel}）`
      : primaryProductAsset?.token
      ? `${primaryProductAsset.token}（${isGenericNumberedImageLabel(primaryProductAsset.label) ? inferAnchorRoleLabel(primaryProductAsset) : resolveAnchorDisplayLabel(primaryProductAsset)}）`
      : (primaryProductAsset?.label || params.productName || '上传的产品图'),
  );
  const sparseUserIntent = cleanText(params.taskState.sparseUserIntent);
  const styleAnchorLines = buildStyleAnchorLines({
    anchors: params.referenceAnchors,
    styleAnchorTokens: params.styleAnchorTokens,
    seriesTemplate: params.seriesTemplate,
  });

  return [
    `电商渲染任务：${params.displayLabel}`,
    `主题：${cleanText(params.taskState.theme || params.seriesTemplate?.templateLabel || '未命名主题')}`,
    `输出类型：${params.taskState.outputTypeLabel}`,
    `画幅：${params.aspectRatio}，尺寸：${params.imageSize}`,
    '',
    '系列风格锚点：',
    ...styleAnchorLines,
    '',
    '本张任务目标：',
    `- 优先展示：${primaryProductLabel}`,
    `- 任务说明：${sparseUserIntent || '按照需求单与当前任务字段执行，不擅自扩展画面元素。'}`,
    '- 保持产品主体真实清晰，不能替换成其他产品或错误品类。',
    '',
    '参考图职责表：',
    ...buildReferenceRoleTable(params.referenceAnchors),
    '',
    '素材清单：',
    buildAssetSummary(params.taskState.assetRoles),
    '',
    '背景与需求：',
    `- 背景：${background || 'clean branded background'}`,
    `- 氛围：${atmosphere || '干净明亮'}`,
    '',
    '文案要求：',
    `- 标题：${params.copy.headline || '无'}`,
    `- 副标题：${params.copy.subheadline || '无'}`,
    `- 高亮值：${params.copy.highlight || '无'}`,
    `- 卖点标签：${params.copy.featureTags.join(' / ') || '无'}`,
    '',
    '风格要求：',
    `- 色调：${styleTone || '保持清晰商业风格'}`,
    `- 效果：${effect || 'minimal'}`,
    `- 统一性：${params.taskState.inherit.keepSeriesStyle ? '延续同系列视觉语言' : '允许按当前任务重新建立风格'}`,
    '',
    '版式要求：',
    `- 产品尺寸：${params.taskState.layout.productSize}`,
    `- 文本位置：${params.taskState.layout.textPosition}`,
    `- 配件策略：${params.taskState.layout.accessoryPolicy}`,
    ...(
      buildBusinessSizeLines(params.taskState).length > 0
        ? [
            '',
            '业务尺寸要求：',
            ...buildBusinessSizeLines(params.taskState),
          ]
        : []
    ),
    '',
    '硬性约束：',
    '- 不要把不同参考图的职责混淆；只按 @token 对应的职责使用参考图。',
    '- 不要更换产品、不要改变产品真实结构、不要把参考图里的无关物体搬进画面。',
    '- 文案内容必须保持用户或需求单提供的信息，不要发明无法验证的参数。',
    '- 整组图片保持统一色调、字体气质、版式密度和商业质感。',
    '',
    '一致性检查：',
    ...params.consistencyChecks.map((item) => `- ${item}`),
  ].join('\n').trim();
}

export function buildEcommerceDisplayLabel(
  outputTypeLabel: string,
  aspectRatio: EcommerceAspectRatio,
  imageSize: EcommerceImageSize,
): string {
  return [outputTypeLabel, aspectRatio, imageSize]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(' ');
}

export function buildEcommerceRenderTask(input: BuildEcommerceRenderTaskInput): EcommerceRenderTask {
  const referenceAnchors = buildReferenceAnchors(input.taskState.assetRoles);
  const styleAnchorTokens = resolveStyleAnchorTokens(referenceAnchors, input.taskState);
  const copy = resolveEcommerceCopy({
    taskState: input.taskState,
    seriesTemplate: input.seriesTemplate,
    productName: input.productName,
  });
  const displayLabel = buildEcommerceDisplayLabel(input.taskState.outputTypeLabel, input.aspectRatio, input.imageSize);
  const consistencyChecks = buildConsistencyChecks(input.taskState, input.seriesTemplate);
  const missingFields = input.taskState.assetRoles.some((binding) => binding.role === 'product')
    ? input.taskState.missingFields
    : [...input.taskState.missingFields, '缺少产品图'];
  const prompt = buildPrompt({
    taskState: input.taskState,
    seriesTemplate: input.seriesTemplate,
    displayLabel,
    aspectRatio: input.aspectRatio,
    imageSize: input.imageSize,
    copy,
    consistencyChecks,
    referenceAnchors,
    styleAnchorTokens,
    productName: input.productName,
  });

  return {
    taskId: input.taskState.taskId,
    templateId: input.taskState.templateId || input.seriesTemplate?.templateId,
    prompt,
    displayLabel,
    aspectRatio: input.aspectRatio,
    imageSize: input.imageSize,
    copy,
    assetRoles: input.taskState.assetRoles.map((binding) => ({ ...binding })),
    consistencyChecks,
    missingFields,
    taskState: {
      ...input.taskState,
      copy,
      consistencyChecks,
      missingFields,
      referenceAnchors,
      styleAnchorTokens,
      resolvedPromptPreview: prompt,
      displayLabel,
      imageRoleSummary: input.taskState.assetRoles.map((binding) => binding.normalizedLabel),
      lastRenderPrompt: prompt,
      revision: (input.taskState.revision || 0) + (prompt !== input.taskState.lastRenderPrompt ? 1 : 0),
    },
  };
}
