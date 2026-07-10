import type { CanvasSceneBounds } from '@kk/shared';
import type { AspectRatio, Canvas, GeneratedImage, PromptNode } from '../../../types.ts';
import { arrangeCanvasLayoutItems, resolveCanvasLayoutBounds } from '../../../canvas/canvasLayoutService.ts';
import { getCardDimensions } from '../../../utils/styleUtils.ts';

export type AgentNodeLayoutMode = 'grid' | 'row' | 'column';
export type AgentNodeLayoutPreset = AgentNodeLayoutMode | 'compact-grid';

export interface AgentNodeArrangeOptions {
  mode?: AgentNodeLayoutMode;
  preset?: AgentNodeLayoutPreset;
  columns?: number;
  gap?: number;
}

export interface AgentNodeArrangeUpdates {
  promptNodes: { id: string; updates: Partial<PromptNode> }[];
  imageNodes: { id: string; updates: Partial<GeneratedImage> }[];
  bounds?: CanvasSceneBounds | null;
}

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

const resolveColumns = (count: number, options: AgentNodeArrangeOptions): number => {
  if (options.mode === 'row') return Math.max(1, count);
  if (options.mode === 'column') return 1;
  if (Number.isFinite(options.columns) && Number(options.columns) > 0) {
    return Math.min(count, Math.max(1, Math.floor(Number(options.columns))));
  }
  return Math.max(1, Math.min(options.preset === 'compact-grid' ? 4 : 3, count));
};

export function resolveAgentNodeArrangeUpdates(
  canvas: Canvas,
  nodeIds: readonly string[],
  options: AgentNodeArrangeOptions = {}
): AgentNodeArrangeUpdates {
  const items = buildLayoutItems(canvas, nodeIds);
  if (items.length === 0) {
    return { promptNodes: [], imageNodes: [] };
  }

  const gap = Number.isFinite(options.gap)
    ? Math.max(0, Number(options.gap))
    : options.preset === 'compact-grid'
      ? 24
      : 48;
  const mode = options.mode
    || (options.preset && options.preset !== 'compact-grid' ? options.preset : 'grid');
  const columns = resolveColumns(items.length, { ...options, mode });
  const { positions, bounds } = arrangeCanvasLayoutItems(
    items.map((item) => ({
      id: item.id,
      position: { x: item.x, y: item.y },
      width: item.width,
      height: item.height,
    })),
    { mode, gap, columns },
  );
  const promptNodes: AgentNodeArrangeUpdates['promptNodes'] = [];
  const imageNodes: AgentNodeArrangeUpdates['imageNodes'] = [];

  items.forEach((item) => {
    const position = positions[item.id];
    if (item.kind === 'prompt') {
      promptNodes.push({ id: item.id, updates: { position } });
    } else {
      imageNodes.push({ id: item.id, updates: { position } });
    }
  });

  return { promptNodes, imageNodes, bounds };
}

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
