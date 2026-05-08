const SECRET_UPDATE_FIELDS = new Set([
  'key',
  'apiKey',
  'api_key',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
]);

export interface KeyUpdateDiagnosticPayload {
  id: string;
  updatedFields: string[];
  hasKeyUpdate: boolean;
  hasSupportedModelsUpdate: boolean;
  supportedModelsBefore: unknown;
}

export function buildKeyUpdateDiagnosticPayload(
  id: string,
  updates: object,
  supportedModelsBefore: unknown,
): KeyUpdateDiagnosticPayload {
  const updatedFields = Object.keys(updates).sort();

  return {
    id,
    updatedFields,
    hasKeyUpdate: updatedFields.some((field) => SECRET_UPDATE_FIELDS.has(field)),
    hasSupportedModelsUpdate: Object.prototype.hasOwnProperty.call(updates, 'supportedModels'),
    supportedModelsBefore,
  };
}
