import { keyManager, getModelMetadata } from '../services/auth/keyManager';
import { adminModelService } from '../services/model/adminModelService';
import { resolveModelDisplayName } from '../utils/modelDisplayName';

export type PromptModelColorMeta = {
  colorEnd?: string;
  colorSecondary?: string;
  colorStart?: string;
  textColor?: 'white' | 'black';
};

interface PromptModelPresentation {
  colorMeta: PromptModelColorMeta;
  label: string;
  provider?: string;
  providerLabel?: string;
}

export function resolvePromptModelPresentation(
  modelId: string,
  imageSize?: string | null,
): PromptModelPresentation {
  const baseModelId = modelId.split('@')[0];
  const globalModel = keyManager.getGlobalModelList().find((model) => model.id === modelId);
  const systemDisplay = globalModel?.isSystemInternal
    ? adminModelService.getModelDisplayInfo(modelId, imageSize)
    : null;

  return {
    label: systemDisplay?.displayName || resolveModelDisplayName(
      modelId,
      globalModel?.name || getModelMetadata(modelId)?.name || baseModelId,
    ),
    provider: systemDisplay?.provider || globalModel?.provider,
    providerLabel: systemDisplay?.providerName || systemDisplay?.provider || globalModel?.providerLabel,
    colorMeta: {
      colorStart: systemDisplay?.colorStart || globalModel?.colorStart,
      colorEnd: systemDisplay?.colorEnd || globalModel?.colorEnd,
      colorSecondary: systemDisplay?.colorSecondary || globalModel?.colorSecondary,
      textColor: systemDisplay?.textColor || globalModel?.textColor,
    },
  };
}
