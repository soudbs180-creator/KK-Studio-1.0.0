import { useCallback, type RefObject } from 'react';

import { resolveEcommerceFrameworkSummary } from '../services/ecommerce/frameworkRuntime.ts';
import type { ResolveEcommerceFrameworkId, SyncEcommerceFrameworkView } from './useEcommerceFrameworkRuntimeState.ts';
import {
  GenerationMode,
  type AspectRatio,
  type EcommerceEditableTaskState,
  type EcommerceFrameworkRuntimeState,
  type EcommerceGroupSheet,
  type PromptNode,
} from '../types.ts';

type EcommercePromptActivationCanvasSnapshot = {
  promptNodes: PromptNode[];
};

export interface EcommercePromptActivationRuntimeState {
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
  activeFrameworkId: string | null;
  activeGroupSheet: EcommerceGroupSheet | null;
}

export type SetEcommercePromptActivationRuntimeState = (
  updater: (
    previousState: EcommercePromptActivationRuntimeState,
  ) => Partial<EcommercePromptActivationRuntimeState> | null
) => void;

export interface UseEcommercePromptActivationRuntimeDeps {
  activeCanvasRef: RefObject<EcommercePromptActivationCanvasSnapshot | null | undefined>;
  ecommerceFrameworkRuntimeRef: RefObject<Record<string, EcommerceFrameworkRuntimeState>>;
  setEcommercePromptActivationRuntimeState: SetEcommercePromptActivationRuntimeState;
  setEcommerceRatioOverride: (ratioOverride: AspectRatio[] | undefined) => void;
  resolveEcommerceFrameworkId: ResolveEcommerceFrameworkId;
  syncEcommerceFrameworkView: SyncEcommerceFrameworkView;
}

export interface UseEcommercePromptActivationRuntimeResult {
  syncPromptNodeEcommerceSelection: (clickedNode: PromptNode) => void;
  resolvePromptNodeFrameworkStatus: (node: PromptNode) => ReturnType<typeof resolveEcommerceFrameworkSummary> | null;
}

export function useEcommercePromptActivationRuntime({
  activeCanvasRef,
  ecommerceFrameworkRuntimeRef,
  setEcommercePromptActivationRuntimeState,
  setEcommerceRatioOverride,
  resolveEcommerceFrameworkId,
  syncEcommerceFrameworkView,
}: UseEcommercePromptActivationRuntimeDeps): UseEcommercePromptActivationRuntimeResult {
  const syncPromptNodeEcommerceSelection = useCallback((clickedNode: PromptNode) => {
    const ecommerceTaskState = clickedNode.ecommerce?.editableTask
      || clickedNode.partialRedraw?.inheritedTaskState
      || null;
    const nextFrameworkId = clickedNode.mode === GenerationMode.ECOMMERCE
      ? resolveEcommerceFrameworkId(clickedNode)
      : null;
    const nextActiveSheet = clickedNode.mode === GenerationMode.ECOMMERCE
      ? (clickedNode.ecommerce?.kind === 'framework'
        ? (clickedNode.ecommerce.frameworkMeta?.activeSheet || clickedNode.ecommerce.sourceSheet || null)
        : (clickedNode.ecommerce?.sourceSheet || null))
      : null;

    setEcommerceRatioOverride(clickedNode.ecommerce?.allowedAspectRatios);
    setEcommercePromptActivationRuntimeState(() => ({
      activeTaskNodeId: clickedNode.mode === GenerationMode.ECOMMERCE && clickedNode.ecommerce?.kind !== 'framework'
        ? clickedNode.id
        : null,
      activeTaskState: clickedNode.mode === GenerationMode.ECOMMERCE && clickedNode.ecommerce?.kind !== 'framework'
        ? ecommerceTaskState
        : null,
      activeFrameworkId: nextFrameworkId,
      activeGroupSheet: nextActiveSheet,
    }));

    if (nextFrameworkId && nextActiveSheet) {
      syncEcommerceFrameworkView(nextFrameworkId, nextActiveSheet);
    }
  }, [
    resolveEcommerceFrameworkId,
    setEcommercePromptActivationRuntimeState,
    setEcommerceRatioOverride,
    syncEcommerceFrameworkView,
  ]);

  const resolvePromptNodeFrameworkStatus = useCallback((node: PromptNode) => {
    const frameworkId = resolveEcommerceFrameworkId(node);
    if (!frameworkId) {
      return null;
    }

    return resolveEcommerceFrameworkSummary(
      activeCanvasRef.current?.promptNodes || [],
      frameworkId,
      ecommerceFrameworkRuntimeRef.current[frameworkId],
    );
  }, [activeCanvasRef, ecommerceFrameworkRuntimeRef, resolveEcommerceFrameworkId]);

  return {
    syncPromptNodeEcommerceSelection,
    resolvePromptNodeFrameworkStatus,
  };
}
