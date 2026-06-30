import type { Canvas } from '../types/index.ts';
import { type AspectRatio, GenerationMode, type GeneratedImage, type PromptNode } from '../types/index.ts';
import { snapCanvasPointToGrid } from '../utils/canvasSnapToGrid.ts';
import { isWorkflowUtilityNodeKind } from '../workflow/schema.ts';
import { getCardDimensions } from '../utils/styleUtils.ts';

export type CanvasMoveDelta = { x: number; y: number };
export type CanvasMoveSource = string | string[] | undefined;
export type CanvasMoveOptions = { snapToGrid?: boolean };

const moveCanvasPoint = (
    position: { x: number; y: number },
    delta: CanvasMoveDelta,
    options?: CanvasMoveOptions,
) => snapCanvasPointToGrid({
    x: position.x + delta.x,
    y: position.y + delta.y,
}, { enabled: options?.snapToGrid });

export function resolveMoveSelectedCanvasNodeIds(
    selectedNodeIds: string[],
    sourceNodeIdOrIds?: CanvasMoveSource,
): string[] {
    if (Array.isArray(sourceNodeIdOrIds) && sourceNodeIdOrIds.length > 0) {
        return sourceNodeIdOrIds;
    }

    if (typeof sourceNodeIdOrIds === 'string' && sourceNodeIdOrIds) {
        return selectedNodeIds.includes(sourceNodeIdOrIds) ? selectedNodeIds : [sourceNodeIdOrIds];
    }

    return selectedNodeIds;
}

function getSubCardStandardOffset(
  prompt: PromptNode,
  childImages: GeneratedImage[],
  image: GeneratedImage,
  layoutMode: 'grid' | 'row' | 'column'
): { x: number; y: number } {
  const index = childImages.findIndex(img => img.id === image.id);
  if (index === -1) return { x: 0, y: 150 };

  const imageDims = childImages.map(img => {
    const { width, totalHeight } = getCardDimensions(img.aspectRatio, true);
    return { w: width, h: totalHeight };
  });

  const currentDims = imageDims[index];

  if (layoutMode === 'row') {
    const totalWidth = imageDims.reduce((sum, d) => sum + d.w, 0) + (childImages.length - 1) * 32; // SUB_IMAGE_GAP = 32
    let currentLeft = -totalWidth / 2;
    for (let i = 0; i < index; i++) {
      currentLeft += imageDims[i].w + 32;
    }
    return {
      x: currentLeft + currentDims.w / 2,
      y: 56 + currentDims.h // PROMPT_TO_SUB_GAP = 56
    };
  } else if (layoutMode === 'column') {
    let currentTop = 56;
    for (let i = 0; i < index; i++) {
      currentTop += imageDims[i].h + 32;
    }
    return {
      x: 0,
      y: currentTop + currentDims.h
    };
  } else {
    // grid
    const columns = Math.min(20, childImages.length); // SUB_COLUMNS = 20
    const maxWidth = Math.max(...imageDims.map(d => d.w));
    const totalWidth = columns * maxWidth + (columns - 1) * 32;
    const startX = -totalWidth / 2 + maxWidth / 2;

    const rowCount = Math.ceil(childImages.length / columns);
    const rowMaxHeights: number[] = [];
    for (let r = 0; r < rowCount; r++) {
      let maxH = 0;
      for (let c = 0; c < columns; c++) {
        const idx = r * columns + c;
        if (idx < childImages.length) {
          maxH = Math.max(maxH, imageDims[idx].h);
        }
      }
      rowMaxHeights.push(maxH);
    }

    const row = Math.floor(index / columns);
    const col = index % columns;

    let currentTop = 56;
    for (let r = 0; r < row; r++) {
      currentTop += rowMaxHeights[r] + 32;
    }

    return {
      x: startX + col * (maxWidth + 32),
      y: currentTop + currentDims.h
    };
  }
}

