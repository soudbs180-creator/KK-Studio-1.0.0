import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';

import { createEcommerceFrameworkRuntimeState } from '../services/ecommerce/frameworkRuntime.ts';
import type {
  EcommerceEditableTaskState,
  EcommerceFrameworkRuntimeState,
  EcommerceGroupSheet,
  PromptNode,
} from '../types';
import { GenerationMode } from '../types';

export type EcommerceFrameworkCanvasSnapshot = {
  promptNodes: PromptNode[];
};

export type EcommerceFrameworkRuntimeStateSnapshot = {
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
  activeFrameworkId: string | null;
  activeGroupSheet: EcommerceGroupSheet | null;
  frameworkRuntime: Record<string, EcommerceFrameworkRuntimeState>;
};

export type SetEcommerceFrameworkRuntimeState = (
  updater: (
    previousState: EcommerceFrameworkRuntimeStateSnapshot,
  ) => Partial<EcommerceFrameworkRuntimeStateSnapshot> | null,
) => void;

export type UpdateFrameworkPromptNode = (node: PromptNode) => void | Promise<void>;
export type ResolveEcommerceFrameworkId = (node?: PromptNode | null) => string | null;
export type UpdateEcommerceFrameworkRuntime = (
  frameworkId: string,
  updater: (current: EcommerceFrameworkRuntimeState) => EcommerceFrameworkRuntimeState,
) => EcommerceFrameworkRuntimeState;
export type SyncEcommerceFrameworkView = (frameworkId: string, activeSheet: EcommerceGroupSheet) => void;

type UpdateEcommerceFrameworkMeta = (
  frameworkId: string,
  patch: Partial<NonNullable<NonNullable<PromptNode['ecommerce']>['frameworkMeta']>>,
) => void;

export interface UseEcommerceFrameworkRuntimeStateDeps {
  activeCanvas: EcommerceFrameworkCanvasSnapshot | null | undefined;
  activeCanvasRef: RefObject<EcommerceFrameworkCanvasSnapshot | null | undefined>;
  ecommerceState: EcommerceFrameworkRuntimeStateSnapshot;
  setEcommerceState: SetEcommerceFrameworkRuntimeState;
  updatePromptNode: UpdateFrameworkPromptNode;
}

export interface UseEcommerceFrameworkRuntimeStateResult {
  ecommerceFrameworkRuntimeRef: RefObject<Record<string, EcommerceFrameworkRuntimeState>>;
  resolveEcommerceFrameworkId: ResolveEcommerceFrameworkId;
  updateEcommerceFrameworkRuntime: UpdateEcommerceFrameworkRuntime;
  syncEcommerceFrameworkView: SyncEcommerceFrameworkView;
  handleActivateEcommerceGroupSheet: (sheet: EcommerceGroupSheet) => void;
}

export type EcommerceFrameworkRuntimeStateView = Pick<
  UseEcommerceFrameworkRuntimeStateResult,
  | 'ecommerceFrameworkRuntimeRef'
  | 'resolveEcommerceFrameworkId'
  | 'updateEcommerceFrameworkRuntime'
  | 'syncEcommerceFrameworkView'
>;

