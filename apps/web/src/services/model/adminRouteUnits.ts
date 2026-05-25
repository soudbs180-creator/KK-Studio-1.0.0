import type { ResolvedImageSurface } from "../api/providerSurfaceTypes.ts";
import {
  ADMIN_MODEL_QUALITY_KEYS,
  normalizeAdminQualityKey,
  type AdminModelQualityKey,
  type AdminModelQualityPricing,
} from "./adminModelQuality.ts";
import { resolveLocalRequestProfile } from "../api/requestProfileRegistry.ts";
import type { AdminModelConfig } from "./adminModelService.ts";

export type CreditRouteStrategy = "priority-failover" | "weighted-random" | "parallel-race";

export interface CreditRouteUnit {
  id: string;
  modelId: string;
  specId: string;
  supplierId: string;
  supplierLabel: string;
  requestProfileId: string;
  requestSurface: ResolvedImageSurface | "openai-chat" | "openai-responses" | "claude-messages";
  endpointType: string;
  priority: number;
  weight: number;
  enabled: boolean;
  creditCost: number;
  supportsParallelFanout: boolean;
}

export interface CreditModelSpec {
  id: string;
  modelId: string;
  sizeSpec: string;
  displayLabel: string;
  creditPrice: number;
  enabled: boolean;
  routeStrategy: CreditRouteStrategy;
  routeUnits: CreditRouteUnit[];
}

export interface CreditModelCatalogEntry {
  id: string;
  displayName: string;
  family: "image" | "video" | "chat" | "audio";
  isActive: boolean;
  specs: CreditModelSpec[];
}

export type CreditRouteModelSource = Pick<
  AdminModelConfig,
  | "id"
  | "displayName"
  | "provider"
  | "providerId"
  | "providerName"
  | "requestProfileId"
  | "routeStrategy"
  | "creditCost"
  | "advancedEnabled"
  | "qualityPricing"
  | "billingType"
  | "endpoint"
  | "isSystemModel"
  | "priority"
  | "weight"
  | "mixWithSameModel"
>;

function inferModelFamily(endpoint: string, modelId: string): CreditModelCatalogEntry["family"] {
  const haystack = `${String(endpoint || "").trim().toLowerCase()} ${String(modelId || "").trim().toLowerCase()}`;
  if (/(veo|video|runway|luma|kling|seedance|sora)/i.test(haystack)) return "video";
  if (/(audio|speech|suno|minimax-t2a)/i.test(haystack)) return "audio";
  if (/(image|generatecontent|gemini)/i.test(haystack)) return "image";
  return "chat";
}

function inferRequestSurface(endpoint: string): CreditRouteUnit["requestSurface"] {
  const normalized = String(endpoint || "").trim().toLowerCase();
  if (normalized.includes("image-generation-async") || normalized.includes("/images/async/")) return "async-image";
  if (normalized.includes("image-generation") || normalized.includes("/images/generations")) return "provider-images";
  if (normalized.includes("gemini") || normalized.includes("generatecontent")) return "gemini-native-image";
  if (normalized.includes("responses")) return "openai-responses";
  if (normalized.includes("claude") || normalized.includes("messages")) return "claude-messages";
  if (normalized.includes("chat") || normalized.includes("openai")) return "openai-chat";
  return "provider-images";
}

function resolveRouteStrategy(models: CreditRouteModelSource[]): CreditRouteStrategy {
  const explicitStrategy = models
    .map((model) => model.routeStrategy)
    .find((strategy): strategy is CreditRouteStrategy => Boolean(strategy));
  if (explicitStrategy) {
    return explicitStrategy;
  }

  if (models.some((model) => Boolean(model.mixWithSameModel)) && models.length > 1) {
    return "weighted-random";
  }
  return "priority-failover";
}

function getSpecKeys(model: CreditRouteModelSource): Array<AdminModelQualityKey | "default"> {
  if (!model.advancedEnabled || !model.qualityPricing) {
    return ["default"];
  }

  return [...ADMIN_MODEL_QUALITY_KEYS];
}

function getSpecCreditPrice(
  models: CreditRouteModelSource[],
  specKey: AdminModelQualityKey | "default",
): { creditPrice: number; enabled: boolean } {
  const priced = models.map((model) => {
    if (specKey === "default" || !model.advancedEnabled || !model.qualityPricing) {
      return {
        creditPrice: Math.max(1, Number(model.creditCost || 1)),
        enabled: true,
      };
    }

    const rule = (model.qualityPricing as AdminModelQualityPricing)[specKey];
    return {
      creditPrice: Math.max(1, Number(rule?.creditCost || model.creditCost || 1)),
      enabled: rule?.enabled !== false,
    };
  });

  return {
    creditPrice: Math.min(...priced.map((item) => item.creditPrice)),
    enabled: priced.some((item) => item.enabled),
  };
}

