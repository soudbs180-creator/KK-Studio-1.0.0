/**
 * Model Caller Service
 *
 * Unified service for calling models:
 * - Credit-based models (from admin config) -> Secure server-side proxy
 * - Third-party models (from suppliers) -> Use supplier API
 * - Official models -> Use user's own key
 */

import { type ChatMessage } from '../api/AI12APIService';
import { getPreferredKkApiAccessToken } from '../api/authAccessToken';
import { keyManager, parseModelString, resolveEffectiveProviderModels } from '../auth/keyManager';
import { supplierService } from '../billing/supplierService';
import { adminModelService } from './adminModelService';
import {
  buildSecureProxyUserRouteFromSlotId,
  callLocalUserRouteProxyChat,
  callSecureSystemProxyChat,
  type SecureProxyUserRoute,
} from './secureModelProxy';

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

type SecureUserRouteConfig = {
  route: SecureProxyUserRoute;
  provider?: string;
};

class ModelCaller {
  private parseModelRoute(modelId: string): {
    rawModelId: string;
    baseModelId: string;
    hasExplicitRoute: boolean;
    isSystemRoute: boolean;
  } {
    const rawModelId = String(modelId || '').trim();
    const [baseModelId, rawSuffix = ''] = rawModelId.split('@');
    const trimmedSuffix = rawSuffix.trim();
    const decodedSuffix = (() => {
      try {
        return decodeURIComponent(trimmedSuffix).trim().toLowerCase();
      } catch {
        return trimmedSuffix.toLowerCase();
      }
    })();

    return {
      rawModelId,
      baseModelId: String(baseModelId || rawModelId).trim(),
      hasExplicitRoute: trimmedSuffix.length > 0,
      isSystemRoute: decodedSuffix.startsWith('system')
        || decodedSuffix === 'systemproxy'
        || decodedSuffix === '12ai'
        || decodedSuffix === 'builtin',
    };
  }

  private withBaseModelId(options: CallModelOptions, baseModelId: string): CallModelOptions {
    if (options.modelId === baseModelId) {
      return options;
    }

    return {
      ...options,
      modelId: baseModelId,
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
  ): SecureUserRouteConfig | null {
    const providers = keyManager
      .getProviders()
      .filter((provider) => provider.isActive && provider.baseUrl && provider.apiKey);

    for (const provider of providers) {
      const providerModels = resolveEffectiveProviderModels({
        provider: provider.name,
        baseUrl: provider.baseUrl,
        format: provider.format,
        models: provider.models,
      });
      const hasModel = providerModels.some((candidate) => this.isModelMatch(modelId, parseModelString(candidate).id || candidate));
      if (hasModel) {
        return {
          route: buildSecureProxyUserRouteFromSlotId(provider.id),
          provider: provider.name,
        };
      }
    }

    return null;
  }

  async call(options: CallModelOptions): Promise<CallResult> {
    const route = this.parseModelRoute(options.modelId);
    const directCallOptions = this.withBaseModelId(options, route.baseModelId);

    if (route.hasExplicitRoute && !route.isSystemRoute) {
      const routedKey = keyManager.getNextKey(route.rawModelId);
      if (!routedKey || routedKey.provider === 'SystemProxy' || !routedKey.key) {
        return {
          success: false,
          error: `Selected route is unavailable for model: ${route.rawModelId}`,
        };
      }

      return this.callWithUserRoute(directCallOptions, {
        route: buildSecureProxyUserRouteFromSlotId(routedKey.id),
        provider: routedKey.provider,
      });
    }

    const creditCost = await this.getCreditCost(route.rawModelId);
    if (creditCost > 0) {
      return this.callCreditModel(options, creditCost);
    }

    const supplier = this.findSupplierForModel(route.baseModelId);
    if (supplier) {
      return this.callViaSupplier(directCallOptions, supplier);
    }

    const slots = keyManager.getSlots();
    const userSlot = slots.find(
      (slot) =>
        slot.supportedModels?.includes(route.baseModelId)
        || slot.supportedModels?.some((supportedModel) => route.baseModelId.includes(supportedModel)),
    );
    if (userSlot) {
      return this.callWithUserRoute(directCallOptions, {
        route: buildSecureProxyUserRouteFromSlotId(userSlot.id),
        provider: userSlot.provider,
      });
    }

    return this.callWithSystemDefault(directCallOptions);
  }

  private async callCreditModel(options: CallModelOptions, creditCost: number): Promise<CallResult> {
    const accessToken = await getPreferredKkApiAccessToken();
    const userId = keyManager.getUserId();
    const hasAuthenticatedSession = Boolean(String(accessToken || '').trim());
    const hasSignedInUser = Boolean(userId);

    if (!hasAuthenticatedSession && !hasSignedInUser) {
      return { success: false, error: 'Please sign in with a full account before using credit-based models.' };
    }

    try {
      const response = await callSecureSystemProxyChat({
        modelId: options.modelId,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: false,
      });

      const hasConfirmedCreditSettlement = Boolean(response.ledgerId && typeof response.balanceAfter === 'number');
      if (!response.deducted) {
        console.error(
          '[ModelCaller] Secure system proxy returned success without confirming credit deduction.',
          {
            modelId: options.modelId,
            expectedCredits: Math.max(1, Math.ceil(Number(creditCost || 0))),
            hasSignedInUser,
            hasAuthenticatedSession,
          },
        );

        return {
          success: false,
          error: 'Credit settlement could not be confirmed. Please retry the request.',
        };
      }

      if (!hasConfirmedCreditSettlement) {
        console.warn(
          '[ModelCaller] Secure system proxy returned a billed response without ledger metadata; accepting for backward compatibility.',
          {
            modelId: options.modelId,
            expectedCredits: Math.max(1, Math.ceil(Number(creditCost || 0))),
            hasSignedInUser,
            hasAuthenticatedSession,
            ledgerId: response.ledgerId,
            balanceAfter: response.balanceAfter,
          },
        );
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

  private async callViaSupplier(options: CallModelOptions, supplier: SecureUserRouteConfig): Promise<CallResult> {
    return this.callWithUserRoute(options, supplier);
  }

  private async callWithUserRoute(
    options: CallModelOptions,
    config: SecureUserRouteConfig,
  ): Promise<CallResult> {
    try {
      const directModelId = this.parseModelRoute(options.modelId).baseModelId;
      const data = await callLocalUserRouteProxyChat({
        routeId: config.route.id,
        modelId: directModelId,
        messages: options.messages.map((message) => ({
          role: message.role === 'assistant' || message.role === 'system' ? message.role : 'user',
          content: typeof message.content === 'string' ? message.content : String(message.content ?? ''),
        })),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: false,
      });

      return {
        success: true,
        content: data.content || '',
        usage: data.usage,
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
    route: SecureProxyUserRoute;
    provider?: string;
  } | null {
    const configuredProvider = this.findConfiguredProviderForModel(modelId);
    if (configuredProvider) {
      return configuredProvider;
    }

    const suppliers = supplierService.getAll();

    for (const supplier of suppliers) {
      const hasModel = supplier.models.some((model) => this.isModelMatch(modelId, model.id));
      if (hasModel) {
        console.warn('[ModelCaller] Blocking insecure supplier direct-call path for model:', modelId);
        return null;
      }
    }

    return null;
  }
}

export const modelCaller = new ModelCaller();
