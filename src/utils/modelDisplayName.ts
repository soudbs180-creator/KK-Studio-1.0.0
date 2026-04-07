const getTrimmedModelId = (modelId?: string | null): string => String(modelId || '').trim();
const KNOWN_MODEL_FAMILY_DISPLAY_NAMES = new Set([
  'nano banana',
  'nano banana 2',
  'nano banana pro',
  'nano banana chat',
]);

export const getBaseModelId = (modelId?: string | null): string => {
  const trimmed = getTrimmedModelId(modelId);
  return trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
};

export const getKnownModelDisplayName = (modelId?: string | null): string | undefined => {
  const lowerBaseId = getBaseModelId(modelId).toLowerCase();
  if (!lowerBaseId) return undefined;

  if (lowerBaseId.includes('gemini-3.1-flash-image') || lowerBaseId.includes('nano-banana-2')) {
    return 'Nano Banana 2';
  }
  if (lowerBaseId.includes('gemini-3-pro-image') || lowerBaseId.includes('nano-banana-pro')) {
    return 'Nano Banana Pro';
  }
  if (lowerBaseId.includes('gemini-2.5-flash-image') || (lowerBaseId.includes('nano-banana') && !lowerBaseId.includes('chat'))) {
    return 'Nano Banana';
  }
  if (lowerBaseId.includes('gemini-2.5-flash')) {
    return 'Nano Banana Chat';
  }

  return undefined;
};

export const isRawModelDisplayName = (modelId?: string | null, displayName?: string | null): boolean => {
  const trimmedDisplayName = String(displayName || '').trim();
  if (!trimmedDisplayName) return true;

  const trimmedModelId = getTrimmedModelId(modelId);
  const baseModelId = getBaseModelId(modelId);
  const lowerDisplayName = trimmedDisplayName.toLowerCase();

  return lowerDisplayName === trimmedModelId.toLowerCase()
    || lowerDisplayName === baseModelId.toLowerCase();
};

export const resolveModelDisplayName = (
  modelId?: string | null,
  preferredName?: string | null,
): string => {
  const trimmedPreferredName = String(preferredName || '').trim();
  const knownDisplayName = getKnownModelDisplayName(modelId);
  const lowerPreferredName = trimmedPreferredName.toLowerCase();

  if (
    knownDisplayName
    && trimmedPreferredName
    && KNOWN_MODEL_FAMILY_DISPLAY_NAMES.has(lowerPreferredName)
    && lowerPreferredName !== knownDisplayName.toLowerCase()
  ) {
    return knownDisplayName;
  }

  if (trimmedPreferredName && !isRawModelDisplayName(modelId, trimmedPreferredName)) {
    return trimmedPreferredName;
  }

  if (knownDisplayName) {
    return knownDisplayName;
  }

  return trimmedPreferredName || getBaseModelId(modelId);
};
