/**
 * Compatibility facade for legacy user API key consumers.
 *
 * Canonical storage now lives behind the authenticated cloud-record API
 * surface, so this service keeps the old shape while delegating mutations to
 * the shared runtime storage layer.
 */

import {
  addUserApiKey as addProfileUserApiKey,
  deleteApiKey as deleteProfileApiKey,
  getUserApiKeys as getProfileUserApiKeys,
  type ApiProvider,
} from '../security/apiKeySecureStorage';
import { loadUserApiEntries, mutateUserApiEntries } from './userApiProfileStorage';

export interface UserApiKey {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  api_key_encrypted: string;
  base_url?: string;
  is_active: boolean;
  call_count: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface ModelRoute {
  route_type: 'user_key' | 'admin_model' | 'none';
  provider_id: string | null;
  base_url: string | null;
  api_key: string | null;
  model_id: string | null;
  endpoint_type: string | null;
  credit_cost: number | null;
  user_pays: number | null;
}

class UserApiKeyService {
  async getUserApiKeys(): Promise<UserApiKey[]> {
    const keys = await getProfileUserApiKeys();

    return keys.map((key) => ({
      id: key.id,
      user_id: '',
      name: key.name,
      provider: key.provider,
      api_key_encrypted: key.key_status,
      base_url: key.base_url || undefined,
      is_active: key.is_active,
      call_count: 0,
      total_cost: 0,
      created_at: key.created_at,
      updated_at: key.created_at,
    }));
  }

  async addUserApiKey(
    name: string,
    provider: string,
    apiKey: string,
    baseUrl?: string,
  ): Promise<UserApiKey> {
    const id = await addProfileUserApiKey(
      name,
      provider as ApiProvider,
      apiKey,
      baseUrl,
    );

    const timestamp = new Date().toISOString();
    return {
      id,
      user_id: '',
      name,
      provider,
      api_key_encrypted: '***CONFIGURED***',
      base_url: baseUrl || undefined,
      is_active: true,
      call_count: 0,
      total_cost: 0,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async updateUserApiKey(
    id: string,
    updates: Partial<Pick<UserApiKey, 'name' | 'is_active' | 'base_url'>>,
  ): Promise<void> {
    await mutateUserApiEntries((entries) =>
      entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              name: updates.name ?? entry.name,
              baseUrl: updates.base_url ?? entry.baseUrl,
              disabled:
                typeof updates.is_active === 'boolean'
                  ? !updates.is_active
                  : entry.disabled,
              updatedAt: Date.now(),
            }
          : entry,
      ),
    );
  }

  async deleteUserApiKey(id: string): Promise<void> {
    await deleteProfileApiKey(id);
  }

  async getModelRoute(
    modelId: string,
    requestedSize = '1K',
  ): Promise<ModelRoute> {
    void modelId;
    void requestedSize;
    throw new Error('Direct model route retrieval is disabled. Use secure-model-proxy for model calls.');
  }

  async recordUsage(
    modelId: string,
    routeType: string,
    creditCost: number,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    void modelId;
    void routeType;
    void creditCost;
    void metadata;
    return true;
  }

  async hasConfiguredKey(provider: string): Promise<boolean> {
    const entries = await loadUserApiEntries();
    return entries.some(
      (entry) => entry.provider === provider && !entry.disabled && Boolean(entry.key),
    );
  }

  decryptApiKey(_encrypted: string): string {
    return '';
  }
}

export const userApiKeyService = new UserApiKeyService();
