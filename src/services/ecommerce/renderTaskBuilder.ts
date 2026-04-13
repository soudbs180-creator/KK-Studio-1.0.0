import type {
  EcommerceCopyTaskState,
  EcommerceEditableTaskState,
  EcommerceSeriesTemplate,
  EcommerceTaskAssetRoleBinding,
} from '../../types.ts';
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
  return `${roleLabel}：${binding.label}${note ? `（${note}）` : ''}`;
}

function buildAssetSummary(assetRoles: EcommerceTaskAssetRoleBinding[]): string {
  const ordered = [...assetRoles].sort((left, right) => {
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

function buildPrompt(params: {
  taskState: EcommerceEditableTaskState;
  seriesTemplate?: EcommerceSeriesTemplate;
  displayLabel: string;
  aspectRatio: EcommerceAspectRatio;
  imageSize: EcommerceImageSize;
  copy: EcommerceCopyTaskState;
  consistencyChecks: string[];
}): string {
  const styleTone = cleanText(params.taskState.style.tone || params.seriesTemplate?.styleProfile.tone);
  const atmosphere = cleanText(params.taskState.style.atmosphere || params.seriesTemplate?.styleProfile.atmosphere);
  const effect = cleanText(params.taskState.style.effect || params.seriesTemplate?.styleProfile.effectStyle);
  const background = cleanText(params.taskState.style.backgroundType || params.seriesTemplate?.styleProfile.backgroundStyle);

  return [
    `电商渲染任务：${params.displayLabel}`,
    `主题：${cleanText(params.taskState.theme || params.seriesTemplate?.templateLabel || '未命名主题')}`,
    `输出类型：${params.taskState.outputTypeLabel}`,
    `画幅：${params.aspectRatio}，尺寸：${params.imageSize}`,
    '',
    '素材角色：',
    buildAssetSummary(params.taskState.assetRoles),
    '',
    '文案要求：',
    `- 标题：${params.copy.headline || '无'}`,
    `- 副标题：${params.copy.subheadline || '无'}`,
    `- 高亮值：${params.copy.highlight || '无'}`,
    `- 卖点标签：${params.copy.featureTags.join(' / ') || '无'}`,
    '',
    '风格要求：',
    `- 色调：${styleTone || '保持清晰商业风格'}`,
    `- 氛围：${atmosphere || '干净明亮'}`,
    `- 效果：${effect || 'minimal'}`,
    `- 背景：${background || 'clean branded background'}`,
    '',
    '版式要求：',
    `- 产品尺寸：${params.taskState.layout.productSize}`,
    `- 文本位置：${params.taskState.layout.textPosition}`,
    `- 配件策略：${params.taskState.layout.accessoryPolicy}`,
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
      resolvedPromptPreview: prompt,
      displayLabel,
      imageRoleSummary: input.taskState.assetRoles.map((binding) => binding.normalizedLabel),
      lastRenderPrompt: prompt,
    },
  };
}
