export type EcommerceGroupPackageType = 'main-image-group' | 'a-plus-group';
export type EcommerceGroupExportSlotStatus = 'exported' | 'skipped' | 'missing';
export type EcommerceGroupExportLatestSource = 'generated' | 'redraw';

export interface EcommerceGroupExportSlotInput {
  slotId: string;
  slotLabel: string;
  selectedForGeneration: boolean;
  latestImageId?: string;
  latestSource?: EcommerceGroupExportLatestSource;
  fileName?: string;
}

export interface BuildEcommerceGroupExportManifestInput {
  packageType: EcommerceGroupPackageType;
  groupId: string;
  groupLabel: string;
  sourcePromptId: string;
  slots: EcommerceGroupExportSlotInput[];
}

export interface EcommerceGroupExportManifestSlot {
  slotId: string;
  slotLabel: string;
  status: EcommerceGroupExportSlotStatus;
  selectedForGeneration: boolean;
  latestImageId?: string;
  latestSource?: EcommerceGroupExportLatestSource;
  fileName?: string;
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

function resolveSlotStatus(slot: EcommerceGroupExportSlotInput): EcommerceGroupExportSlotStatus {
  if (!slot.selectedForGeneration) {
    return 'skipped';
  }

  if (slot.latestImageId && slot.fileName) {
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
      const status = resolveSlotStatus(slot);

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
