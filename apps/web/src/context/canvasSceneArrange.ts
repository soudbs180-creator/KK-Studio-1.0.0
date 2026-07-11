import type { CanvasLayoutMode, CanvasSceneBounds } from '@kk/shared';
import type { Canvas } from '../types.ts';
import { arrangeCanvasLayoutItems } from '../canvas/canvasLayoutService.ts';
import {
  boundsFromBottomCenter,
  getCanvasSceneBoundsForNodeIds,
  getImageSceneBounds,
  getPromptSceneBounds,
  unionCanvasSceneBounds,
} from '../canvas/canvasSceneGeometry.ts';
import { createCanvasCardPresentation, resolvePromptCardKind } from './canvasPresentationMigration.ts';

type ArrangeRoot = {
  id: string;
  nodeIds: string[];
  bounds: CanvasSceneBounds;
};

export type CanvasSceneArrangeResult = {
  canvas: Canvas;
  bounds: CanvasSceneBounds | null;
  arrangedNodeIds: string[];
};

const unique = (ids: readonly string[]) => Array.from(new Set(ids.filter(Boolean)));

const resolveRoot = (canvas: Canvas, id: string): ArrangeRoot | null => {
  const group = canvas.groups.find((candidate) => candidate.id === id);
  if (group) {
    const memberIds = new Set(group.nodeIds);
    canvas.promptNodes.forEach((prompt) => {
      if (!memberIds.has(prompt.id) || prompt.presentation?.kind === 'ppt-deck') return;
      canvas.imageNodes.forEach((image) => {
        if (image.parentPromptId === prompt.id) memberIds.add(image.id);
      });
    });
    return { id, nodeIds: [...memberIds], bounds: group.bounds };
  }

  const prompt = canvas.promptNodes.find((candidate) => candidate.id === id);
  if (prompt) {
    const nodeIds = [prompt.id];
    if (prompt.presentation?.kind !== 'ppt-deck') {
      canvas.imageNodes.forEach((image) => {
        if (image.parentPromptId === prompt.id) nodeIds.push(image.id);
      });
    }
    const bounds = unionCanvasSceneBounds([
      getPromptSceneBounds(prompt),
      ...canvas.imageNodes.filter((image) => nodeIds.includes(image.id)).map((image) => getImageSceneBounds(image)),
    ]);
    return bounds ? { id, nodeIds, bounds } : null;
  }

  const image = canvas.imageNodes.find((candidate) => candidate.id === id);
  if (image) return { id, nodeIds: [id], bounds: getImageSceneBounds(image) };
  const note = (canvas.noteNodes || []).find((candidate) => candidate.id === id);
  if (note) return { id, nodeIds: [id], bounds: boundsFromBottomCenter(note.position, note.width, note.height) };
  const workflow = canvas.workflow?.nodes.find((candidate) => candidate.id === id);
  if (workflow) {
    return {
      id,
      nodeIds: [id],
      bounds: boundsFromBottomCenter(workflow.position, workflow.width || 284, workflow.height || 176),
    };
  }
  return null;
};

const buildArrangeRoots = (canvas: Canvas, nodeIds: readonly string[]): ArrangeRoot[] => {
  const groupIds = new Set(canvas.groups.map((group) => group.id));
  const promptIds = new Set(canvas.promptNodes.map((prompt) => prompt.id));
  const ordered = unique(nodeIds).sort((a, b) => {
    const priority = (id: string) => groupIds.has(id) ? 0 : promptIds.has(id) ? 1 : 2;
    return priority(a) - priority(b);
  });
  const consumed = new Set<string>();
  const roots: ArrangeRoot[] = [];
  ordered.forEach((id) => {
    if (consumed.has(id)) return;
    const root = resolveRoot(canvas, id);
    if (!root) return;
    roots.push(root);
    root.nodeIds.forEach((nodeId) => consumed.add(nodeId));
  });
  return roots;
};

export const getCanvasArrangeRootNodeIds = (canvas: Canvas): string[] => {
  const grouped = new Set(canvas.groups.flatMap((group) => group.nodeIds));
  const ids = canvas.groups.filter((group) => !group.hidden).map((group) => group.id);
  canvas.promptNodes.forEach((prompt) => {
    if (!prompt.hiddenInCanvas && !grouped.has(prompt.id)) ids.push(prompt.id);
  });
  canvas.imageNodes.forEach((image) => {
    const parentIsRoot = image.parentPromptId && ids.includes(image.parentPromptId);
    if (!grouped.has(image.id) && !parentIsRoot) ids.push(image.id);
  });
  (canvas.noteNodes || []).forEach((note) => {
    if (!grouped.has(note.id)) ids.push(note.id);
  });
  (canvas.workflow?.nodes || []).forEach((node) => {
    if (!grouped.has(node.id)) ids.push(node.id);
  });
  return unique(ids);
};

