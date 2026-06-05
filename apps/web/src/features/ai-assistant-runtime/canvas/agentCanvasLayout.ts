import type { AspectRatio, Canvas, GeneratedImage, PromptNode } from '../../../types.ts';
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
}

const PROMPT_WIDTH = 360;
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
  const columns = resolveColumns(items.length, options);
  const baseX = Math.min(...items.map(item => item.x - item.width / 2));
  const baseY = Math.min(...items.map(item => item.y - item.height));
  const promptNodes: AgentNodeArrangeUpdates['promptNodes'] = [];
  const imageNodes: AgentNodeArrangeUpdates['imageNodes'] = [];
  let y = baseY;

  for (let start = 0; start < items.length; start += columns) {
    const rowItems = items.slice(start, start + columns);
    const rowHeight = Math.max(...rowItems.map(item => item.height));
    let x = baseX;

    rowItems.forEach((item) => {
      const position = {
        x: x + item.width / 2,
        y: y + item.height
      };
      if (item.kind === 'prompt') {
        promptNodes.push({ id: item.id, updates: { position } });
      } else {
        imageNodes.push({ id: item.id, updates: { position } });
      }
      x += item.width + gap;
    });

    y += rowHeight + gap;
  }

  return { promptNodes, imageNodes };
}

export function resolveAgentGroupBounds(
  canvas: Canvas,
  nodeIds: readonly string[]
): Canvas['groups'][number]['bounds'] {
  const items = buildLayoutItems(canvas, nodeIds);
  if (items.length === 0) {
    return { x: 0, y: 0, width: 320, height: 180 };
  }

  const minX = Math.min(...items.map(item => item.x - item.width / 2));
  const maxX = Math.max(...items.map(item => item.x + item.width / 2));
  const minY = Math.min(...items.map(item => item.y - item.height));
  const maxY = Math.max(...items.map(item => item.y));

  return {
    x: minX - GROUP_PADDING,
    y: minY - GROUP_PADDING,
    width: Math.max(240, maxX - minX + GROUP_PADDING * 2),
    height: Math.max(140, maxY - minY + GROUP_PADDING * 2)
  };
}
