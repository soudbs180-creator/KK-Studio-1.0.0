import { useCallback, type RefObject } from 'react';

import { keyManager } from '../services/auth/keyManager.ts';
import { resolveProviderKeyType } from '../services/api/providerStrategy.ts';
import {
  cancelEcommerceFrameworkNodeQueue,
  enqueueEcommerceFrameworkItems,
  markEcommerceFrameworkQueueItemStatus,
  pauseEcommerceFrameworkRuntime,
  resolveEcommerceFrameworkDispatchPlan,
  resolveFrameworkLane,
  resumeEcommerceFrameworkRuntime,
} from '../services/ecommerce/frameworkRuntime.ts';
import { GenerationMode, type EcommerceFrameworkQueueItem, type EcommerceFrameworkRuntimeState, type EcommerceGroupSheet, type PromptNode } from '../types.ts';
import {
  applyEcommerceAnalysisSelectionState,
  applyEcommerceGroupSelectionState,
  applyEcommerceNodeSelectionState,
  resolveEcommerceGroupSelectionTargets,
  type EcommerceSelectionRuntimeState,
} from './ecommerceSelectionRuntime.ts';

type EcommerceCanvasSnapshot = {
  promptNodes: PromptNode[];
};

type EcommerceRuntimeStateSnapshot = {
  activeGroupSheet: EcommerceGroupSheet | null;
};

type UpdateEcommerceFrameworkRuntime = (
  frameworkId: string,
  updater: (current: EcommerceFrameworkRuntimeState) => EcommerceFrameworkRuntimeState,
) => EcommerceFrameworkRuntimeState;

type ResolveEcommerceFrameworkId = (node?: PromptNode | null) => string | null;
type SyncEcommerceFrameworkView = (frameworkId: string, activeSheet: EcommerceGroupSheet) => void;
type GenerateEcommerceNode = (node: PromptNode) => Promise<void>;
type RetryEcommerceModule = (node: PromptNode) => Promise<void>;
type UpdateEcommerceNodeState = (
  nodeId: string,
  patch: Partial<NonNullable<PromptNode['ecommerce']>>,
  nodePatch?: Partial<PromptNode>,
) => void;
export type UpdateEcommerceSelectionState = (
  updater: (previousState: EcommerceSelectionRuntimeState) => Partial<EcommerceSelectionRuntimeState>,
) => void;

export interface UseEcommerceRuntimeDeps {
  activeCanvasRef: RefObject<EcommerceCanvasSnapshot | null | undefined>;
  ecommerceFrameworkRuntimeRef: RefObject<Record<string, EcommerceFrameworkRuntimeState>>;
  ecommerceState: EcommerceRuntimeStateSnapshot;
  updateEcommerceSelectionState: UpdateEcommerceSelectionState;
  updateEcommerceNodeState: UpdateEcommerceNodeState;
  updateEcommerceFrameworkRuntime: UpdateEcommerceFrameworkRuntime;
  resolveEcommerceFrameworkId: ResolveEcommerceFrameworkId;
  syncEcommerceFrameworkView: SyncEcommerceFrameworkView;
  handleGenerateEcommerceNode: GenerateEcommerceNode;
  handleRetryEcommerceModule: RetryEcommerceModule;
}

export interface UseEcommerceRuntimeResult {
  resolveEcommerceFrameworkQueuePhases: (
    node: PromptNode,
    phasePreference?: 'desktop' | 'mobile',
  ) => EcommerceFrameworkQueueItem['phase'][];
  enqueueEcommerceFrameworkNodes: (
    frameworkId: string,
    nodes: PromptNode[],
    phasePreference?: 'desktop' | 'mobile',
  ) => number;
  pumpEcommerceFrameworkQueue: (frameworkId: string) => void;
  handleGenerateEcommerceFramework: (node: PromptNode) => Promise<void>;
  handlePauseEcommerceFramework: (node: PromptNode) => void;
  handleResumeEcommerceFramework: (node: PromptNode) => void;
  handleCancelEcommerceFrameworkNodeQueue: (node: PromptNode) => void;
  handleGenerateEcommerceGroup: (node: PromptNode, phase: 'desktop' | 'mobile') => Promise<void>;
  handleToggleEcommerceAnalysisSelection: (id: string, selected: boolean) => void;
  handleToggleEcommerceSelected: (node: PromptNode, selected: boolean) => void;
  handleSetEcommerceGroupSelection: (groupNode: PromptNode, selected: boolean) => void;
}

