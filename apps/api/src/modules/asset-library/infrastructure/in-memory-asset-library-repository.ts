import type { AssetDto } from "../../../../../../packages/contracts/src/index.ts";
import { createSeedAssets } from "../domain/asset-library.ts";

export interface AssetLibraryRepository {
  list(): Promise<AssetDto[]>;
}

export class InMemoryAssetLibraryRepository implements AssetLibraryRepository {
  private readonly items: AssetDto[];

  constructor(seed = createSeedAssets()) {
    this.items = seed.map((item) => ({ ...item }));
  }

  async list(): Promise<AssetDto[]> {
    return this.items.map((item) => ({ ...item }));
  }
}