export function useEcommerceFrameworkRuntimeState({
  activeCanvas,
  activeCanvasRef,
  ecommerceState,
  setEcommerceState,
  updatePromptNode,
}: UseEcommerceFrameworkRuntimeStateDeps): UseEcommerceFrameworkRuntimeStateResult {
  const ecommerceFrameworkRuntimeRef = useRef<Record<string, EcommerceFrameworkRuntimeState>>({});

  useEffect(() => {
    ecommerceFrameworkRuntimeRef.current = ecommerceState.frameworkRuntime || {};
  }, [ecommerceState.frameworkRuntime]);

  useEffect(() => {
    const frameworkNodes = (activeCanvas?.promptNodes || []).filter((node) => (
      node.mode === GenerationMode.ECOMMERCE && node.ecommerce?.kind === 'framework'
    ));

    setEcommerceState((previousState) => {
      const nextFrameworkRuntime: Record<string, EcommerceFrameworkRuntimeState> = {};
      const previousFrameworkRuntime = previousState.frameworkRuntime || {};
      let didChange = false;

      frameworkNodes.forEach((frameworkNode) => {
        const existingRuntime = previousFrameworkRuntime[frameworkNode.id];
        if (existingRuntime) {
          nextFrameworkRuntime[frameworkNode.id] = existingRuntime;
          return;
        }

        nextFrameworkRuntime[frameworkNode.id] = createEcommerceFrameworkRuntimeState({
          frameworkId: frameworkNode.id,
          activeSheet: frameworkNode.ecommerce?.frameworkMeta?.activeSheet || frameworkNode.ecommerce?.sourceSheet || '主图',
          config: frameworkNode.ecommerce?.frameworkMeta?.schedulerConfig,
        });
        didChange = true;
      });

      if (!didChange) {
        const previousIds = Object.keys(previousFrameworkRuntime);
        if (previousIds.length !== Object.keys(nextFrameworkRuntime).length) {
          didChange = true;
        } else if (previousIds.some((frameworkId) => !nextFrameworkRuntime[frameworkId])) {
          didChange = true;
        }
      }

      const nextActiveFrameworkId = previousState.activeFrameworkId && nextFrameworkRuntime[previousState.activeFrameworkId]
        ? previousState.activeFrameworkId
        : (frameworkNodes[0]?.id || null);
      const nextActiveGroupSheet = previousState.activeTaskState?.sourceSheet
        || (nextActiveFrameworkId
          ? (previousState.activeGroupSheet || nextFrameworkRuntime[nextActiveFrameworkId]?.activeSheet || null)
          : null);

      if (
        !didChange
        && nextActiveFrameworkId === previousState.activeFrameworkId
        && nextActiveGroupSheet === previousState.activeGroupSheet
      ) {
        return null;
      }

      return {
        frameworkRuntime: nextFrameworkRuntime,
        activeFrameworkId: nextActiveFrameworkId,
        activeGroupSheet: nextActiveGroupSheet,
      };
    });
  }, [activeCanvas, setEcommerceState]);

  const resolveEcommerceFrameworkId = useCallback((node?: PromptNode | null): string | null => {
    if (!node?.ecommerce) {
      return null;
    }

    if (node.ecommerce.kind === 'framework') {
      return node.id;
    }

    return node.ecommerce.frameworkId || null;
  }, []);

  const resolveEcommerceFrameworkNode = useCallback((frameworkId?: string | null): PromptNode | null => {
    if (!frameworkId) {
      return null;
    }

    return activeCanvasRef.current?.promptNodes.find((node) => (
      node.id === frameworkId && node.ecommerce?.kind === 'framework'
    )) || null;
  }, [activeCanvasRef]);

  const updateEcommerceFrameworkMeta = useCallback<UpdateEcommerceFrameworkMeta>((frameworkId, patch) => {
    const frameworkNode = activeCanvasRef.current?.promptNodes.find((node) => (
      node.id === frameworkId && node.ecommerce?.kind === 'framework'
    ));
    if (!frameworkNode?.ecommerce) {
      return;
    }

    void updatePromptNode({
      ...frameworkNode,
      ecommerce: {
        ...frameworkNode.ecommerce,
        frameworkMeta: {
          activeSheet: frameworkNode.ecommerce.frameworkMeta?.activeSheet || frameworkNode.ecommerce.sourceSheet || '主图',
          groupIds: frameworkNode.ecommerce.frameworkMeta?.groupIds,
          taskNodeIds: frameworkNode.ecommerce.frameworkMeta?.taskNodeIds,
          schedulerConfig: frameworkNode.ecommerce.frameworkMeta?.schedulerConfig,
          ...patch,
        },
      },
    });
  }, [activeCanvasRef, updatePromptNode]);

  const updateEcommerceFrameworkRuntime = useCallback<UpdateEcommerceFrameworkRuntime>((frameworkId, updater) => {
    const frameworkNode = resolveEcommerceFrameworkNode(frameworkId);
    const currentRuntime = ecommerceFrameworkRuntimeRef.current[frameworkId]
      || createEcommerceFrameworkRuntimeState({
        frameworkId,
        activeSheet: frameworkNode?.ecommerce?.frameworkMeta?.activeSheet || frameworkNode?.ecommerce?.sourceSheet || '主图',
        config: frameworkNode?.ecommerce?.frameworkMeta?.schedulerConfig,
      });
    const nextRuntime = updater(currentRuntime);

    ecommerceFrameworkRuntimeRef.current = {
      ...ecommerceFrameworkRuntimeRef.current,
      [frameworkId]: nextRuntime,
    };

    setEcommerceState((previousState) => ({
      frameworkRuntime: {
        ...(previousState.frameworkRuntime || {}),
        [frameworkId]: nextRuntime,
      },
    }));

    return nextRuntime;
  }, [resolveEcommerceFrameworkNode, setEcommerceState]);

  const syncEcommerceFrameworkView = useCallback<SyncEcommerceFrameworkView>((frameworkId, activeSheet) => {
    updateEcommerceFrameworkRuntime(frameworkId, (currentRuntime) => ({
      ...currentRuntime,
      activeSheet,
      lastUpdatedAt: Date.now(),
    }));
    updateEcommerceFrameworkMeta(frameworkId, { activeSheet });
  }, [updateEcommerceFrameworkMeta, updateEcommerceFrameworkRuntime]);

  const handleActivateEcommerceGroupSheet = useCallback((sheet: EcommerceGroupSheet): void => {
    setEcommerceState(() => ({
      activeTaskNodeId: null,
      activeTaskState: null,
      activeGroupSheet: sheet,
    }));

    if (ecommerceState.activeFrameworkId) {
      syncEcommerceFrameworkView(ecommerceState.activeFrameworkId, sheet);
    }
  }, [ecommerceState.activeFrameworkId, setEcommerceState, syncEcommerceFrameworkView]);

  return useMemo(() => ({
    ecommerceFrameworkRuntimeRef,
    resolveEcommerceFrameworkId,
    updateEcommerceFrameworkRuntime,
    syncEcommerceFrameworkView,
    handleActivateEcommerceGroupSheet,
  }), [
    handleActivateEcommerceGroupSheet,
    resolveEcommerceFrameworkId,
    syncEcommerceFrameworkView,
    updateEcommerceFrameworkRuntime,
  ]);
}
