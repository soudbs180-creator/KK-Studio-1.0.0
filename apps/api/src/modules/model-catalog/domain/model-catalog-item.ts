import { randomUUID } from "node:crypto";

import {
  ModelAvailability,
  type CreateAdminModelRequestDto,
  type ModelCatalogItemDto,
  type ModelCatalogListDto,
} from "../../../../../../packages/contracts/src/index.ts";

const seedItems: ModelCatalogItemDto[] = [
  {
    id: randomUUID(),
    modelCode: "gemini-2.0-flash-exp",
    displayName: "Gemini 2.0 Flash",
    kind: "chat",
    availability: ModelAvailability.Public,
    billingMode: "currency",
  },
  {
    id: randomUUID(),
    modelCode: "gemini-2.5-flash-image",
    displayName: "Nano Banana",
    kind: "image",
    availability: ModelAvailability.Public,
    billingMode: "credits",
    defaultCreditCost: 12,
  },
  {
    id: randomUUID(),
    modelCode: "veo-2.0-generate-001",
    displayName: "Veo 2.0",
    kind: "video",
    availability: ModelAvailability.Internal,
    billingMode: "credits",
    defaultCreditCost: 40,
  },
  {
    id: randomUUID(),
    modelCode: "suno-v4",
    displayName: "Suno V4",
    kind: "audio",
    availability: ModelAvailability.Public,
    billingMode: "credits",
    defaultCreditCost: 18,
  },
  {
    id: randomUUID(),
    modelCode: "text-embedding-3-large",
    displayName: "Text Embedding 3 Large",
    kind: "embedding",
    availability: ModelAvailability.Public,
    billingMode: "currency",
  },
];

export function createSeedModelCatalog(): ModelCatalogItemDto[] {
  return seedItems.map((item) => ({ ...item }));
}

export function listPublicModels(
  items: ModelCatalogItemDto[],
  kind?: ModelCatalogItemDto["kind"],
): ModelCatalogListDto {
  return {
    items: items.filter((item) =>
      item.availability === ModelAvailability.Public
      && (!kind || item.kind === kind),
    ),
  };
}

export function createAdminModel(input: CreateAdminModelRequestDto): ModelCatalogItemDto {
  return {
    id: randomUUID(),
    modelCode: input.modelCode.trim(),
    displayName: input.displayName.trim(),
    kind: input.kind,
    availability: input.availability,
    billingMode: input.billingMode || "credits",
    defaultCreditCost: typeof input.defaultCreditCost === "number"
      ? input.defaultCreditCost
      : undefined,
  };
}
