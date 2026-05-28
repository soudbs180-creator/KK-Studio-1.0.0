import { AspectRatio, ImageSize, type RedrawColorBlock, type RedrawCropPlan, type RedrawPlan, type RedrawPlanMode, type RedrawRegion, type NormalizedRect, type ModelType } from '../../types.ts';

type PixelSize = { width: number; height: number };

export const REDRAW_REGION_PADDING_RATIO = 0.05;
export const REDRAW_LOCAL_REGION_LIMIT = 3;
export const NANO_BANANA_2_MODEL_ID = 'gemini-3.1-flash-image-preview';
export const NANO_BANANA_PRO_MODEL_ID = 'gemini-3-pro-image-preview';

const REDRAW_LOCAL_MODELS = new Set([
  NANO_BANANA_2_MODEL_ID,
  NANO_BANANA_PRO_MODEL_ID,
  'nano-banana-2',
  'nano banana 2',
  'nano-banana-pro',
  'nano banana pro',
  'image_nanobanana2',
  'image_nanobanana_pro',
]);

const SIZE_ORDER: ImageSize[] = [
  ImageSize.SIZE_05K,
  ImageSize.SIZE_1K,
  ImageSize.SIZE_2K,
  ImageSize.SIZE_4K,
];

const SIZE_DESC: ImageSize[] = [
  ImageSize.SIZE_4K,
  ImageSize.SIZE_2K,
  ImageSize.SIZE_1K,
  ImageSize.SIZE_05K,
];

const COLOR_NAMES: Record<string, string> = {
  '#ef4444': '红色',
  '#f97316': '橙色',
  '#eab308': '黄色',
  '#22c55e': '绿色',
  '#3b82f6': '蓝色',
  '#a855f7': '紫色',
};

function cleanRatioNumber(value: number): number {
  return Number(value.toFixed(12));
}

