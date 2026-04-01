import {
  buildRequestMeta,
  type ActiveCreditModelListDto,
  type AdminCreditProviderListDto,
  type ApiResponse,
  type DeleteAdminCreditProviderResponseDto,
  type ProviderPricingCacheDto,
  type SaveAdminCreditProviderRequestDto,
  type SaveAdminCreditProviderResponseDto,
  type UpsertProviderPricingCacheRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import type {
  CreditProviderRepository,
} from "../infrastructure/in-memory-credit-provider-repository.ts";

export class CreditProviderService {
  private readonly logger = consoleLogger.child({ module: "credit-providers" });
  private readonly repository: CreditProviderRepository;

  constructor(repository: CreditProviderRepository) {
    this.repository = repository;
  }

  async listAdminProviders(
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<AdminCreditProviderListDto>> {
    const items = await this.repository.listAdminProviders();
    return {
      success: true,
      data: { items },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async listActiveCreditModels(
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ActiveCreditModelListDto>> {
    const items = await this.repository.listActiveCreditModels();
    return {
      success: true,
      data: { items },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async saveAdminProvider(
    providerId: string,
    input: SaveAdminCreditProviderRequestDto,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<SaveAdminCreditProviderResponseDto>> {
    const result = await this.repository.saveAdminProvider(providerId, input);
    this.logger.info("Admin credit provider saved via migrated API module", {
      actorUserId,
      providerId,
      modelCount: result.modelCount,
      apiKeyCount: result.apiKeyCount,
    });

    return {
      success: true,
      data: {
        providerId: result.providerId,
        providerName: result.providerName,
        apiKeyCount: result.apiKeyCount,
        modelCount: result.modelCount,
        saved: true,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async getProviderPricingCache(
    providerId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ProviderPricingCacheDto>> {
    const cached = await this.repository.getProviderPricingCache(providerId);
    if (!cached) {
      return {
        success: false,
        error: {
          code: "CREDIT_PROVIDER_PRICING_CACHE_NOT_FOUND",
          message: "No cached provider pricing was found for this provider.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    return {
      success: true,
      data: cached,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async saveProviderPricingCache(
    providerId: string,
    input: UpsertProviderPricingCacheRequestDto,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ProviderPricingCacheDto>> {
    const result = await this.repository.saveProviderPricingCache(providerId, input);

    this.logger.info("Admin credit provider pricing cache saved via migrated API module", {
      actorUserId,
      providerId,
      itemCount: result.pricing.length,
      cachedAt: result.cachedAt,
    });

    return {
      success: true,
      data: result,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async getSharedProviderPricingCache(
    baseUrl: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ProviderPricingCacheDto>> {
    const cached = await this.repository.getSharedProviderPricingCache(baseUrl);
    if (!cached) {
      return {
        success: false,
        error: {
          code: "CREDIT_PROVIDER_PRICING_CACHE_NOT_FOUND",
          message: "No cached provider pricing was found for this baseUrl.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    return {
      success: true,
      data: cached,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async saveSharedProviderPricingCache(
    baseUrl: string,
    input: UpsertProviderPricingCacheRequestDto,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ProviderPricingCacheDto>> {
    const result = await this.repository.saveSharedProviderPricingCache(baseUrl, input);

    this.logger.info("Shared provider pricing cache saved via API module", {
      actorUserId,
      baseUrl,
      cacheId: result.providerId,
      itemCount: result.pricing.length,
      cachedAt: result.cachedAt,
    });

    return {
      success: true,
      data: result,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async deleteAdminProvider(
    providerId: string,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<DeleteAdminCreditProviderResponseDto>> {
    const deleted = await this.repository.deleteAdminProvider(providerId);
    if (!deleted) {
      return {
        success: false,
        error: {
          code: "CREDIT_PROVIDER_NOT_FOUND",
          message: "The credit provider could not be found.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    this.logger.info("Admin credit provider deleted via migrated API module", {
      actorUserId,
      providerId,
    });

    return {
      success: true,
      data: {
        providerId,
        deleted: true,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
