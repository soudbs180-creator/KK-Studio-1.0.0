/**
 * Secure Model Caller Service
 *
 * All model invocations go through the secure server-side proxy so raw provider
 * keys never need to reach the browser runtime.
 */

import { type ChatMessage } from '../api/AI12APIService';
import { legacyWebApiClient } from '../api/kkApiClient';
import { userApiKeyService } from '../api/userApiKeyService';
import { callSecureSystemProxyChat } from './secureModelProxy';

export interface SecureCallOptions {
  modelId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onStream?: (chunk: string) => void;
  imageSize?: string;
}

export interface SecureCallResult {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  routeInfo?: {
    type: 'user_key' | 'admin_model';
    cost: number;
    provider: string;
  };
}

class SecureModelCaller {
  async call(options: SecureCallOptions): Promise<SecureCallResult> {
    try {
      const result = await callSecureSystemProxyChat({
        modelId: options.modelId,
        messages: options.messages.map((message) => ({
          role: message.role === 'assistant' || message.role === 'system' ? message.role : 'user',
          content: typeof message.content === 'string' ? message.content : String(message.content ?? ''),
        })),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: false,
      });

      if (options.onStream && result.content) {
        options.onStream(result.content);
      }

      return {
        success: true,
        content: result.content,
        usage: result.usage,
        routeInfo: {
          type: result.deducted ? 'admin_model' : 'user_key',
          cost: 0,
          provider: result.endpointType || 'system',
        },
      };
    } catch (error: any) {
      console.error('[SecureModelCaller] 调用失败:', error);
      return {
        success: false,
        error: error.message || '模型调用失败，请稍后重试。',
      };
    }
  }

  async getAvailableModels(): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    creditCost?: number;
    source: 'system' | 'user';
    isActive: boolean;
  }>> {
    try {
      const response = await legacyWebApiClient.listActiveCreditModels();
      if (!response.success) {
        throw new Error(response.error.message || 'Failed to load active credit models.');
      }

      const adminModels = (response.data.items || []).flatMap((group) =>
        (group.models || []).map((model) => ({
          model_id: model.modelId,
          display_name: model.displayName,
          description: model.description,
          credit_cost: model.creditCost,
          is_active: true,
        }))
      );

      const userKeys = await userApiKeyService.getUserApiKeys();

      return [
        ...(adminModels || []).map((model: any) => ({
          id: model.model_id,
          name: model.display_name,
          description: model.description,
          creditCost: model.credit_cost,
          source: 'system' as const,
          isActive: true,
        })),
        ...userKeys
          .filter((key) => key.is_active)
          .map((key) => ({
            id: `${key.provider.toLowerCase()}-custom-${key.id.slice(0, 8)}`,
            name: `${key.name} (${key.provider})`,
            description: '使用您自己的 API 密钥',
            creditCost: 0,
            source: 'user' as const,
            isActive: true,
          })),
      ];
    } catch (error) {
      console.error('[SecureModelCaller] 获取模型列表失败:', error);
      return [];
    }
  }
}

export const secureModelCaller = new SecureModelCaller();
