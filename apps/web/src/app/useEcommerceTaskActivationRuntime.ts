import { useCallback, type RefObject } from 'react';

import { GenerationMode, type EcommerceEditableTaskState, type EcommerceGroupSheet, type PromptNode } from '../types';

type EcommerceTaskActivationCanvasSnapshot = {
  promptNodes: PromptNode[];
};

export interface EcommerceTaskActivationRuntimeState {
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
  activeGroupSheet: EcommerceGroupSheet | null;
}

export type SetEcommerceTaskActivationRuntimeState = (
  updater: (previousState: EcommerceTaskActivationRuntimeState) => Partial<EcommerceTaskActivationRuntimeState> | null
) => void;

export interface UseEcommerceTaskActivationRuntimeDeps {
  activeCanvasRef: RefObject<EcommerceTaskActivationCanvasSnapshot | null | undefined>;
  ecommerceTaskStates: Record<string, EcommerceEditableTaskState>;
  setEcommerceTaskActivationRuntimeState: SetEcommerceTaskActivationRuntimeState;
  activatePromptNode: (node: PromptNode) => void;
}

export interface UseEcommerceTaskActivationRuntimeResult {
  handleActivateEcommerceTaskBySourceKey: (sourceKey: string) => void;
}

export function useEcommerceTaskActivationRuntime({
  activeCanvasRef,
  ecommerceTaskStates,
  setEcommerceTaskActivationRuntimeState,
  activatePromptNode,
}: UseEcommerceTaskActivationRuntimeDeps): UseEcommerceTaskActivationRuntimeResult {
  const handleActivateEcommerceTaskBySourceKey = useCallback((sourceKey: string) => {
    const targetNode = activeCanvasRef.current?.promptNodes.find((node) => (
      node.mode === GenerationMode.ECOMMERCE
      && node.ecommerce?.sourceRowKey === sourceKey
    ));

    if (targetNode) {
      activatePromptNode(targetNode);
      return;
    }

    const fallbackTask = ecommerceTaskStates[sourceKey];
    if (!fallbackTask) {
      return;
    }

    setEcommerceTaskActivationRuntimeState(() => ({
      activeTaskNodeId: null,
      activeTaskState: fallbackTask,
      activeGroupSheet: fallbackTask.sourceSheet,
    }));
  }, [activatePromptNode, activeCanvasRef, ecommerceTaskStates, setEcommerceTaskActivationRuntimeState]);

  return {
    handleActivateEcommerceTaskBySourceKey,
  };
}
