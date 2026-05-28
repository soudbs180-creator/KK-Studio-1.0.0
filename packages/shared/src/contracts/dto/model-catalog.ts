import type { EntityId } from "./common.ts";
import type { ModelAvailability } from "../enums/status.ts";

export type ModelKind = "chat" | "image" | "video" | "audio" | "embedding";
export type ProviderProtocolFamily =
  | "openai-compatible"
  | "newapi-compatible"
  | "gemini-native"
  | "claude-native"
  | "openrouter-openai"
  | "wuyin-async-image"
  | "12ai-flow";

export interface ModelCatalogItemDto {
  id: EntityId;
  modelCode: string;
  displayName: string;
  kind: ModelKind;
  availability: ModelAvailability;
  billingMode: "credits" | "currency";
  defaultCreditCost?: number;
}

export interface ModelCatalogListDto {
  items: ModelCatalogItemDto[];
}

export interface CreateAdminModelRequestDto {
  modelCode: string;
  displayName: string;
  kind: ModelKind;
  availability: ModelAvailability;
  billingMode?: "credits" | "currency";
  defaultCreditCost?: number;
}

export interface ActiveCreditModelDto {
  recordId?: EntityId;
  modelId: string;
  displayName: string;
  description?: string;
  endpointType: string;
  requestProfileId?: string;
  routeStrategy?: "priority-failover" | "weighted-random" | "parallel-race";
  creditCost: number;
  priority: number;
  weight: number;
  callCount: number;
  color?: string;
  colorSecondary?: string;
  textColor?: "white" | "black";
  advancedEnabled: boolean;
  mixWithSameModel: boolean;
  qualityPricing?: Record<string, { enabled: boolean; creditCost: number }>;
}

export interface ActiveCreditModelProviderDto {
  providerId: string;
  providerName: string;
  providerKind?: "official" | "relay";
  models: ActiveCreditModelDto[];
}

export interface ActiveCreditModelListDto {
  items: ActiveCreditModelProviderDto[];
}

export interface AdminCreditProviderModelDto {
  modelId: string;
  displayName: string;
  description?: string;
  endpointType: string;
  requestProfileId?: string;
  routeStrategy?: "priority-failover" | "weighted-random" | "parallel-race";
  creditCost: number;
  priority?: number;
  weight?: number;
  isActive: boolean;
  callCount: number;
  maxCallsLimit?: number | null;
  color?: string;
  colorSecondary?: string;
  textColor?: "white" | "black";
  advancedEnabled: boolean;
  mixWithSameModel: boolean;
  qualityPricing?: Record<string, { enabled: boolean; creditCost: number }>;
}

export interface AdminCreditProviderApiKeyEntryDto {
  fingerprint: string;
  preview: string;
}

export interface AdminCreditProviderDto {
  providerId: string;
  providerName: string;
  baseUrl: string;
  providerKind?: "official" | "relay";
  apiKeyCount: number;
  apiKeyEntries?: AdminCreditProviderApiKeyEntryDto[];
  apiKeyPreviews?: string[];
  models: AdminCreditProviderModelDto[];
}

export interface AdminCreditProviderListDto {
  items: AdminCreditProviderDto[];
}

export interface SaveAdminCreditProviderModelRequestDto {
  modelId: string;
  displayName: string;
  description?: string;
  endpointType: string;
  creditCost: number;
  advancedEnabled: boolean;
  mixWithSameModel: boolean;
  qualityPricing: Record<string, { enabled: boolean; creditCost: number }>;
  priority: number;
  weight: number;
  isActive: boolean;
  color: string;
  colorSecondary?: string | null;
  textColor: "white" | "black";
  maxCallsLimit?: number | null;
  autoPauseOnLimit?: boolean;
}

export interface SaveAdminCreditProviderRequestDto {
  providerName: string;
  baseUrl: string;
  providerKind?: "official" | "relay";
  apiKeys: string[];
  retainApiKeyFingerprints?: string[];
  models: SaveAdminCreditProviderModelRequestDto[];
}

export interface SaveAdminCreditProviderResponseDto {
  providerId: string;
  providerName: string;
  apiKeyCount: number;
  modelCount: number;
  saved: boolean;
}

export interface DeleteAdminCreditProviderResponseDto {
  providerId: string;
  deleted: boolean;
}

export interface ProviderPricingCacheItemDto {
  modelId: string;
  modelName: string;
  inputPrice: number;
  outputPrice: number;
  isPerToken: boolean;
  groupRatio?: number;
  currency: string;
  billingUnit?: string;
  displayPrice?: string;
  supportsGroups?: boolean;
  endpointUrl?: string;
  endpointPath?: string;
}

export interface ProviderPricingCacheDto {
  providerId: string;
  pricing: ProviderPricingCacheItemDto[];
  cachedAt?: string | null;
}

export interface UpsertProviderPricingCacheRequestDto {
  pricing: ProviderPricingCacheItemDto[];
}
