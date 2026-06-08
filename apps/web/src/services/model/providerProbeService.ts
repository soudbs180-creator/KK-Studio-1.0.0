import { getPreferredKkApiAccessToken, refreshPreferredKkApiAccessToken } from '../api/authAccessToken.ts';
import { getStoredAdminSessionToken } from '../api/adminSession.ts';
import { resolveKkApiBaseUrl } from '../api/kkApiClient.ts';

export type ProviderProbeOwnerKind = 'admin' | 'user';

export interface ProviderProbeRequest {
  providerName?: string;
  providerHint?: string;
  providerKind?: 'official' | 'relay';
  baseUrl: string;
  apiKey: string;
  modelId?: string;
  endpointType?: string;
  requestProfileId?: string;
}

export interface ProviderProbeModel {
  id: string;
  displayName: string;
}

export interface ProviderProbeDiagnostic {
  step: string;
  ok?: boolean;
  status?: number;
  url?: string;
  reason?: string;
  error?: string;
}

export interface ProviderProbeResult {
  ok: boolean;
  confidence: number;
  providerKind: 'official' | 'relay';
  adapterId: string;
  requestProfileId: string;
  protocolFamily?: string;
  normalizedBaseUrl: string;
  models: ProviderProbeModel[];
  warnings: string[];
  diagnostics: ProviderProbeDiagnostic[];
  ownerKind: ProviderProbeOwnerKind;
  billingMode: 'system-credit-before-request' | 'user-owned-api-no-system-credit';
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

async function readAccessToken(): Promise<string> {
  const existing = String(await getPreferredKkApiAccessToken() || '').trim();
  if (existing) return existing;
  return String(await refreshPreferredKkApiAccessToken() || '').trim();
}

function normalizeBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

async function postProbe(
  ownerKind: ProviderProbeOwnerKind,
  payload: ProviderProbeRequest,
): Promise<ProviderProbeResult> {
  const accessToken = await readAccessToken();
  const path = ownerKind === 'admin'
    ? 'api/v1/admin/provider-probe'
    : 'api/v1/profile/provider-probe';
  const url = new URL(path, `${normalizeBaseUrl(resolveKkApiBaseUrl())}/`);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(ownerKind === 'admin' ? { 'x-admin-session-token': getStoredAdminSessionToken() || '' } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const envelope = await response.json().catch(() => null) as ApiEnvelope<ProviderProbeResult> | null;
  if (!response.ok || !envelope?.success || !envelope.data) {
    const message = envelope?.error?.message
      || (envelope as any)?.error
      || `供应商连接探测失败 (${response.status})`;
    throw new Error(String(message));
  }

  return envelope.data;
}

export async function probeAdminProvider(payload: ProviderProbeRequest): Promise<ProviderProbeResult> {
  return postProbe('admin', payload);
}

export async function probeUserProvider(payload: ProviderProbeRequest): Promise<ProviderProbeResult> {
  return postProbe('user', payload);
}

export function mapProbeResultToProviderModels(result: ProviderProbeResult, defaultCreditCost = 1) {
  return result.models.map((model, index) => ({
    modelId: model.id,
    displayName: model.displayName || model.id,
    description: result.requestProfileId ? `自动识别协议：${result.requestProfileId}` : '',
    endpointType: result.adapterId || 'openai_chat_completions',
    requestProfileId: result.requestProfileId,
    creditCost: defaultCreditCost,
    advancedEnabled: false,
    mixWithSameModel: false,
    qualityPricing: {},
    priority: Math.max(0, 100 - index),
    weight: 1,
    isActive: true,
    color: '#3B82F6',
    colorSecondary: null,
    textColor: 'white' as const,
    maxCallsLimit: null,
    autoPauseOnLimit: false,
  }));
}
