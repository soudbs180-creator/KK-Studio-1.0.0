import type { AspectRatio, Canvas, GeneratedImage, PromptNode } from '../../../types.ts';
import { resolveCanvasLayoutBounds } from '../../../canvas/canvasLayoutService.ts';
import { getCardDimensions } from '../../../utils/styleUtils.ts';

const PROMPT_WIDTH = 320;
const DEFAULT_PROMPT_HEIGHT = 180;
const GROUP_PADDING = 48;

type LayoutItem = {
  id: string;
  kind: 'prompt' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
};

const unique = (ids: readonly string[]): string[] => Array.from(new Set(ids.filter(Boolean)));

const getPromptItem = (prompt: PromptNode): LayoutItem => {
  const height = prompt.height || DEFAULT_PROMPT_HEIGHT;
  return {
    id: prompt.id,
    kind: 'prompt',
    x: prompt.position.x,
    y: prompt.position.y,
    width: PROMPT_WIDTH,
    height
  };
};

const getImageItem = (image: GeneratedImage): LayoutItem => {
  const dimensions = getCardDimensions(image.aspectRatio as AspectRatio, true);
  return {
    id: image.id,
    kind: 'image',
    x: image.position.x,
    y: image.position.y,
    width: dimensions.width,
    height: dimensions.totalHeight
  };
};

const buildLayoutItems = (canvas: Canvas, nodeIds: readonly string[]): LayoutItem[] => {
  const promptById = new Map(canvas.promptNodes.map(prompt => [prompt.id, prompt]));
  const imageById = new Map(canvas.imageNodes.map(image => [image.id, image]));

  return unique(nodeIds).flatMap((id) => {
    const prompt = promptById.get(id);
    if (prompt) return [getPromptItem(prompt)];

    const image = imageById.get(id);
    if (image) return [getImageItem(image)];

    return [];
  });
};

export function resolveAgentGroupBounds(
  canvas: Canvas,
  nodeIds: readonly string[]
): Canvas['groups'][number]['bounds'] {
  const items = buildLayoutItems(canvas, nodeIds);
  if (items.length === 0) {
    return { x: 0, y: 0, width: 320, height: 180 };
  }

  const bounds = resolveCanvasLayoutBounds(items.map((item) => ({
    id: item.id,
    position: { x: item.x, y: item.y },
    width: item.width,
    height: item.height,
  })));
  if (!bounds) {
    return { x: 0, y: 0, width: 320, height: 180 };
  }

  return {
    x: bounds.x - GROUP_PADDING,
    y: bounds.y - GROUP_PADDING,
    width: Math.max(240, bounds.width + GROUP_PADDING * 2),
    height: Math.max(140, bounds.height + GROUP_PADDING * 2)
  };
}
