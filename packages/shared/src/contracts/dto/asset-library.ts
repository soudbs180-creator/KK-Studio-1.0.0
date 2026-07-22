import type { EntityId } from "./common.ts";
import { z } from "zod";

export type AssetKind = "image" | "video" | "audio" | "document";

export const AssetKindSchema = z.enum(["image", "video", "audio", "document"]);

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

export interface CreateAssetRequestDto {
  id?: EntityId;
  kind: AssetKind;
  mimeType: string;
  dataUrl: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateAssetResponseDto {
  asset: AssetDto;
  url: string;
}

/** Validates owner-scoped Asset Library records before browser code trusts canonical ids. */
export const AssetDtoSchema: z.ZodType<AssetDto> = z.object({
  id: z.string().min(1).max(200),
  kind: AssetKindSchema,
  storagePath: z.string().min(1).max(2_000),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024 * 1024),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.iso.datetime(),
}).strict();

export const AssetListDtoSchema: z.ZodType<AssetListDto> = z.object({
  items: z.array(AssetDtoSchema).max(500),
}).strict();

export const CreateAssetResponseDtoSchema: z.ZodType<CreateAssetResponseDto> = z.object({
  asset: AssetDtoSchema,
  url: z.string().min(1).max(2_000),
}).strict();