export function useEcommerceRuntime({
  activeCanvasRef,
  ecommerceFrameworkRuntimeRef,
  ecommerceState,
  updateEcommerceSelectionState,
  updateEcommerceNodeState,
  updateEcommerceFrameworkRuntime,
  resolveEcommerceFrameworkId,
  syncEcommerceFrameworkView,
  handleGenerateEcommerceNode,
  handleRetryEcommerceModule,
}: UseEcommerceRuntimeDeps): UseEcommerceRuntimeResult {
  const handleToggleEcommerceAnalysisSelection = useCallback((id: string, selected: boolean): void => {
    updateEcommerceSelectionState((previousState) => applyEcommerceAnalysisSelectionState(previousState, id, selected));
  }, [updateEcommerceSelectionState]);

  const handleToggleEcommerceSelected = useCallback((node: PromptNode, selected: boolean): void => {
    if (!node.ecommerce) return;

    updateEcommerceNodeState(node.id, { selectedForGeneration: selected });
    updateEcommerceSelectionState((previousState) => applyEcommerceNodeSelectionState(previousState, node, selected));
  }, [updateEcommerceNodeState, updateEcommerceSelectionState]);

  const handleSetEcommerceGroupSelection = useCallback((groupNode: PromptNode, selected: boolean): void => {
    if (!groupNode.ecommerce || groupNode.ecommerce.kind !== 'a-plus-group') {
      return;
    }

    const childNodes = resolveEcommerceGroupSelectionTargets(activeCanvasRef.current?.promptNodes, groupNode);
    childNodes.forEach((node) => {
      updateEcommerceNodeState(node.id, { selectedForGeneration: selected });
    });

    updateEcommerceSelectionState((previousState) => applyEcommerceGroupSelectionState(previousState, groupNode, childNodes, selected));
  }, [activeCanvasRef, updateEcommerceNodeState, updateEcommerceSelectionState]);

  const resolveEcommerceFrameworkQueuePhases = useCallback((
    node: PromptNode,
    phasePreference?: 'desktop' | 'mobile',
  ): EcommerceFrameworkQueueItem['phase'][] => {
    const ecommerce = node.ecommerce;
    if (!ecommerce || ecommerce.selectedForGeneration === false) {
      return [];
    }

    if (ecommerce.kind === 'main-image') {
      if (phasePreference === 'mobile') {
        return [];
      }

      return (ecommerce.stage === 'analysis_ready' || ecommerce.stage === 'ready' || ecommerce.stage === 'failed')
        ? ['sheet']
        : [];
    }

    if (ecommerce.kind !== 'a-plus-module') {
      return [];
    }

    const effectiveSizePolicy = ecommerce.effectiveSizePolicy || ecommerce.sizePolicy;
    const requiresMobileFollowUp = effectiveSizePolicy === 'desktop-then-mobile';

    if (phasePreference === 'mobile') {
      return ecommerce.desktopStage === 'confirmed'
        && (ecommerce.mobileStage === 'pending' || ecommerce.mobileStage === 'failed' || ecommerce.mobileStage === 'locked')
        ? ['mobile']
        : [];
    }

    if (phasePreference === 'desktop') {
      if (requiresMobileFollowUp) {
        return ecommerce.desktopStage === 'pending' || ecommerce.desktopStage === 'failed'
          ? ['desktop']
          : [];
      }

      return ecommerce.stage === 'analysis_ready' || ecommerce.stage === 'ready' || ecommerce.stage === 'failed'
        ? ['sheet']
        : [];
    }

    if (requiresMobileFollowUp) {
      if (ecommerce.desktopStage === 'confirmed' && (ecommerce.mobileStage === 'pending' || ecommerce.mobileStage === 'failed')) {
        return ['mobile'];
      }

      return ecommerce.desktopStage === 'pending' || ecommerce.desktopStage === 'failed'
        ? ['desktop']
        : [];
    }

    return (ecommerce.stage === 'analysis_ready' || ecommerce.stage === 'ready' || ecommerce.stage === 'failed')
      ? ['sheet']
      : [];
  }, []);

  const enqueueEcommerceFrameworkNodes = useCallback((
    frameworkId: string,
    nodes: PromptNode[],
    phasePreference?: 'desktop' | 'mobile',
  ): number => {
    const queueItems: Array<Pick<EcommerceFrameworkQueueItem, 'queueId' | 'nodeId' | 'phase' | 'laneKey' | 'laneType' | 'sourceSheet'>> = [];

    (nodes || []).forEach((node) => {
      const ecommerce = node.ecommerce;
      if (!ecommerce) {
        return;
      }

      const phases = resolveEcommerceFrameworkQueuePhases(node, phasePreference);
      if (phases.length === 0) {
        return;
      }

      const resolvedKey = keyManager.getNextKey(node.model, node.keySlotId);
      const provider = resolvedKey?.provider || node.provider;
      const baseUrl = resolvedKey?.baseUrl || resolvedKey?.providerConfig?.baseUrl;
      const providerKeyType = resolveProviderKeyType(provider, baseUrl);
      const lane = resolveFrameworkLane({
        keySlotId: resolvedKey?.id || node.keySlotId || providerKeyType,
        provider,
        baseUrl,
      });

      phases.forEach((phase) => {
        queueItems.push({
          queueId: `${frameworkId}:${node.id}:${phase}:${Date.now()}:${queueItems.length}`,
          nodeId: node.id,
          phase,
          laneKey: lane.laneKey,
          laneType: lane.laneType,
          sourceSheet: ecommerce.sourceSheet,
        });
      });
    });

    if (queueItems.length === 0) {
      return 0;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (currentRuntime) => enqueueEcommerceFrameworkItems(currentRuntime, queueItems));
    return queueItems.length;
  }, [resolveEcommerceFrameworkQueuePhases, updateEcommerceFrameworkRuntime]);

  const pumpEcommerceFrameworkQueue = useCallback((frameworkId: string): void => {
    const currentRuntime = ecommerceFrameworkRuntimeRef.current[frameworkId];
    if (!currentRuntime || currentRuntime.paused) {
      return;
    }

    const starters = resolveEcommerceFrameworkDispatchPlan(currentRuntime);
    if (starters.length === 0) {
      return;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (runtime) => {
      let nextRuntime = runtime;
      starters.forEach((item) => {
        nextRuntime = markEcommerceFrameworkQueueItemStatus(nextRuntime, item.queueId, 'dispatching');
      });
      return nextRuntime;
    });

    starters.forEach((item) => {
      void (async () => {
        updateEcommerceFrameworkRuntime(frameworkId, (runtime) => markEcommerceFrameworkQueueItemStatus(runtime, item.queueId, 'running', {
          startedAt: Date.now(),
          error: undefined,
        }));

        try {
          const latestNode = activeCanvasRef.current?.promptNodes.find((promptNode) => promptNode.id === item.nodeId);
          if (!latestNode?.ecommerce) {
            throw new Error('Missing ecommerce node');
          }

          if (item.phase === 'mobile') {
            await handleRetryEcommerceModule(latestNode);
          } else {
            await handleGenerateEcommerceNode(latestNode);
          }

          updateEcommerceFrameworkRuntime(frameworkId, (runtime) => markEcommerceFrameworkQueueItemStatus(runtime, item.queueId, 'completed', {
            finishedAt: Date.now(),
            error: undefined,
          }));
        } catch (error: unknown) {
          updateEcommerceFrameworkRuntime(frameworkId, (runtime) => markEcommerceFrameworkQueueItemStatus(runtime, item.queueId, 'failed', {
            finishedAt: Date.now(),
            error: error instanceof Error ? error.message : 'Queue item failed',
          }));
        } finally {
          setTimeout(() => {
            pumpEcommerceFrameworkQueue(frameworkId);
          }, 0);
        }
      })();
    });
  }, [activeCanvasRef, ecommerceFrameworkRuntimeRef, handleGenerateEcommerceNode, handleRetryEcommerceModule, updateEcommerceFrameworkRuntime]);

  const handleGenerateEcommerceFramework = useCallback(async (node: PromptNode): Promise<void> => {
    if (!node.ecommerce || node.ecommerce.kind !== 'framework') return;

    const targetNodes = (activeCanvasRef.current?.promptNodes || []).filter((item) => (
      item.mode === GenerationMode.ECOMMERCE
      && !!item.ecommerce
      && item.ecommerce.kind !== 'framework'
      && item.ecommerce.kind !== 'a-plus-group'
      && item.ecommerce.frameworkId === node.id
      && item.ecommerce.selectedForGeneration !== false
    ));

    const queuedCount = enqueueEcommerceFrameworkNodes(node.id, targetNodes);
    if (queuedCount === 0) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.warning('No eligible cards', 'There are no ecommerce cards ready to enqueue.');
      });
      return;
    }

    const nextSheet = node.ecommerce.frameworkMeta?.activeSheet || ecommerceState.activeGroupSheet || '主图';
    syncEcommerceFrameworkView(node.id, nextSheet);
    pumpEcommerceFrameworkQueue(node.id);
  }, [activeCanvasRef, ecommerceState.activeGroupSheet, enqueueEcommerceFrameworkNodes, pumpEcommerceFrameworkQueue, syncEcommerceFrameworkView]);

  const handlePauseEcommerceFramework = useCallback((node: PromptNode): void => {
    const frameworkId = resolveEcommerceFrameworkId(node);
    if (!frameworkId) {
      return;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (runtime) => pauseEcommerceFrameworkRuntime(runtime));
  }, [resolveEcommerceFrameworkId, updateEcommerceFrameworkRuntime]);

  const handleResumeEcommerceFramework = useCallback((node: PromptNode): void => {
    const frameworkId = resolveEcommerceFrameworkId(node);
    if (!frameworkId) {
      return;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (runtime) => resumeEcommerceFrameworkRuntime(runtime));
    pumpEcommerceFrameworkQueue(frameworkId);
  }, [pumpEcommerceFrameworkQueue, resolveEcommerceFrameworkId, updateEcommerceFrameworkRuntime]);

  const handleCancelEcommerceFrameworkNodeQueue = useCallback((node: PromptNode): void => {
    const frameworkId = resolveEcommerceFrameworkId(node);
    if (!frameworkId) {
      return;
    }

    updateEcommerceFrameworkRuntime(frameworkId, (runtime) => cancelEcommerceFrameworkNodeQueue(runtime, node.id));
  }, [resolveEcommerceFrameworkId, updateEcommerceFrameworkRuntime]);

  const handleGenerateEcommerceGroup = useCallback(async (node: PromptNode, phase: 'desktop' | 'mobile'): Promise<void> => {
    if (!node.ecommerce || node.ecommerce.kind !== 'a-plus-group') return;

    const frameworkId = node.ecommerce.frameworkId;
    const targetNodes = (activeCanvasRef.current?.promptNodes || []).filter((item) => (
      item.mode === GenerationMode.ECOMMERCE
      && !!item.ecommerce
      && item.ecommerce.kind !== 'framework'
      && item.ecommerce.kind !== 'a-plus-group'
      && item.ecommerce.groupId === node.id
      && item.ecommerce.selectedForGeneration !== false
    ));

    if (!frameworkId) {
      for (const targetNode of targetNodes) {
        if (phase === 'mobile') {
          await handleRetryEcommerceModule(targetNode);
        } else {
          await handleGenerateEcommerceNode(targetNode);
        }
      }
      return;
    }

    const queuedCount = enqueueEcommerceFrameworkNodes(frameworkId, targetNodes, phase);
    if (queuedCount === 0) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.warning(
          'No eligible cards',
          phase === 'mobile'
            ? 'There are no confirmed mobile follow-up cards ready to enqueue.'
            : 'There are no ecommerce cards ready to enqueue for this group.',
        );
      });
      return;
    }

    syncEcommerceFrameworkView(frameworkId, node.ecommerce.sourceSheet);
    pumpEcommerceFrameworkQueue(frameworkId);
  }, [activeCanvasRef, enqueueEcommerceFrameworkNodes, handleGenerateEcommerceNode, handleRetryEcommerceModule, pumpEcommerceFrameworkQueue, syncEcommerceFrameworkView]);

  return {
    resolveEcommerceFrameworkQueuePhases,
    enqueueEcommerceFrameworkNodes,
    pumpEcommerceFrameworkQueue,
    handleGenerateEcommerceFramework,
    handlePauseEcommerceFramework,
    handleResumeEcommerceFramework,
    handleCancelEcommerceFrameworkNodeQueue,
    handleGenerateEcommerceGroup,
    handleToggleEcommerceAnalysisSelection,
    handleToggleEcommerceSelected,
    handleSetEcommerceGroupSelection,
  };
}
