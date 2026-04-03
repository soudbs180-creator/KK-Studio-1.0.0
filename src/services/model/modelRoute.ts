export function decodeModelRouteSuffix(modelId: string): string {
  const rawModelId = String(modelId || '').trim();
  const separatorIndex = rawModelId.indexOf('@');
  if (separatorIndex === -1) {
    return '';
  }

  const rawSuffix = rawModelId.slice(separatorIndex + 1).trim();
  if (!rawSuffix) {
    return '';
  }

  try {
    return decodeURIComponent(rawSuffix).trim().toLowerCase();
  } catch {
    return rawSuffix.toLowerCase();
  }
}

export function isSystemModelRouteSuffix(suffix: string): boolean {
  const normalizedSuffix = String(suffix || '').trim().toLowerCase();
  if (!normalizedSuffix) {
    return false;
  }

  return (
    normalizedSuffix === 'system'
    || normalizedSuffix === 'systemproxy'
    || normalizedSuffix === '12ai'
    || normalizedSuffix === 'builtin'
    || normalizedSuffix.startsWith('system_')
  );
}

export function isSystemModelRoute(modelId: string): boolean {
  return isSystemModelRouteSuffix(decodeModelRouteSuffix(modelId));
}
