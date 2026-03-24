import {
  buildRequestMeta,
  type ActiveCreditModelListDto,
  type AdminCreditProviderListDto,
  type ApiResponse,
  type DeleteAdminCreditProviderResponseDto,
  type SaveAdminCreditProviderRequestDto,
  type SaveAdminCreditProviderResponseDto,
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
