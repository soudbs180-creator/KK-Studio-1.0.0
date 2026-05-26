import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { AspectRatio, GenerationMode, type EcommerceEditableTaskState, type GenerationConfig } from '../types';

export interface EcommerceModeRuntimeState {
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
}

export type SetEcommerceModeRuntimeState = (
  updater: (previousState: EcommerceModeRuntimeState) => Partial<EcommerceModeRuntimeState> | null,
) => void;

export interface UseEcommerceModeRuntimeDeps {
  configMode: GenerationConfig['mode'];
  configThinkingMode: GenerationConfig['thinkingMode'];
  setConfig: Dispatch<SetStateAction<GenerationConfig>>;
  setEcommerceRatioOverride: Dispatch<SetStateAction<AspectRatio[] | undefined>>;
  setEcommerceModeRuntimeState: SetEcommerceModeRuntimeState;
}

export interface UseEcommerceModeRuntimeResult {}

const EMPTY_RESULT: UseEcommerceModeRuntimeResult = {};

export function useEcommerceModeRuntime({
  configMode,
  configThinkingMode,
  setConfig,
  setEcommerceRatioOverride,
  setEcommerceModeRuntimeState,
}: UseEcommerceModeRuntimeDeps): UseEcommerceModeRuntimeResult {
  useEffect(() => {
    if (configMode !== GenerationMode.ECOMMERCE) {
      setEcommerceRatioOverride(undefined);
      setEcommerceModeRuntimeState(() => ({
        activeTaskNodeId: null,
        activeTaskState: null,
      }));
      return;
    }

    if (configThinkingMode !== 'high') {
      setConfig((previousConfig) => (
        previousConfig.mode === GenerationMode.ECOMMERCE && previousConfig.thinkingMode !== 'high'
          ? { ...previousConfig, thinkingMode: 'high' }
          : previousConfig
      ));
    }
  }, [
    configMode,
    configThinkingMode,
    setConfig,
    setEcommerceModeRuntimeState,
    setEcommerceRatioOverride,
  ]);

  return EMPTY_RESULT;
}
