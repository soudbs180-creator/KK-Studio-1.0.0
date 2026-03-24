import type { EntityId } from "./common.ts";

export type AssetKind = "image" | "video" | "audio" | "document";

export interface AssetDto {
  id: EntityId;
  kind: AssetKind;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AssetListDto {
  items: AssetDto[];
}
