/**
 * Model Caller Service
 *
 * Unified service for calling models:
 * - Credit-based models (from admin config) -> Secure server-side proxy
 * - Third-party models (from suppliers) -> Use supplier API
 * - Official models -> Use user's own key
 */

import { type ChatMessage } from '../api/AI12APIService';
import {
  buildGeminiHeaders,
  buildGeminiEndpoint,
  buildOpenAIEndpoint,
  buildProxyHeaders,
  type ApiProtocolFormat,
} from '../api/apiConfig';
import {
  buildResponsesPayload,
  extractOpenAITextPayload,
  extractOpenAIUsage,
  modelPrefersResponsesApi,
  shouldRetryWithResponsesApi,
} from '../api/openaiResponses';
import { resolveProviderRuntime } from '../api/providerStrategy';
import { legacyWebApiClient } from '../api/kkApiClient';
import { keyManager } from '../auth/keyManager';
import { supplierService } from '../billing/supplierService';
import { supabase } from '../../lib/supabase';
import { adminModelService } from './adminModelService';
import { callSecureSystemProxyChat } from './secureModelProxy';

export interface CallModelOptions {
  modelId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onStream?: (chunk: string) => void;
}

export interface CallResult {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

type RoutedApiConfig = {
  baseUrl: string;
  apiKey: string;
  provider?: string;
  format?: ApiProtocolFormat;
};

class ModelCaller {
  private buildBillingRequestId(prefix: string): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return `${prefix}-${uuid || Date.now()}`;
  }

  private buildBillingRequestOptions(requestId: string) {
    return {
      requestId,
    };
  }

  private isModelMatch(modelId: string, candidate: string): boolean {
    const normalizedModelId = String(modelId || '').trim().toLowerCase();
    const normalizedCandidate = String(candidate || '').trim().toLowerCase();

    if (!normalizedModelId || !normalizedCandidate) {
      return false;
    }

    return (
      normalizedCandidate === normalizedModelId
      || normalizedCandidate.endsWith(`/${normalizedModelId}`)
      || normalizedModelId.endsWith(`/${normalizedCandidate}`)
    );
  }

  private findConfiguredProviderForModel(
    modelId: string,
  ): RoutedApiConfig | null {
    const providers = keyManager
      .getProviders()
      .filter((provider) => provider.isActive && provider.baseUrl && provider.apiKey);

    for (const provider of providers) {
      const hasModel = provider.models.some((candidate) => this.isModelMatch(modelId, candidate));
      if (hasModel) {
        return {
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          provider: provider.name,
          format: provider.format,
        };
      }
    }

    return null;
  }

  async call(options: CallModelOptions): Promise<CallResult> {
    const { modelId } = options;

    const creditCost = await this.getCreditCost(modelId);
    if (creditCost > 0) {
      return this.callCreditModel(options, creditCost);
    }

    const supplier = this.findSupplierForModel(modelId);
    if (supplier) {
      return this.callViaSupplier(options, supplier);
    }

    const slots = keyManager.getSlots();
    const userSlot = slots.find(
      (slot) =>
        slot.supportedModels?.includes(modelId)
        || slot.supportedModels?.some((supportedModel) => modelId.includes(supportedModel)),
    );
    if (userSlot) {
      return this.callWithUserKey(options, {
        key: userSlot.key,
        baseUrl: userSlot.baseUrl,
        provider: userSlot.provider,
        format: userSlot.format,
      });
    }

    return this.callWithSystemDefault(options);
  }

