type EcommerceGroupKey = 'main' | 'aplus';
type EcommerceSlotResultSource = 'generated' | 'redraw';

export interface EcommerceSlotHistoryEntry {
  imageId: string;
  source: EcommerceSlotResultSource;
}

export interface EcommerceGroupSlotState {
  slotId: string;
  groupKey: EcommerceGroupKey;
  sourceKey: string;
  selected: boolean;
  currentImageId: string | null;
  currentSource: EcommerceSlotResultSource | null;
  history: EcommerceSlotHistoryEntry[];
}

export interface BuildInitialEcommerceGroupSlotStateInput {
  groupKey: EcommerceGroupKey;
  slots: Array<{
    slotId: string;
    sourceKey: string;
  }>;
  selectedItems: Record<string, boolean>;
}

export interface ApplyEcommerceSlotResultInput {
  slotId: string;
  imageId: string;
  source: EcommerceSlotResultSource;
}

export interface EcommerceSlotPreviewBundle<TImage> {
  images: TImage[];
  initialIndex: number;
}

export function buildInitialEcommerceGroupSlotState(
  input: BuildInitialEcommerceGroupSlotStateInput,
): EcommerceGroupSlotState[] {
  return input.slots.map((slot) => ({
    slotId: slot.slotId,
    groupKey: input.groupKey,
    sourceKey: slot.sourceKey,
    selected: input.selectedItems[slot.sourceKey] !== false,
    currentImageId: null,
    currentSource: null,
    history: [],
  }));
}

export function applyEcommerceSlotResult(
  slots: EcommerceGroupSlotState[],
  input: ApplyEcommerceSlotResultInput,
): EcommerceGroupSlotState[] {
  return slots.map((slot) => {
    if (slot.slotId !== input.slotId) {
      return slot;
    }

    if (slot.currentImageId === input.imageId && slot.currentSource === input.source) {
      return slot;
    }

    return {
      ...slot,
      currentImageId: input.imageId,
      currentSource: input.source,
      history: [
        ...slot.history,
        {
          imageId: input.imageId,
          source: input.source,
        },
      ],
      };
  });
}

export function buildEcommerceSlotPreviewBundle<TImage extends { id: string }>(
  slot: Pick<EcommerceGroupSlotState, 'history' | 'currentImageId'>,
  imagesById: ReadonlyMap<string, TImage>,
  preferredImageId?: string | null,
): EcommerceSlotPreviewBundle<TImage> | null {
  const orderedIds = slot.history.map((entry) => entry.imageId);
  if (slot.currentImageId && !orderedIds.includes(slot.currentImageId)) {
    orderedIds.push(slot.currentImageId);
  }

  const images = orderedIds
    .map((imageId) => imagesById.get(imageId))
    .filter((image): image is TImage => Boolean(image));

  if (images.length === 0) {
    return null;
  }

  const targetImageId = preferredImageId ?? slot.currentImageId ?? images[images.length - 1].id;
  const initialIndex = Math.max(0, images.findIndex((image) => image.id === targetImageId));

  return {
    images,
    initialIndex,
  };
}
