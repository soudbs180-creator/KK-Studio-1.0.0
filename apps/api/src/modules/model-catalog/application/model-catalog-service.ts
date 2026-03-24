import {
  buildRequestMeta,
  type ApiResponse,
  type CreateAdminModelRequestDto,
  type ModelCatalogItemDto,
  type ModelCatalogListDto,
  type ModelKind,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import {
  createAdminModel,
  listPublicModels,
} from "../domain/model-catalog-item.ts";
import type { ModelCatalogRepository } from "../infrastructure/in-memory-model-catalog-repository.ts";

export class ModelCatalogService {
  private readonly logger = consoleLogger.child({ module: "model-catalog" });
  private readonly repository: ModelCatalogRepository;

  constructor(repository: ModelCatalogRepository) {
    this.repository = repository;
  }

  async listModels(
    kind: ModelKind | undefined,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ModelCatalogListDto>> {
    const items = await this.repository.list();

    return {
      success: true,
      data: listPublicModels(items, kind),
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async createAdminModel(
    input: CreateAdminModelRequestDto,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<ModelCatalogItemDto>> {
    const existing = await this.repository.findByModelCode(input.modelCode.trim());
    if (existing) {
      return {
        success: false,
        error: {
          code: "MODEL_CODE_CONFLICT",
          message: "A model with this modelCode already exists.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const model = createAdminModel(input);
    await this.repository.save(model);

    this.logger.info("Admin model created in migrated model catalog module", {
      actorUserId,
      modelCode: model.modelCode,
      kind: model.kind,
      availability: model.availability,
    });

    return {
      success: true,
      data: model,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
