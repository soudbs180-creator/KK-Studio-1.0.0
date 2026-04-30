import { useCallback } from 'react';

import { buildCancelledPromptNodePatch } from './buildCancelledPromptNodePatch';
import type { Canvas, PromptNode } from '../types';

export interface UseGenerationRuntimeDeps {
  activeCanvas?: Pick<Canvas, 'promptNodes'> | null;
  updatePromptNode: (node: PromptNode) => void | Promise<void>;
  cancelGenerationRequest: (requestId: string) => void;
  cancelSystemProxyTask: (jobId: string) => Promise<unknown>;
}

export interface UseGenerationRuntimeResult {
  handleCancelGeneration: (id?: string) => Promise<void>;
}

export function useGenerationRuntime({
  activeCanvas,
  updatePromptNode,
  cancelGenerationRequest,
  cancelSystemProxyTask,
}: UseGenerationRuntimeDeps): UseGenerationRuntimeResult {
  const handleCancelGeneration = useCallback(async (id?: string) => {
    const promptNodes = activeCanvas?.promptNodes ?? [];

    if (id) {
      cancelGenerationRequest(id);
      const node = promptNodes.find((candidate) => candidate.id === id);
      if (!node) {
        return;
      }

      if (node.jobId?.startsWith('system_proxy:')) {
        try {
          await cancelSystemProxyTask(node.jobId);
        } catch (error) {
          console.warn('[handleCancelGeneration] 取消系统任务失败:', error);
        }
      }

      updatePromptNode({
        ...node,
        ...buildCancelledPromptNodePatch(node.model),
      });
      return;
    }

    const generatingNodes = promptNodes.filter((node) => node.isGenerating);
    await Promise.allSettled(generatingNodes.map(async (node) => {
      const count = node.parallelCount || 1;
      for (let i = 0; i < count; i += 1) {
        cancelGenerationRequest(`${node.id}-${i}`);
      }

      if (node.jobId?.startsWith('system_proxy:')) {
        try {
          await cancelSystemProxyTask(node.jobId);
        } catch (error) {
          console.warn('[handleCancelGeneration] 批量取消系统任务失败:', error);
        }
      }

      updatePromptNode({
        ...node,
        ...buildCancelledPromptNodePatch(node.model),
      });
    }));
  }, [activeCanvas, updatePromptNode, cancelGenerationRequest, cancelSystemProxyTask]);

  return {
    handleCancelGeneration,
  };
}