function buildRouteUnit(
  model: CreditRouteModelSource,
  specId: string,
  specKey: AdminModelQualityKey | "default",
): CreditRouteUnit {
  const rule = specKey !== "default" && model.qualityPricing
    ? model.qualityPricing[specKey]
    : undefined;

  return {
    id: `${model.id}:${String(model.providerId || model.provider || "route").trim()}:${specKey}`,
    modelId: model.id,
    specId,
    supplierId: String(model.providerId || model.provider || "system").trim() || "system",
    supplierLabel: String(model.providerName || model.provider || "System").trim() || "System",
    requestProfileId: model.requestProfileId || resolveLocalRequestProfile({
      provider: String(model.providerName || model.providerId || model.provider || "").trim(),
    }).id,
    requestSurface: inferRequestSurface(model.endpoint),
    endpointType: String(model.endpoint || "").trim(),
    priority: Number(model.priority || 0),
    weight: Number(model.weight || 0),
    enabled: specKey === "default" ? true : rule?.enabled !== false,
    creditCost: specKey === "default"
      ? Math.max(1, Number(model.creditCost || 1))
      : Math.max(1, Number(rule?.creditCost || model.creditCost || 1)),
    supportsParallelFanout: Boolean(model.mixWithSameModel),
  };
}

export function buildCreditModelCatalog(models: CreditRouteModelSource[]): CreditModelCatalogEntry[] {
  const grouped = new Map<string, CreditRouteModelSource[]>();

  for (const model of models) {
    if (!model?.id || model.isSystemModel !== true) continue;
    const list = grouped.get(model.id) || [];
    list.push(model);
    grouped.set(model.id, list);
  }

  return Array.from(grouped.entries()).map(([modelId, group]) => {
    const sample = group[0];
    const specKeys = Array.from(new Set(group.flatMap((model) => getSpecKeys(model))));
    const routeStrategy = resolveRouteStrategy(group);

    const specs = specKeys.map((specKey) => {
      const specId = `${modelId}:${specKey}`;
      const resolved = getSpecCreditPrice(group, specKey);

      return {
        id: specId,
        modelId,
        sizeSpec: specKey,
        displayLabel: specKey === "default" ? sample.displayName : `${sample.displayName} ${specKey}`,
        creditPrice: resolved.creditPrice,
        enabled: resolved.enabled,
        routeStrategy,
        routeUnits: group.map((model) => buildRouteUnit(model, specId, specKey)),
      };
    });

    return {
      id: modelId,
      displayName: sample.displayName,
      family: inferModelFamily(sample.endpoint, modelId),
      isActive: specs.some((spec) => spec.enabled),
      specs,
    };
  });
}

export function pickCreditModelSpec(
  catalog: CreditModelCatalogEntry | undefined,
  imageSize?: string | null,
): CreditModelSpec | undefined {
  if (!catalog) return undefined;
  if (!imageSize) {
    return catalog.specs.find((spec) => spec.sizeSpec === "default") || catalog.specs[0];
  }

  const normalized = normalizeAdminQualityKey(imageSize);
  return catalog.specs.find((spec) => spec.sizeSpec === normalized)
    || catalog.specs.find((spec) => spec.sizeSpec === "default")
    || catalog.specs[0];
}

export function pickCreditRouteUnit(
  spec: CreditModelSpec | undefined,
  preferredSupplierId?: string | null,
): CreditRouteUnit | undefined {
  if (!spec) return undefined;

  const enabledUnits = spec.routeUnits.filter((unit) => unit.enabled !== false);
  if (enabledUnits.length === 0) {
    return spec.routeUnits[0];
  }

  const normalizedPreferredSupplierId = String(preferredSupplierId || '').trim().toLowerCase();
  if (normalizedPreferredSupplierId) {
    const exact = enabledUnits.find((unit) => String(unit.supplierId || '').trim().toLowerCase() === normalizedPreferredSupplierId);
    if (exact) {
      return exact;
    }
  }

  return [...enabledUnits].sort((left, right) => {
    const priorityDiff = Number(right.priority || 0) - Number(left.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    const weightDiff = Number(right.weight || 0) - Number(left.weight || 0);
    if (weightDiff !== 0) return weightDiff;
    return String(left.supplierId || '').localeCompare(String(right.supplierId || ''));
  })[0];
}
