export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PixelSize = {
  width: number;
  height: number;
};

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PartialRedrawMetadataLike = {
  selectionRect: NormalizedRect;
  generationRect: NormalizedRect;
};

const ASPECT_RATIO_NUMBERS: Record<string, number> = {
  auto: 1,
  '1:1': 1,
  '1:8': 1 / 8,
  '1:4': 1 / 4,
  '2:3': 2 / 3,
  '3:4': 3 / 4,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '9:21': 9 / 21,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  '5:4': 5 / 4,
  '16:9': 16 / 9,
  '21:9': 21 / 9,
  '4:1': 4 / 1,
  '8:1': 8 / 1,
};

function cleanRatioNumber(value: number): number {
  return Number(value.toFixed(12));
}

export function clampNormalizedRect(rect: NormalizedRect): NormalizedRect {
  const width = Math.min(1, Math.max(0, rect.width));
  const height = Math.min(1, Math.max(0, rect.height));
  const x = Math.min(1 - width, Math.max(0, rect.x));
  const y = Math.min(1 - height, Math.max(0, rect.y));
  return { x, y, width, height };
}

export function expandSelectionToAspectRatio(
  selectionRect: NormalizedRect,
  sourceSize: PixelSize,
  aspectRatio: string,
): NormalizedRect {
  const targetRatio = ASPECT_RATIO_NUMBERS[aspectRatio] ?? 1;
  const sourceWidth = sourceSize.width > 0 ? sourceSize.width : 1;
  const sourceHeight = sourceSize.height > 0 ? sourceSize.height : 1;
  let width = selectionRect.width * sourceWidth;
  let height = selectionRect.height * sourceHeight;

  if (width <= 0 || height <= 0) {
    return clampNormalizedRect(selectionRect);
  }

  const currentRatio = width / height;

  if (currentRatio > targetRatio) {
    height = width / targetRatio;
  } else {
    width = height * targetRatio;
  }

  let normalizedWidth = width / sourceWidth;
  let normalizedHeight = height / sourceHeight;
  const scaleToFit = Math.min(1, 1 / normalizedWidth, 1 / normalizedHeight);
  normalizedWidth *= scaleToFit;
  normalizedHeight *= scaleToFit;

  const centerX = selectionRect.x + selectionRect.width / 2;
  const centerY = selectionRect.y + selectionRect.height / 2;

  return clampNormalizedRect({
    x: centerX - normalizedWidth / 2,
    y: centerY - normalizedHeight / 2,
    width: normalizedWidth,
    height: normalizedHeight,
  });
}

export function resolveRelativeSelectionRect(
  selectionRect: NormalizedRect,
  generationRect: NormalizedRect,
): NormalizedRect {
  return {
    x: cleanRatioNumber((selectionRect.x - generationRect.x) / generationRect.width),
    y: cleanRatioNumber((selectionRect.y - generationRect.y) / generationRect.height),
    width: cleanRatioNumber(selectionRect.width / generationRect.width),
    height: cleanRatioNumber(selectionRect.height / generationRect.height),
  };
}

export function resolvePixelRect(rect: NormalizedRect, size: PixelSize): PixelRect {
  return {
    x: Math.round(rect.x * size.width),
    y: Math.round(rect.y * size.height),
    width: Math.round(rect.width * size.width),
    height: Math.round(rect.height * size.height),
  };
}

function ensureCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('PARTIAL_REDRAW_CANVAS_CONTEXT_MISSING');
  }
  return context;
}

async function loadImageElement(sourceUrl: string): Promise<HTMLImageElement> {
  const finalUrl = sourceUrl.trim();
  if (!finalUrl) {
    throw new Error('PARTIAL_REDRAW_SOURCE_URL_MISSING');
  }

  let safeUrl = finalUrl;
  let revokeUrl: (() => void) | undefined;

  if (/^https?:\/\//i.test(finalUrl)) {
    const response = await fetch(finalUrl);
    if (!response.ok) {
      throw new Error(`PARTIAL_REDRAW_FETCH_FAILED:${response.status}`);
    }
    const blob = await response.blob();
    safeUrl = URL.createObjectURL(blob);
    revokeUrl = () => URL.revokeObjectURL(safeUrl);
  }

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('PARTIAL_REDRAW_IMAGE_DECODE_FAILED'));
      image.src = safeUrl;
    });
  } finally {
    revokeUrl?.();
  }
}

export async function cropImageToDataUrl(sourceUrl: string, cropRect: PixelRect): Promise<string> {
  const image = await loadImageElement(sourceUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, cropRect.width);
  canvas.height = Math.max(1, cropRect.height);
  const context = ensureCanvasContext(canvas);

  context.drawImage(
    image,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL('image/png');
}

export async function buildPartialRedrawReferenceImage(
  sourceUrl: string,
  generationRect: NormalizedRect,
  sourceSize: PixelSize,
): Promise<{ id: string; data: string; mimeType: string }> {
  const cropRect = resolvePixelRect(generationRect, sourceSize);
  const dataUrl = await cropImageToDataUrl(sourceUrl, cropRect);
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  return {
    id: `partial-redraw-source-${Date.now()}`,
    data: match?.[2] || dataUrl,
    mimeType: match?.[1] || 'image/png',
  };
}

export async function compositePartialRedrawResult(options: {
  originalImageUrl: string;
  generatedCropUrl: string;
  partialRedraw: PartialRedrawMetadataLike;
}): Promise<string> {
  const originalImage = await loadImageElement(options.originalImageUrl);
  const generatedCrop = await loadImageElement(options.generatedCropUrl);
  const originalSize = {
    width: originalImage.naturalWidth || originalImage.width,
    height: originalImage.naturalHeight || originalImage.height,
  };
  const generationRect = resolvePixelRect(options.partialRedraw.generationRect, originalSize);
  const selectionRect = resolvePixelRect(options.partialRedraw.selectionRect, originalSize);
  const relativeSelectionRect = resolveRelativeSelectionRect(
    options.partialRedraw.selectionRect,
    options.partialRedraw.generationRect,
  );

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = originalSize.width;
  fullCanvas.height = originalSize.height;
  const fullContext = ensureCanvasContext(fullCanvas);
  fullContext.drawImage(originalImage, 0, 0, fullCanvas.width, fullCanvas.height);

  const generationCanvas = document.createElement('canvas');
  generationCanvas.width = Math.max(1, generationRect.width);
  generationCanvas.height = Math.max(1, generationRect.height);
  const generationContext = ensureCanvasContext(generationCanvas);
  generationContext.drawImage(
    generatedCrop,
    0,
    0,
    generationCanvas.width,
    generationCanvas.height,
  );

  const sliceX = Math.round(relativeSelectionRect.x * generationCanvas.width);
  const sliceY = Math.round(relativeSelectionRect.y * generationCanvas.height);
  const sliceWidth = Math.max(1, selectionRect.width);
  const sliceHeight = Math.max(1, selectionRect.height);

  fullContext.drawImage(
    generationCanvas,
    sliceX,
    sliceY,
    sliceWidth,
    sliceHeight,
    selectionRect.x,
    selectionRect.y,
    selectionRect.width,
    selectionRect.height,
  );

  return fullCanvas.toDataURL('image/png');
}
