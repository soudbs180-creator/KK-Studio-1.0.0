import type { ModelCatalogItemDto } from "../../../../../../packages/contracts/src/index.ts";
import { createSeedModelCatalog } from "../domain/model-catalog-item.ts";

export interface ModelCatalogRepository {
  list(): Promise<ModelCatalogItemDto[]>;
  findByModelCode(modelCode: string): Promise<ModelCatalogItemDto | undefined>;
  save(item: ModelCatalogItemDto): Promise<void>;
}

export class InMemoryModelCatalogRepository implements ModelCatalogRepository {
  private readonly items = new Map<string, ModelCatalogItemDto>();

  constructor(seed = createSeedModelCatalog()) {
    seed.forEach((item) => {
      this.items.set(item.modelCode, { ...item });
    });
  }

  async list(): Promise<ModelCatalogItemDto[]> {
    return Array.from(this.items.values()).map((item) => ({ ...item }));
  }

  async findByModelCode(modelCode: string): Promise<ModelCatalogItemDto | undefined> {
    const item = this.items.get(modelCode);
    return item ? { ...item } : undefined;
  }

  async save(item: ModelCatalogItemDto): Promise<void> {
    this.items.set(item.modelCode, { ...item });
  }
}
