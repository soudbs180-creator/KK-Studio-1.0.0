import { ADMIN_SESSION_TOKEN_HEADER } from '../../../packages/shared/src/index.ts';
import { supabase } from '../../lib/supabase';
import { getStoredAdminSessionToken } from '../api/adminSession';
import type {
  SupabaseActiveCreditProviderRpcGroup,
  SupabaseAdminCreditProviderRpcGroup,
  SupabaseAdminProviderInput,
} from './supabaseAdminFallbackService';

type AdminCreditModelsAction =
  | 'list-active'
  | 'list-admin'
  | 'save'
  | 'delete';

type EdgeFunctionEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string | { message?: string } | null;
};

function resolveEnvelopeErrorMessage(error: EdgeFunctionEnvelope<unknown>['error'], fallback: string): string {
  if (typeof error === 'string') {
    return error.trim() || fallback;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = String(error.message || '').trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

function buildInvokeHeaders(): Record<string, string> | undefined {
  const adminSessionToken = getStoredAdminSessionToken();
  if (!adminSessionToken) {
    return undefined;
  }

  return {
    [ADMIN_SESSION_TOKEN_HEADER]: adminSessionToken,
  };
}

async function invokeAdminCreditModelsEdgeFunction<T>(
  action: AdminCreditModelsAction,
  payload?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-credit-models', {
    body: {
      action,
      ...(payload || {}),
    },
    headers: buildInvokeHeaders(),
  });

  if (error) {
    throw new Error(error.message || 'admin-credit-models function invocation failed.');
  }

  const envelope = (data || {}) as EdgeFunctionEnvelope<T>;
  if (envelope.success !== true) {
    throw new Error(
      resolveEnvelopeErrorMessage(envelope.error, `admin-credit-models action "${action}" failed.`),
    );
  }

  return envelope.data as T;
}

export async function listActiveCreditModelsViaEdgeFunction(): Promise<SupabaseActiveCreditProviderRpcGroup[]> {
  return invokeAdminCreditModelsEdgeFunction<SupabaseActiveCreditProviderRpcGroup[]>('list-active');
}

export async function listAdminCreditProvidersViaEdgeFunction(): Promise<SupabaseAdminCreditProviderRpcGroup[]> {
  return invokeAdminCreditModelsEdgeFunction<SupabaseAdminCreditProviderRpcGroup[]>('list-admin');
}

export async function saveAdminCreditProviderViaEdgeFunction(
  input: SupabaseAdminProviderInput,
): Promise<void> {
  await invokeAdminCreditModelsEdgeFunction('save', {
    input,
  });
}

export async function deleteAdminCreditProviderViaEdgeFunction(providerId: string): Promise<void> {
  await invokeAdminCreditModelsEdgeFunction('delete', {
    providerId,
  });
}
