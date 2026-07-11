import type { CanvasCardPresentation, CanvasSceneBounds, CanvasSceneNode } from '@kk/shared';
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

export const getCanvasSceneNodes = (
  canvas: Canvas | null | undefined,
  options: {
    isMobile?: boolean;
    imageHeightById?: Record<string, number>;
    excludedNodeIds?: ReadonlySet<string>;
  } = {},
): CanvasSceneNode[] => {
  if (!canvas) return [];
  const excluded = options.excludedNodeIds;
  const sceneNodes: CanvasSceneNode[] = [];

  canvas.promptNodes.forEach((prompt) => {
    if (prompt.hiddenInCanvas || excluded?.has(prompt.id)) return;
    sceneNodes.push({
      id: prompt.id,
      nodeType: 'prompt',
      position: prompt.position,
      bounds: getPromptSceneBounds(prompt, options.isMobile),
      presentation: prompt.presentation as CanvasCardPresentation | undefined,
      childNodeIds: prompt.childImageIds || [],
      zIndex: prompt.zIndex,
      status: prompt.error ? 'failed' : prompt.isGenerating ? 'running' : 'idle',
      createdAt: prompt.timestamp,
      updatedAt: prompt.timestamp,
    });
  });
  canvas.imageNodes.forEach((image) => {
    if (excluded?.has(image.id)) return;
    sceneNodes.push({
      id: image.id,
      nodeType: 'media',
      position: image.position,
      bounds: getImageSceneBounds(image, options.imageHeightById?.[image.id]),
      presentation: image.presentation as CanvasCardPresentation | undefined,
      parentNodeId: image.parentPromptId || undefined,
      zIndex: image.zIndex,
      status: image.error ? 'failed' : image.isGenerating ? 'running' : 'completed',
      createdAt: image.timestamp,
      updatedAt: image.timestamp,
    });
  });
  (canvas.workflow?.nodes || []).forEach((node) => {
    if (excluded?.has(node.id)) return;
    sceneNodes.push({
      id: node.id,
      nodeType: 'workflow',
      position: node.position,
      bounds: boundsFromBottomCenter(node.position, node.width || 284, node.height || 176),
      presentation: node.presentation as CanvasCardPresentation | undefined,
      zIndex: node.zIndex,
      status: node.kind === 'workflow-panel' ? node.data?.status : 'idle',
    });
  });
  (canvas.noteNodes || []).forEach((note) => {
    if (excluded?.has(note.id)) return;
    sceneNodes.push({
      id: note.id,
      nodeType: 'note',
      position: note.position,
      bounds: boundsFromBottomCenter(note.position, note.width, note.height),
      presentation: note.presentation,
      childNodeIds: note.sourceNodeIds,
      zIndex: note.zIndex,
      status: 'idle',
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  });
  canvas.groups.forEach((group) => {
    if (group.hidden || excluded?.has(group.id)) return;
    sceneNodes.push({
      id: group.id,
      nodeType: 'group',
      position: {
        x: group.bounds.x + group.bounds.width / 2,
        y: group.bounds.y + group.bounds.height,
      },
      bounds: group.bounds,
      memberNodeIds: group.nodeIds,
      zIndex: group.zIndex,
      status: 'idle',
    });
  });

  return sceneNodes.filter(({ bounds }) => (
    Number.isFinite(bounds.x)
    && Number.isFinite(bounds.y)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    && bounds.width > 0
    && bounds.height > 0
  ));
};

export const getCanvasSceneBounds = (
  canvas: Canvas | null | undefined,
  options: {
    isMobile?: boolean;
    imageHeightById?: Record<string, number>;
    excludedNodeIds?: ReadonlySet<string>;
  } = {},
): CanvasSceneBounds[] => {
  return getCanvasSceneNodes(canvas, options).map((node) => node.bounds);
};

export const getCanvasSceneBoundsForNodeIds = (
  canvas: Canvas | null | undefined,
  nodeIds: readonly string[],
): CanvasSceneBounds[] => {
  if (!canvas || nodeIds.length === 0) return [];

  const included = new Set(nodeIds);
  canvas.groups.forEach((group) => {
    if (!included.has(group.id)) return;
    group.nodeIds.forEach((nodeId) => included.add(nodeId));
  });
  canvas.promptNodes.forEach((prompt) => {
    if (!included.has(prompt.id)) return;
    canvas.imageNodes.forEach((image) => {
      if (image.parentPromptId === prompt.id) included.add(image.id);
    });
  });

  const bounds: CanvasSceneBounds[] = [];
  canvas.promptNodes.forEach((prompt) => {
    if (included.has(prompt.id) && !prompt.hiddenInCanvas) bounds.push(getPromptSceneBounds(prompt));
  });
  canvas.imageNodes.forEach((image) => {
    if (included.has(image.id)) bounds.push(getImageSceneBounds(image));
  });
  (canvas.workflow?.nodes || []).forEach((node) => {
    if (included.has(node.id)) {
      bounds.push(boundsFromBottomCenter(node.position, node.width || 284, node.height || 176));
    }
  });
  (canvas.noteNodes || []).forEach((note) => {
    if (included.has(note.id)) bounds.push(boundsFromBottomCenter(note.position, note.width, note.height));
  });
  canvas.groups.forEach((group) => {
    if (included.has(group.id) && !group.hidden) bounds.push(group.bounds);
  });
  return bounds;
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
