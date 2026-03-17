import { keyManager, getModelMetadata } from '../services/auth/keyManager';

type ProviderDisplayTarget = {
  keySlotId?: string;
  model?: string;
  provider?: string;
  providerLabel?: string;
};

export function resolveDisplayedProviderLabel(target: ProviderDisplayTarget): string {
  const currentLabel = String(target.providerLabel || '').trim();
  const currentProvider = String(target.provider || '').trim();
  const linkedProvider = target.keySlotId ? keyManager.getProviderForKeySlot(target.keySlotId) : undefined;
  const keySlot = target.keySlotId ? keyManager.getKey(target.keySlotId) : undefined;
  const routeLabel = String(linkedProvider?.name || keySlot?.name || '').trim();

  if (!routeLabel) {
    return currentLabel || currentProvider;
  }

  if (!currentLabel || currentLabel === routeLabel) {
    return routeLabel;
  }

  const modelMeta = getModelMetadata(target.model || '') as { provider?: string; providerLabel?: string } | undefined;
  const genericLabels = new Set(
    [currentProvider, modelMeta?.providerLabel, modelMeta?.provider]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase())
  );

  return genericLabels.has(currentLabel.toLowerCase()) ? routeLabel : currentLabel;
}
