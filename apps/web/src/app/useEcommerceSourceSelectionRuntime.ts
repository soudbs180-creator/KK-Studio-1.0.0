import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { type AspectRatio, type EcommerceEditableTaskState, type EcommerceGroupSheet } from '../types';

export interface EcommerceSourceSelectionRuntimeState {
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
  activeFrameworkId: string | null;
  activeGroupSheet: EcommerceGroupSheet | null;
}

export type SetEcommerceSourceSelectionRuntimeState = (
  updater: (previousState: EcommerceSourceSelectionRuntimeState) => Partial<EcommerceSourceSelectionRuntimeState> | null,
) => void;

export interface UseEcommerceSourceSelectionRuntimeDeps {
  setEcommerceRatioOverride: Dispatch<SetStateAction<AspectRatio[] | undefined>>;
  setEcommerceSourceSelectionRuntimeState: SetEcommerceSourceSelectionRuntimeState;
}

export interface UseEcommerceSourceSelectionRuntimeResult {
  resetEcommerceSourceSelectionState: () => void;
}

export function useEcommerceSourceSelectionRuntime({
  setEcommerceRatioOverride,
  setEcommerceSourceSelectionRuntimeState,
}: UseEcommerceSourceSelectionRuntimeDeps): UseEcommerceSourceSelectionRuntimeResult {
  const resetEcommerceSourceSelectionState = useCallback(() => {
    setEcommerceRatioOverride(undefined);
    setEcommerceSourceSelectionRuntimeState(() => ({
      activeTaskNodeId: null,
      activeTaskState: null,
      activeFrameworkId: null,
      activeGroupSheet: null,
    }));
  }, [setEcommerceRatioOverride, setEcommerceSourceSelectionRuntimeState]);

  return {
    resetEcommerceSourceSelectionState,
  };
}