  private async callCreditModel(options: CallModelOptions, creditCost: number): Promise<CallResult> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Please sign in before using credit-based models.' };
    }

    const requiredCredits = Math.max(1, Math.ceil(Number(creditCost || 0)));
    const billingRequestId = this.buildBillingRequestId('model-call');
    const billingRequestOptions = this.buildBillingRequestOptions(billingRequestId);
    const balanceResponse = await legacyWebApiClient.getCreditBalance(billingRequestOptions);

    if (!balanceResponse.success) {
      return {
        success: false,
        error: balanceResponse.error.message || 'Unable to load credit balance.',
      };
    }

    const availableBalance = Number(balanceResponse.data.balance || 0);
    if (availableBalance < requiredCredits) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${requiredCredits}.`,
      };
    }

    try {
      const response = await callSecureSystemProxyChat({
        modelId: options.modelId,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: false,
      });

      if (!response.deducted) {
        await this.deductCredits(requiredCredits, options.modelId, billingRequestId);
      }

      return {
        success: true,
        content: response.content,
        usage: response.usage,
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Model call failed.' };
    }
  }

  private async callViaSupplier(options: CallModelOptions, supplier: RoutedApiConfig): Promise<CallResult> {
    return this.callWithProtocol(options, supplier);
  }

  private async callWithUserKey(
    options: CallModelOptions,
    userKey: { key: string; baseUrl?: string; format?: ApiProtocolFormat; provider?: string },
  ): Promise<CallResult> {
    return this.callWithProtocol(options, {
      apiKey: userKey.key,
      baseUrl: userKey.baseUrl || 'https://cdn.12ai.org',
      provider: userKey.provider,
      format: userKey.format,
    });
  }

  private async callWithProtocol(options: CallModelOptions, config: RoutedApiConfig): Promise<CallResult> {
    const runtime = resolveProviderRuntime({
      provider: config.provider,
      baseUrl: config.baseUrl,
      format: config.format,
      modelId: options.modelId,
    });
    if (runtime.geminiNative) {
      return this.callGeminiCompatible(options, config);
    }

    return this.callOpenAICompatible(options, config);
  }

  private async callOpenAICompatible(
    options: CallModelOptions,
    config: RoutedApiConfig,
  ): Promise<CallResult> {
    try {
      const runtime = resolveProviderRuntime({
        provider: config.provider,
        baseUrl: config.baseUrl,
        format: config.format,
        modelId: options.modelId,
      });
      const headers = buildProxyHeaders(
        runtime.authMethod as 'header' | 'query',
        config.apiKey,
        runtime.headerName,
        undefined,
        runtime.authorizationValueFormat,
      );
      const chatUrl = buildOpenAIEndpoint(config.baseUrl, 'chat/completions');
      const responsesUrl = buildOpenAIEndpoint(config.baseUrl, 'responses');
      const chatBody = {
        model: options.modelId,
        messages: options.messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.7,
        stream: false,
      };
      const responsesBody = buildResponsesPayload({
        model: options.modelId,
        messages: options.messages,
        maxOutputTokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.7,
        stream: false,
      });

      let response: Response;
      let responseText = '';
      const preferResponses = modelPrefersResponsesApi(options.modelId);

      if (preferResponses) {
        response = await fetch(responsesUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(responsesBody),
        });
      } else {
        response = await fetch(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(chatBody),
        });

        if (!response.ok) {
          responseText = await response.text();
          if (shouldRetryWithResponsesApi(response.status, responseText)) {
            response = await fetch(responsesUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(responsesBody),
            });
          }
        }
      }

      if (!response.ok) {
        if (!responseText) {
          responseText = await response.text();
        }
        throw new Error(`API error: ${response.status} - ${responseText}`);
      }

      const data = await response.json();
      const usage = extractOpenAIUsage(data);
      return {
        success: true,
        content: extractOpenAITextPayload(data) || '',
        usage,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private buildGeminiPayload(options: CallModelOptions): Record<string, any> {
    const systemInstruction = options.messages
      .filter((message) => message.role === 'system')
      .map((message) => String(message.content || '').trim())
      .filter(Boolean)
      .join('\n\n');

    const contents = options.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(message.content || '') }],
      }));

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: systemInstruction || 'Hello' }],
      });
    }

    const payload: Record<string, any> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    return payload;
  }

  private async callGeminiCompatible(
    options: CallModelOptions,
    config: RoutedApiConfig,
  ): Promise<CallResult> {
    try {
      const runtime = resolveProviderRuntime({
        provider: config.provider,
        baseUrl: config.baseUrl,
        format: 'gemini',
        modelId: options.modelId,
      });
      const authMethod = runtime.authMethod as 'query' | 'header';
      const response = await fetch(
        buildGeminiEndpoint(config.baseUrl, options.modelId, 'generateContent', config.apiKey, authMethod, config.provider),
        {
          method: 'POST',
          headers: buildGeminiHeaders(authMethod, config.apiKey, runtime.headerName, runtime.authorizationValueFormat),
          body: JSON.stringify(this.buildGeminiPayload(options)),
        },
      );

      if (!response.ok) {
        const rawError = await response.text();
        let message = rawError;

        try {
          const parsed = JSON.parse(rawError || '{}');
          message = parsed.error?.message || parsed.message || rawError;
        } catch {
          message = rawError;
        }

        throw new Error(`API error: ${response.status} - ${message}`);
      }

      const data = await response.json();
      const content = (data.candidates?.[0]?.content?.parts || [])
        .map((part: any) => part?.text || '')
        .filter(Boolean)
        .join('\n');

      return {
        success: true,
        content,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async callWithSystemDefault(options: CallModelOptions): Promise<CallResult> {
    const hasMessages = Array.isArray(options.messages) && options.messages.length > 0;
    if (!hasMessages) {
      return {
        success: false,
        error: 'Please configure an API key or select an available provider first.',
      };
    }

    return {
      success: false,
      error: 'Please configure an API key or select an available provider first.',
    };
  }

  private async getCreditCost(modelId: string): Promise<number> {
    await adminModelService.loadAdminModels();
    return Number(adminModelService.getModelCreditCost(modelId) || 0);
  }

  private findSupplierForModel(modelId: string): {
    baseUrl: string;
    apiKey: string;
    provider?: string;
    format: ApiProtocolFormat;
  } | null {
    const configuredProvider = this.findConfiguredProviderForModel(modelId);
    if (configuredProvider) {
      return {
        baseUrl: configuredProvider.baseUrl,
        apiKey: configuredProvider.apiKey,
        provider: undefined,
        format: configuredProvider.format || 'auto',
      };
    }

    const suppliers = supplierService.getAll();

    for (const supplier of suppliers) {
      const hasModel = supplier.models.some((model) => this.isModelMatch(modelId, model.id));
      if (hasModel) {
        return {
          baseUrl: supplier.baseUrl,
          apiKey: supplier.apiKey,
          provider: supplier.name,
          format: supplier.format || 'auto',
        };
      }
    }

    return null;
  }

  private async deductCredits(
    credits: number,
    modelId: string,
    billingRequestId?: string,
  ): Promise<void> {
    const roundedCredits = Math.max(1, Math.ceil(Number(credits || 0)));
    const requestId = billingRequestId || this.buildBillingRequestId('model-call');
    const debitResponse = await legacyWebApiClient.debitCredits(
      {
        businessRefType: 'model_call',
        businessRefId: requestId,
        creditAmount: roundedCredits,
        modelCode: modelId,
        idempotencyKey: requestId,
      },
      this.buildBillingRequestOptions(requestId),
    );

    if (!debitResponse.success) {
      console.error('[ModelCaller] Credit deduction failed:', debitResponse.error);
      throw new Error(debitResponse.error.message || 'Credit deduction failed.');
    }
  }
}

export const modelCaller = new ModelCaller();
