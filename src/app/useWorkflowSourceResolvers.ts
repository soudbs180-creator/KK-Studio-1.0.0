import React from 'react';

import type { Canvas, GeneratedImage, PromptNode } from '../types';
import type { WorkflowUtilityCanvasNode } from './appCanvasTypes';

interface UseWorkflowSourceResolversArgs {
  activeCanvas: Canvas | undefined;
  selectedNodeIds: string[];
  activeSourceImage: string | null;
  promptNodesById: Map<string, PromptNode>;
  imageNodesById: Map<string, GeneratedImage>;
  workflowUtilityNodesById: Map<string, WorkflowUtilityCanvasNode>;
  resolveCurrentPromptChildImages: (promptNode: PromptNode, imageNodes: GeneratedImage[]) => GeneratedImage[];
}

function findFirstResolved<T>(
  sourceNodeIds: string[] | undefined,
  resolver: (nodeId: string) => T | null | undefined,
): T | null {
  for (const nodeId of sourceNodeIds || []) {
    const resolved = resolver(nodeId);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export function useWorkflowSourceResolvers({
  activeCanvas,
  selectedNodeIds,
  activeSourceImage,
  promptNodesById,
  imageNodesById,
  workflowUtilityNodesById,
  resolveCurrentPromptChildImages,
}: UseWorkflowSourceResolversArgs) {
  const getPromptChildrenForWorkflow = React.useCallback((promptNode: PromptNode | undefined | null) => {
    if (!promptNode || !activeCanvas) {
      return [] as GeneratedImage[];
    }

    return resolveCurrentPromptChildImages(promptNode, activeCanvas.imageNodes);
  }, [activeCanvas, resolveCurrentPromptChildImages]);

  const resolveWorkflowSourceIdsFromSelection = React.useCallback(() => {
    const explicitIds = selectedNodeIds.filter((nodeId) => (
      promptNodesById.has(nodeId) || imageNodesById.has(nodeId)
    ));

    if (explicitIds.length > 0) {
      return Array.from(new Set(explicitIds));
    }

    return activeSourceImage ? [activeSourceImage] : [];
  }, [activeSourceImage, imageNodesById, promptNodesById, selectedNodeIds]);

  const resolveParentPromptForImage = React.useCallback((imageNode: GeneratedImage | null | undefined) => {
    if (!imageNode?.parentPromptId) {
      return null;
    }

    return promptNodesById.get(imageNode.parentPromptId) ?? null;
  }, [promptNodesById]);

  const resolveCanvasNodePosition = React.useCallback((nodeId?: string | null) => {
    if (!nodeId) {
      return null;
    }

    const promptNode = promptNodesById.get(nodeId);
    if (promptNode) {
      return promptNode.position;
    }

    const imageNode = imageNodesById.get(nodeId);
    if (imageNode) {
      return imageNode.position;
    }

    return workflowUtilityNodesById.get(nodeId)?.position || null;
  }, [imageNodesById, promptNodesById, workflowUtilityNodesById]);

  const resolvePrimaryWorkflowSourcePrompt = React.useCallback((sourceNodeIds?: string[]) => {
    const directPrompt = findFirstResolved(sourceNodeIds, (nodeId) => promptNodesById.get(nodeId));
    if (directPrompt) {
      return directPrompt;
    }

    const parentPrompt = findFirstResolved(
      sourceNodeIds,
      (nodeId) => resolveParentPromptForImage(imageNodesById.get(nodeId) ?? null),
    );
    if (parentPrompt) {
      return parentPrompt;
    }

    const fallbackId = resolveWorkflowSourceIdsFromSelection()[0];
    if (!fallbackId) {
      return null;
    }

    return (
      promptNodesById.get(fallbackId)
      ?? resolveParentPromptForImage(imageNodesById.get(fallbackId) ?? null)
      ?? null
    );
  }, [imageNodesById, promptNodesById, resolveParentPromptForImage, resolveWorkflowSourceIdsFromSelection]);

  const resolvePrimaryWorkflowSourceImage = React.useCallback((sourceNodeIds?: string[]) => {
    const directImage = findFirstResolved(sourceNodeIds, (nodeId) => imageNodesById.get(nodeId));
    if (directImage) {
      return directImage;
    }

    const promptNode = findFirstResolved(sourceNodeIds, (nodeId) => promptNodesById.get(nodeId));
    if (promptNode) {
      const children = getPromptChildrenForWorkflow(promptNode);
      if (children.length > 0) {
        return children[0];
      }
    }

    if (activeSourceImage) {
      return imageNodesById.get(activeSourceImage) ?? null;
    }

    const fallbackId = resolveWorkflowSourceIdsFromSelection()[0];
    if (!fallbackId) {
      return null;
    }

    return imageNodesById.get(fallbackId) ?? null;
  }, [
    activeSourceImage,
    getPromptChildrenForWorkflow,
    imageNodesById,
    promptNodesById,
    resolveWorkflowSourceIdsFromSelection,
  ]);

  const resolveWorkflowLinkedImages = React.useCallback((sourceNodeIds?: string[]) => {
    const linkedImages = (sourceNodeIds || [])
      .map((nodeId) => imageNodesById.get(nodeId))
      .filter((imageNode): imageNode is GeneratedImage => Boolean(imageNode));

    const sourcePrompt = resolvePrimaryWorkflowSourcePrompt(sourceNodeIds);

    return Array.from(new Set([
      ...linkedImages,
      ...(sourcePrompt ? getPromptChildrenForWorkflow(sourcePrompt) : []),
    ]));
  }, [getPromptChildrenForWorkflow, imageNodesById, resolvePrimaryWorkflowSourcePrompt]);

  return {
    getPromptChildrenForWorkflow,
    resolveWorkflowSourceIdsFromSelection,
    resolveCanvasNodePosition,
    resolvePrimaryWorkflowSourcePrompt,
    resolvePrimaryWorkflowSourceImage,
    resolveWorkflowLinkedImages,
  };
}
