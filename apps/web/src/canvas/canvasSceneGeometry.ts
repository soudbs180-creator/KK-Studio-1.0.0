import type { CanvasSceneBounds } from '@kk/shared';
import type { Canvas, GeneratedImage, PromptNode } from '../types.ts';
import { getPromptNodeBoundsWidth } from '../utils/promptNodeCardWidth.ts';
import { getCardDimensions } from '../utils/styleUtils.ts';

export const boundsFromBottomCenter = (
  position: { x: number; y: number },
  width: number,
  height: number,
): CanvasSceneBounds => ({
  x: position.x - width / 2,
  y: position.y - height,
  width,
  height,
});

export const getPromptSceneBounds = (prompt: PromptNode, isMobile = false): CanvasSceneBounds => (
  boundsFromBottomCenter(
    prompt.position,
    getPromptNodeBoundsWidth(prompt, isMobile),
    prompt.height || 200,
  )
);

export const getImageSceneBounds = (
  image: GeneratedImage,
  measuredHeight?: number,
): CanvasSceneBounds => {
  const dimensions = getCardDimensions(image.aspectRatio, true);
  return boundsFromBottomCenter(image.position, dimensions.width, measuredHeight || dimensions.totalHeight);
};

export const getCanvasSceneBounds = (
  canvas: Canvas | null | undefined,
  options: {
    isMobile?: boolean;
    imageHeightById?: Record<string, number>;
    excludedNodeIds?: ReadonlySet<string>;
  } = {},
): CanvasSceneBounds[] => {
  if (!canvas) return [];
  const excluded = options.excludedNodeIds;
  const bounds: CanvasSceneBounds[] = [];

  canvas.promptNodes.forEach((prompt) => {
    if (prompt.hiddenInCanvas || excluded?.has(prompt.id)) return;
    bounds.push(getPromptSceneBounds(prompt, options.isMobile));
  });
  canvas.imageNodes.forEach((image) => {
    if (excluded?.has(image.id)) return;
    bounds.push(getImageSceneBounds(image, options.imageHeightById?.[image.id]));
  });
  (canvas.workflow?.nodes || []).forEach((node) => {
    if (excluded?.has(node.id)) return;
    bounds.push(boundsFromBottomCenter(node.position, node.width || 284, node.height || 176));
  });
  (canvas.noteNodes || []).forEach((note) => {
    if (excluded?.has(note.id)) return;
    bounds.push(boundsFromBottomCenter(note.position, note.width, note.height));
  });
  canvas.groups.forEach((group) => {
    if (group.hidden || excluded?.has(group.id)) return;
    bounds.push(group.bounds);
  });

  return bounds.filter((item) => (
    Number.isFinite(item.x)
    && Number.isFinite(item.y)
    && Number.isFinite(item.width)
    && Number.isFinite(item.height)
    && item.width > 0
    && item.height > 0
  ));
};

export const unionCanvasSceneBounds = (
  bounds: readonly CanvasSceneBounds[],
): CanvasSceneBounds | null => {
  if (bounds.length === 0) return null;
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};