function normalizeColor(value: string): string {
  return value.trim().toLowerCase();
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampRedrawRect(rect: NormalizedRect): NormalizedRect {
  const width = clampUnit(rect.width);
  const height = clampUnit(rect.height);
  return {
    x: Math.min(1 - width, Math.max(0, rect.x)),
    y: Math.min(1 - height, Math.max(0, rect.y)),
    width,
    height,
  };
}

export function normalizeRedrawModelId(modelId: string): ModelType {
  const normalized = modelId.trim().toLowerCase();
  if (normalized === 'nano banana 2' || normalized === 'nano-banana-2' || normalized === 'image_nanobanana2') {
    return NANO_BANANA_2_MODEL_ID;
  }
  if (normalized === 'nano banana pro' || normalized === 'nano-banana-pro' || normalized === 'image_nanobanana_pro') {
    return NANO_BANANA_PRO_MODEL_ID;
  }
  return modelId;
}

export function isLocalRedrawModel(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase();
  return REDRAW_LOCAL_MODELS.has(normalized)
    || normalized.includes(NANO_BANANA_2_MODEL_ID)
    || normalized.includes(NANO_BANANA_PRO_MODEL_ID);
}

export function getDefaultLocalRedrawModel(modelId?: string): ModelType {
  if (modelId && isLocalRedrawModel(modelId)) {
    return normalizeRedrawModelId(modelId);
  }
  return NANO_BANANA_2_MODEL_ID;
}

export function expandRedrawRect(rect: NormalizedRect, amount = REDRAW_REGION_PADDING_RATIO): NormalizedRect {
  const pad = Math.max(rect.width, rect.height) * amount;
  return clampRedrawRect({
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  });
}

export function rectsOverlap(a: NormalizedRect, b: NormalizedRect): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export function unionRedrawRects(rects: NormalizedRect[]): NormalizedRect {
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
  return clampRedrawRect({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  });
}

export function mergeOverlappingRedrawRects(rects: NormalizedRect[]): NormalizedRect[] {
  const pending = rects
    .filter((rect) => rect.width > 0.001 && rect.height > 0.001)
    .map(clampRedrawRect);
  const merged: NormalizedRect[] = [];

  while (pending.length > 0) {
    let current = pending.shift()!;
    let changed = true;

    while (changed) {
      changed = false;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        if (rectsOverlap(current, pending[index])) {
          current = unionRedrawRects([current, pending[index]]);
          pending.splice(index, 1);
          changed = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

export function pixelRectToNormalizedRect(
  rect: { x: number; y: number; width: number; height: number },
  size: PixelSize,
): NormalizedRect {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  return clampRedrawRect({
    x: cleanRatioNumber(rect.x / width),
    y: cleanRatioNumber(rect.y / height),
    width: cleanRatioNumber(rect.width / width),
    height: cleanRatioNumber(rect.height / height),
  });
}

export function resolveEvenSquarePixelRect(rect: NormalizedRect, size: PixelSize): { x: number; y: number; width: number; height: number } {
  const imageWidth = Math.max(1, Math.round(size.width));
  const imageHeight = Math.max(1, Math.round(size.height));
  const centerX = (rect.x + rect.width / 2) * imageWidth;
  const centerY = (rect.y + rect.height / 2) * imageHeight;
  let side = Math.ceil(Math.max(rect.width * imageWidth, rect.height * imageHeight));

  if (side % 2 !== 0) side += 1;
  side = Math.max(2, Math.min(side, imageWidth, imageHeight));

  let x = Math.round(centerX - side / 2);
  let y = Math.round(centerY - side / 2);
  x = Math.max(0, Math.min(imageWidth - side, x));
  y = Math.max(0, Math.min(imageHeight - side, y));

  return { x, y, width: side, height: side };
}

export function selectRedrawImageSize(maxPixelSide: number, supportedSizes: ImageSize[] = SIZE_ORDER): ImageSize {
  const desired = maxPixelSide <= 1000
    ? ImageSize.SIZE_1K
    : maxPixelSide <= 2500
      ? ImageSize.SIZE_2K
      : ImageSize.SIZE_4K;

  const supported = new Set(supportedSizes.length > 0 ? supportedSizes : SIZE_ORDER);
  if (supported.has(desired)) return desired;

  const desiredIndex = SIZE_ORDER.indexOf(desired);
  for (let index = desiredIndex; index >= 0; index -= 1) {
    if (supported.has(SIZE_ORDER[index])) return SIZE_ORDER[index];
  }

  return SIZE_DESC.find((size) => supported.has(size)) || ImageSize.SIZE_1K;
}

export function assignColorBlockLabels(blocks: RedrawColorBlock[]): RedrawColorBlock[] {
  const grouped = new Map<string, RedrawColorBlock[]>();
  blocks.forEach((block) => {
    const key = normalizeColor(block.color);
    grouped.set(key, [...(grouped.get(key) || []), block]);
  });

  return blocks.map((block) => {
    const colorKey = normalizeColor(block.color);
    const siblings = grouped.get(colorKey) || [];
    const colorName = COLOR_NAMES[colorKey] || block.color;
    const siblingIndex = siblings.findIndex((item) => item.id === block.id);
    const suffix = siblings.length <= 1
      ? ''
      : siblingIndex < 26
        ? String.fromCharCode(65 + siblingIndex)
        : String(siblingIndex - 25);

    return {
      ...block,
      label: suffix ? `${colorName}${suffix}` : colorName,
    };
  });
}

export function buildColorBlockInstruction(blocks: RedrawColorBlock[], userPrompt: string): string {
  const effectiveBlocks = assignColorBlockLabels(blocks).filter((block) => block.prompt?.trim());
  const blockLines = effectiveBlocks.map((block) => (
    `- ${block.label} (${block.color}) 区域：${block.prompt!.trim()}`
  ));
  const basePrompt = userPrompt.trim();

  return [
    '请基于原图和带色块标注的参考图进行重绘，只修改被色块覆盖并在下方列出的区域。',
    '未列出的色块和未覆盖区域必须保持原图内容、构图、光影、材质、边缘和比例不变。',
    blockLines.length > 0 ? blockLines.join('\n') : '- 按用户输入修改已标注色块区域。',
    basePrompt ? `用户补充要求：${basePrompt}` : '',
  ].filter(Boolean).join('\n');
}

export function buildMarkedRegionInstruction(userPrompt: string): string {
  return [
    '请只修改图中被框选或画笔标记的区域，其他区域必须保持原图完全一致。',
    '不要移动主体位置，不要改变未标记区域的颜色、文字、品牌元素、构图和光影。',
    userPrompt.trim(),
  ].filter(Boolean).join('\n');
}

export function buildRedrawPlan(options: {
  model: ModelType;
  prompt: string;
  sourceImageDimensions: PixelSize;
  regions: RedrawRegion[];
  colorBlocks?: RedrawColorBlock[];
  supportedSizes?: ImageSize[];
  annotatedReferenceImage?: RedrawPlan['annotatedReferenceImage'];
}): RedrawPlan {
  const meaningfulRegions = options.regions.filter((region) => region.rect.width > 0.001 && region.rect.height > 0.001);
  const sourceSize = options.sourceImageDimensions;
  const colorBlocks = assignColorBlockLabels(options.colorBlocks || []);

  if (colorBlocks.length > 0) {
    return {
      mode: 'color-blocks',
      model: getDefaultLocalRedrawModel(options.model),
      aspectRatio: AspectRatio.AUTO,
      prompt: buildColorBlockInstruction(colorBlocks, options.prompt),
      strictPrompt: buildColorBlockInstruction(colorBlocks, options.prompt),
      sourceImageDimensions: sourceSize,
      regions: meaningfulRegions,
      cropPlans: [],
      colorBlocks,
      annotatedReferenceImage: options.annotatedReferenceImage,
    };
  }

  if (meaningfulRegions.length === 0) {
    return {
      mode: 'whole-image',
      model: options.model,
      aspectRatio: AspectRatio.AUTO,
      prompt: options.prompt,
      sourceImageDimensions: sourceSize,
      regions: [],
      cropPlans: [],
    };
  }

  const initiallyMerged = mergeOverlappingRedrawRects(meaningfulRegions.map((region) => region.rect));
  const expandedMerged = mergeOverlappingRedrawRects(initiallyMerged.map((rect) => expandRedrawRect(rect)));
  const mode: RedrawPlanMode = expandedMerged.length > REDRAW_LOCAL_REGION_LIMIT
    ? 'whole-image-marked'
    : 'regional-crops';

  if (mode === 'whole-image-marked') {
    return {
      mode,
      model: getDefaultLocalRedrawModel(options.model),
      aspectRatio: AspectRatio.AUTO,
      prompt: buildMarkedRegionInstruction(options.prompt),
      strictPrompt: buildMarkedRegionInstruction(options.prompt),
      sourceImageDimensions: sourceSize,
      regions: meaningfulRegions,
      cropPlans: [],
      annotatedReferenceImage: options.annotatedReferenceImage,
    };
  }

  const cropPlans: RedrawCropPlan[] = expandedMerged.map((rect, index) => {
    const pixelRect = resolveEvenSquarePixelRect(rect, sourceSize);
    const generationRect = pixelRectToNormalizedRect(pixelRect, sourceSize);
    return {
      id: `redraw-crop-${index + 1}`,
      regionIds: meaningfulRegions
        .filter((region) => rectsOverlap(generationRect, region.rect))
        .map((region) => region.id),
      selectionRect: generationRect,
      generationRect,
      pixelRect,
      imageSize: selectRedrawImageSize(Math.max(pixelRect.width, pixelRect.height), options.supportedSizes),
    };
  });

  return {
    mode,
    model: getDefaultLocalRedrawModel(options.model),
    aspectRatio: AspectRatio.SQUARE,
    prompt: options.prompt,
    sourceImageDimensions: sourceSize,
    regions: meaningfulRegions,
    cropPlans,
  };
}
