import { useCallback, type RefObject } from 'react';

import {
  GenerationMode,
  type EcommerceGroupSheet,
  type MobileResultEntry,
  type MobileSurfaceScreen,
  type PromptNode,
} from '../types';

type EcommerceMobileContinuationCanvasSnapshot = {
  promptNodes: PromptNode[];
};

export interface UseEcommerceMobileContinuationRuntimeDeps {
  activeCanvasRef: RefObject<EcommerceMobileContinuationCanvasSnapshot | null | undefined>;
  activeGroupSheet: EcommerceGroupSheet | null;
  focusWorkspace: () => void;
  setMobileScreen: (screen: MobileSurfaceScreen) => void;
  activatePromptNode: (promptNode: PromptNode) => void;
  handleToggleEcommerceSelected: (node: PromptNode, selected: boolean) => void;
  handleConfirmEcommerceDesktop: (node: PromptNode) => void;
  handleRetryEcommerceModule: (node: PromptNode) => Promise<void>;
  enqueueEcommerceFrameworkNodes: (
    frameworkId: string,
    nodes: PromptNode[],
    phasePreference?: 'desktop' | 'mobile',
  ) => number;
  pumpEcommerceFrameworkQueue: (frameworkId: string) => void;
  syncEcommerceFrameworkView: (frameworkId: string, sourceSheet: EcommerceGroupSheet) => void;
}

export interface UseEcommerceMobileContinuationRuntimeResult {
  handleMobileEditEcommerceTask: (entry: MobileResultEntry) => void;
  handleMobileToggleEcommerceSelected: (entry: MobileResultEntry, selected: boolean) => void;
  handleMobileConfirmEcommerceDesktop: (entry: MobileResultEntry) => void;
  handleMobileGenerateEcommerceMobile: (entry: MobileResultEntry) => void;
}

export function useEcommerceMobileContinuationRuntime({
  activeCanvasRef,
  activeGroupSheet,
  focusWorkspace,
  setMobileScreen,
  activatePromptNode,
  handleToggleEcommerceSelected,
  handleConfirmEcommerceDesktop,
  handleRetryEcommerceModule,
  enqueueEcommerceFrameworkNodes,
  pumpEcommerceFrameworkQueue,
  syncEcommerceFrameworkView,
}: UseEcommerceMobileContinuationRuntimeDeps): UseEcommerceMobileContinuationRuntimeResult {
  const resolveMobileResultPromptNode = useCallback((entry: MobileResultEntry) => {
    const promptNodeId = entry.ecommerceContinuation?.promptNodeId
      || entry.detailEntry?.promptId
      || entry.parentPromptId;
    if (!promptNodeId) {
      return null;
    }

    return activeCanvasRef.current?.promptNodes.find((node) => node.id === promptNodeId) || null;
  }, [activeCanvasRef]);

  const handleMobileEditEcommerceTask = useCallback((entry: MobileResultEntry) => {
    if (!entry.ecommerceContinuation?.canEditTask) {
      return;
    }

    const promptNode = resolveMobileResultPromptNode(entry);
    if (!promptNode || promptNode.mode !== GenerationMode.ECOMMERCE) {
      return;
    }

    activatePromptNode(promptNode);
    focusWorkspace();
    setMobileScreen('home');
  }, [activatePromptNode, focusWorkspace, resolveMobileResultPromptNode, setMobileScreen]);

  const handleMobileToggleEcommerceSelected = useCallback((entry: MobileResultEntry, selected: boolean) => {
    if (!entry.ecommerceContinuation?.canToggleSelection) {
      return;
    }

    const promptNode = resolveMobileResultPromptNode(entry);
    if (!promptNode || promptNode.mode !== GenerationMode.ECOMMERCE) {
      return;
    }

    handleToggleEcommerceSelected(promptNode, selected);
  }, [handleToggleEcommerceSelected, resolveMobileResultPromptNode]);

  const handleMobileConfirmEcommerceDesktop = useCallback((entry: MobileResultEntry) => {
    if (!entry.ecommerceContinuation?.canConfirmDesktop) {
      return;
    }

    const promptNode = resolveMobileResultPromptNode(entry);
    if (!promptNode || promptNode.mode !== GenerationMode.ECOMMERCE) {
      return;
    }

    handleConfirmEcommerceDesktop(promptNode);
  }, [handleConfirmEcommerceDesktop, resolveMobileResultPromptNode]);

  const handleMobileGenerateEcommerceMobile = useCallback((entry: MobileResultEntry) => {
    if (!entry.ecommerceContinuation?.canGenerateMobile) {
      return;
    }

    const promptNode = resolveMobileResultPromptNode(entry);
    if (!promptNode || promptNode.mode !== GenerationMode.ECOMMERCE) {
      return;
    }

    const frameworkId = promptNode.ecommerce?.frameworkId;
    if (frameworkId) {
      const queuedCount = enqueueEcommerceFrameworkNodes(frameworkId, [promptNode], 'mobile');
      if (queuedCount > 0) {
        syncEcommerceFrameworkView(
          frameworkId,
          (promptNode.ecommerce?.sourceSheet || activeGroupSheet || 'A+') as EcommerceGroupSheet,
        );
        pumpEcommerceFrameworkQueue(frameworkId);
        return;
      }
    }

    void handleRetryEcommerceModule(promptNode);
  }, [
    activeGroupSheet,
    enqueueEcommerceFrameworkNodes,
    handleRetryEcommerceModule,
    pumpEcommerceFrameworkQueue,
    resolveMobileResultPromptNode,
    syncEcommerceFrameworkView,
  ]);

  return {
    handleMobileEditEcommerceTask,
    handleMobileToggleEcommerceSelected,
    handleMobileConfirmEcommerceDesktop,
    handleMobileGenerateEcommerceMobile,
  };
}
