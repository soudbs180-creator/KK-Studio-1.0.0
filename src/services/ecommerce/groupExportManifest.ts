import type { EcommerceSlotDeliveryKind } from '../../types.ts';

export type EcommerceGroupPackageType = 'main-image-group' | 'a-plus-group';
export type EcommerceGroupExportSlotStatus = 'exported' | 'skipped' | 'missing';
export type EcommerceGroupExportLatestSource = 'generated' | 'redraw';

export interface EcommerceGroupExportDeliverableInput {
  deliveryKind: EcommerceSlotDeliveryKind;
  latestImageId?: string;
  latestSource?: EcommerceGroupExportLatestSource;
  fileName?: string;
}

export interface EcommerceGroupExportSlotInput {
  slotId: string;
  slotLabel: string;
  selectedForGeneration: boolean;
  latestImageId?: string;
  latestSource?: EcommerceGroupExportLatestSource;
  fileName?: string;
  deliverables?: EcommerceGroupExportDeliverableInput[];
}

export interface BuildEcommerceGroupExportManifestInput {
  packageType: EcommerceGroupPackageType;
  groupId: string;
  groupLabel: string;
  sourcePromptId: string;
  slots: EcommerceGroupExportSlotInput[];
}

export interface EcommerceGroupExportManifestDeliverable {
  deliveryKind: EcommerceSlotDeliveryKind;
  status: EcommerceGroupExportSlotStatus;
  latestImageId?: string;
  latestSource?: EcommerceGroupExportLatestSource;
  fileName?: string;
  imageQuality?: 'original' | 'fallback';
}

export interface EcommerceGroupExportManifestSlot {
  slotId: string;
  slotLabel: string;
  status: EcommerceGroupExportSlotStatus;
  selectedForGeneration: boolean;
  latestImageId?: string;
  latestSource?: EcommerceGroupExportLatestSource;
  fileName?: string;
  imageQuality?: 'original' | 'fallback';
  deliverables?: EcommerceGroupExportManifestDeliverable[];
}

export interface EcommerceGroupExportManifest {
  version: 1;
  exportedAt: string;
  packageType: EcommerceGroupPackageType;
  groupId: string;
  groupLabel: string;
  sourcePromptId: string;
  slots: EcommerceGroupExportManifestSlot[];
}

function resolveSlotStatus(slot: Pick<EcommerceGroupExportSlotInput, 'selectedForGeneration' | 'latestImageId' | 'fileName'>): EcommerceGroupExportSlotStatus {
  if (!slot.selectedForGeneration) {
    return 'skipped';
  }

  if (slot.latestImageId && slot.fileName) {
    return 'exported';
  }

  return 'missing';
}

function resolveDeliverableStatus(
  deliverable: EcommerceGroupExportDeliverableInput,
): EcommerceGroupExportSlotStatus {
  if (deliverable.latestImageId && deliverable.fileName) {
    return 'exported';
  }

  return 'missing';
}

export function buildEcommerceGroupExportManifest(
  input: BuildEcommerceGroupExportManifestInput,
): EcommerceGroupExportManifest {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    packageType: input.packageType,
    groupId: input.groupId,
    groupLabel: input.groupLabel,
    sourcePromptId: input.sourcePromptId,
    slots: input.slots.map((slot) => {
      const deliverables = slot.deliverables?.map((deliverable) => {
        const status = resolveDeliverableStatus(deliverable);

        return status === 'exported'
          ? {
              deliveryKind: deliverable.deliveryKind,
              status,
              latestImageId: deliverable.latestImageId,
              latestSource: deliverable.latestSource ?? 'generated',
              fileName: deliverable.fileName,
            }
          : {
              deliveryKind: deliverable.deliveryKind,
              status,
            };
      });

      const status = deliverables && deliverables.length > 0
        ? (deliverables.some((deliverable) => deliverable.status === 'exported') ? 'exported' : 'missing')
        : resolveSlotStatus(slot);

      if (deliverables && deliverables.length > 0) {
        return {
          slotId: slot.slotId,
          slotLabel: slot.slotLabel,
          status,
          selectedForGeneration: slot.selectedForGeneration,
          deliverables,
        };
      }

      return status === 'exported'
        ? {
            slotId: slot.slotId,
            slotLabel: slot.slotLabel,
            status,
            selectedForGeneration: slot.selectedForGeneration,
            latestImageId: slot.latestImageId,
            latestSource: slot.latestSource ?? 'generated',
            fileName: slot.fileName,
          }
        : {
            slotId: slot.slotId,
            slotLabel: slot.slotLabel,
            status,
            selectedForGeneration: slot.selectedForGeneration,
          };
    }),
  };
}