export const arrangeCanvasSceneNodes = (
  canvas: Canvas,
  nodeIds: readonly string[],
  mode: CanvasLayoutMode,
  options: { gap?: number; columns?: number; now?: () => number } = {},
): CanvasSceneArrangeResult | null => {
  const roots = buildArrangeRoots(canvas, nodeIds);
  if (roots.length === 0) return null;
  const gap = Number.isFinite(options.gap) ? Math.max(0, Number(options.gap)) : 56;
  const columns = mode === 'row'
    ? roots.length
    : mode === 'column'
      ? 1
      : Math.min(Math.max(1, options.columns || Math.ceil(Math.sqrt(roots.length))), roots.length);
  const layout = arrangeCanvasLayoutItems(roots.map((root) => ({
    id: root.id,
    position: { x: root.bounds.x + root.bounds.width / 2, y: root.bounds.y + root.bounds.height },
    width: root.bounds.width,
    height: root.bounds.height,
  })), { mode, gap, columns });
  const deltaByNodeId = new Map<string, { x: number; y: number }>();
  roots.forEach((root) => {
    const position = layout.positions[root.id];
    if (!position) return;
    const delta = {
      x: position.x - (root.bounds.x + root.bounds.width / 2),
      y: position.y - (root.bounds.y + root.bounds.height),
    };
    root.nodeIds.forEach((nodeId) => deltaByNodeId.set(nodeId, delta));
  });
  let nextCanvas: Canvas = {
    ...canvas,
    promptNodes: canvas.promptNodes.map((prompt) => {
      const delta = deltaByNodeId.get(prompt.id);
      if (!delta) return prompt;
      const layoutMode = prompt.presentation?.kind === 'ppt-deck' ? 'column' : mode;
      const childCount = canvas.imageNodes.filter((image) => image.parentPromptId === prompt.id).length;
      return {
        ...prompt,
        position: { x: prompt.position.x + delta.x, y: prompt.position.y + delta.y },
        presentation: createCanvasCardPresentation(
          prompt.presentation?.kind || resolvePromptCardKind(prompt, childCount),
          layoutMode,
          prompt.presentation?.size || 'standard',
          prompt.presentation?.diagnostic,
        ),
      };
    }),
    imageNodes: canvas.imageNodes.map((image) => {
      const delta = deltaByNodeId.get(image.id);
      return delta ? { ...image, position: { x: image.position.x + delta.x, y: image.position.y + delta.y } } : image;
    }),
    noteNodes: (canvas.noteNodes || []).map((note) => {
      const delta = deltaByNodeId.get(note.id);
      return delta ? { ...note, position: { x: note.position.x + delta.x, y: note.position.y + delta.y }, updatedAt: (options.now ?? Date.now)() } : note;
    }),
    workflow: canvas.workflow ? {
      ...canvas.workflow,
      nodes: canvas.workflow.nodes.map((node) => {
        const delta = deltaByNodeId.get(node.id);
        return delta ? { ...node, position: { x: node.position.x + delta.x, y: node.position.y + delta.y } } : node;
      }),
    } : canvas.workflow,
    groups: canvas.groups.map((group) => {
      const directDelta = layout.positions[group.id];
      if (!directDelta) return group;
      const root = roots.find((candidate) => candidate.id === group.id);
      if (!root) return group;
      return {
        ...group,
        bounds: {
          ...group.bounds,
          x: directDelta.x - root.bounds.width / 2,
          y: directDelta.y - root.bounds.height,
        },
      };
    }),
    lastModified: (options.now ?? Date.now)(),
  };

  nextCanvas = {
    ...nextCanvas,
    groups: nextCanvas.groups.map((group) => {
      if (layout.positions[group.id]) return group;
      if (!group.nodeIds.some((id) => deltaByNodeId.has(id))) return group;
      const memberBounds = unionCanvasSceneBounds(getCanvasSceneBoundsForNodeIds(nextCanvas, group.nodeIds));
      return memberBounds ? { ...group, bounds: memberBounds } : group;
    }),
  };
  return {
    canvas: nextCanvas,
    bounds: unionCanvasSceneBounds(getCanvasSceneBoundsForNodeIds(nextCanvas, roots.map((root) => root.id))),
    arrangedNodeIds: [...deltaByNodeId.keys()],
  };
};