export function moveSelectedCanvasNodes(input: {
    canvas: Canvas;
    selectedNodeIds: string[];
    delta: CanvasMoveDelta;
    sourceNodeIdOrIds?: CanvasMoveSource;
    options?: CanvasMoveOptions;
    snapToGrid?: boolean;
}): Canvas {
    const { canvas, delta, sourceNodeIdOrIds } = input;
    if (delta.x === 0 && delta.y === 0) return canvas;

    const options = input.options ?? { snapToGrid: input.snapToGrid };
    const selectedIds = resolveMoveSelectedCanvasNodeIds(input.selectedNodeIds, sourceNodeIdOrIds);
    if (selectedIds.length === 0) return canvas;

    const selectedSet = new Set(selectedIds);
    const movedPromptIds = new Set<string>();
    canvas.promptNodes.forEach((node) => {
        if (selectedSet.has(node.id)) {
            movedPromptIds.add(node.id);
        }
    });

    const promptNodes = canvas.promptNodes.map(node => {
        if (selectedSet.has(node.id)) {
            return {
                ...node,
                position: moveCanvasPoint(node.position, delta, options),
                userMoved: true,
            };
        }
        return node;
    });

    const imageNodes = canvas.imageNodes.map(node => {
        const isDirectlyMovedImage = selectedSet.has(node.id);
        const isMovingWithPromptGroup = Boolean(node.parentPromptId && movedPromptIds.has(node.parentPromptId));
        if (isMovingWithPromptGroup && node.parentPromptId) {
            const parentPrompt = promptNodes.find(p => p.id === node.parentPromptId);
            if (parentPrompt) {
                const childImages = canvas.imageNodes
                    .filter(img => img.parentPromptId === node.parentPromptId)
                    .sort((a, b) => a.timestamp - b.timestamp);

                const layoutMode = parentPrompt.mode === GenerationMode.PPT ? 'column' : 'grid';
                const offset = getSubCardStandardOffset(parentPrompt, childImages, node, layoutMode);

                const finalPos = {
                    x: parentPrompt.position.x + offset.x,
                    y: parentPrompt.position.y + offset.y
                };

                return {
                    ...node,
                    position: snapCanvasPointToGrid(finalPos, { enabled: options?.snapToGrid }),
                    userMoved: node.userMoved,
                };
            }
        }
        if (isDirectlyMovedImage) {
            return {
                ...node,
                position: moveCanvasPoint(node.position, delta, options),
                userMoved: true,
            };
        }
        return node;
    });

    const workflow = canvas.workflow
        ? {
            ...canvas.workflow,
            nodes: canvas.workflow.nodes.map(node => {
                if (selectedSet.has(node.id) && isWorkflowUtilityNodeKind(node.kind)) {
                    return {
                        ...node,
                        position: moveCanvasPoint(node.position, delta, options),
                    };
                }
                return node;
            }),
        }
        : canvas.workflow;

    const currentDrawings = canvas.drawings || [];
    if (currentDrawings.length === 0) {
        return {
            ...canvas,
            promptNodes,
            imageNodes,
            workflow,
            drawings: currentDrawings,
        };
    }

    const parentPromptIdByImageId = new Map<string, string | undefined>();
    imageNodes.forEach((imageNode) => {
        parentPromptIdByImageId.set(imageNode.id, imageNode.parentPromptId);
    });

    const drawings = currentDrawings.map((drawing) => {
        const isBoundToMovedNode = drawing.bindingNodeId && selectedSet.has(drawing.bindingNodeId);
        const isBoundToMovedGroup = drawing.bindingGroupId && selectedSet.has(drawing.bindingGroupId);
        const parentPromptId = drawing.bindingNodeId
            ? parentPromptIdByImageId.get(drawing.bindingNodeId)
            : undefined;
        const isMovingWithParentPrompt = parentPromptId && movedPromptIds.has(parentPromptId);

        if (isBoundToMovedNode || isBoundToMovedGroup || isMovingWithParentPrompt) {
            return {
                ...drawing,
                points: drawing.points.map((p) => ({
                    x: p.x + delta.x,
                    y: p.y + delta.y,
                })),
            };
        }
        return drawing;
    });

    return {
        ...canvas,
        promptNodes,
        imageNodes,
        workflow,
        drawings,
    };
}
