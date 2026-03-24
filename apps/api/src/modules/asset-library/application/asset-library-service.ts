import {
  buildRequestMeta,
  type ApiResponse,
  type AssetKind,
  type AssetListDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import { paginateAssets } from "../domain/asset-library.ts";
import type { AssetLibraryRepository } from "../infrastructure/in-memory-asset-library-repository.ts";

export class AssetLibraryService {
  private readonly logger = consoleLogger.child({ module: "asset-library" });
  private readonly repository: AssetLibraryRepository;

  constructor(repository: AssetLibraryRepository) {
    this.repository = repository;
  }

  async listAssets(
    input: { kind?: AssetKind; cursor?: string; limit: number },
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<AssetListDto>> {
    const items = await this.repository.list();
    const page = paginateAssets(items, input);

    this.logger.info("Asset page resolved", {
      kind: input.kind,
      cursor: input.cursor,
      limit: input.limit,
      itemCount: page.data.items.length,
      hasMore: page.hasMore,
    });

    return {
      success: true,
      data: page.data,
      meta: buildRequestMeta(requestId, clientVersion, {
        limit: input.limit,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
      }),
    };
  }
}
