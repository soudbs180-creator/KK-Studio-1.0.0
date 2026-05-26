import type { EcommerceSlotDeliveryKind } from '../../types';

type EcommerceGroupKey = 'main' | 'aplus';
type EcommerceSlotResultSource = 'generated' | 'redraw';

export interface EcommerceSlotHistoryEntry {
  imageId: string;
  source: EcommerceSlotResultSource;
}

export interface EcommerceSlotDeliveryState {
  deliveryKind: EcommerceSlotDeliveryKind;
  currentImageId: string | null;
  currentSource: EcommerceSlotResultSource | null;
  history: EcommerceSlotHistoryEntry[];
}

export interface EcommerceGroupSlotState {
  slotId: string;
  groupKey: EcommerceGroupKey;
  sourceKey: string;
  selected: boolean;
  currentImageId: string | null;
  currentSource: EcommerceSlotResultSource | null;
  deliveries: EcommerceSlotDeliveryState[];
  history: EcommerceSlotHistoryEntry[];
}

export interface BuildInitialEcommerceGroupSlotStateInput {
  groupKey: EcommerceGroupKey;
  slots: Array<{
    slotId: string;
    sourceKey: string;
    deliveryKinds?: EcommerceSlotDeliveryKind[];
  }>;
  selectedItems: Record<string, boolean>;
}

export interface ApplyEcommerceSlotResultInput {
  slotId: string;
  deliveryKind?: EcommerceSlotDeliveryKind;
  imageId: string;
  source: EcommerceSlotResultSource;
}

export interface EcommerceSlotPreviewBundle<TImage> {
  images: TImage[];
  initialIndex: number;
}

function buildInitialDeliveries(deliveryKinds?: EcommerceSlotDeliveryKind[]): EcommerceSlotDeliveryState[] {
  const normalizedKinds = Array.from(new Set((deliveryKinds && deliveryKinds.length > 0 ? deliveryKinds : ['default']) as EcommerceSlotDeliveryKind[]));
  return normalizedKinds.map((deliveryKind) => ({
    deliveryKind,
    currentImageId: null,
    currentSource: null,
    history: [],
  }));
}

function ensureDeliveryState(
  deliveries: EcommerceSlotDeliveryState[],
  deliveryKind: EcommerceSlotDeliveryKind,
): EcommerceSlotDeliveryState[] {
  if (deliveries.some((entry) => entry.deliveryKind === deliveryKind)) {
    return deliveries;
  }

  return [
    ...deliveries,
    {
      deliveryKind,
      currentImageId: null,
      currentSource: null,
      history: [],
    },
  ];
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
    deliveries: buildInitialDeliveries(slot.deliveryKinds),
    history: [],
  }));
}

export function applyEcommerceSlotResult(
  slots: EcommerceGroupSlotState[],
  input: ApplyEcommerceSlotResultInput,
): EcommerceGroupSlotState[] {
  const deliveryKind = input.deliveryKind || 'default';

  return slots.map((slot) => {
    if (slot.slotId !== input.slotId) {
      return slot;
    }

    const nextDeliveries = ensureDeliveryState(slot.deliveries, deliveryKind).map((delivery) => {
      if (delivery.deliveryKind !== deliveryKind) {
        return delivery;
      }

      if (delivery.currentImageId === input.imageId && delivery.currentSource === input.source) {
        return delivery;
      }

      return {
        ...delivery,
        currentImageId: input.imageId,
        currentSource: input.source,
        history: [
          ...delivery.history,
          {
            imageId: input.imageId,
            source: input.source,
          },
        ],
      };
    });

    const activeDelivery = nextDeliveries.find((delivery) => delivery.deliveryKind === deliveryKind)
      || nextDeliveries[nextDeliveries.length - 1];

    if (
      slot.currentImageId === input.imageId
      && slot.currentSource === input.source
      && activeDelivery?.currentImageId === input.imageId
      && activeDelivery?.currentSource === input.source
    ) {
      return slot;
    }

    return {
      ...slot,
      currentImageId: input.imageId,
      currentSource: input.source,
      deliveries: nextDeliveries,
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
  slot: Pick<EcommerceGroupSlotState, 'history' | 'currentImageId' | 'deliveries'>,
  imagesById: ReadonlyMap<string, TImage>,
  preferredImageId?: string | null,
  deliveryKind?: EcommerceSlotDeliveryKind,
): EcommerceSlotPreviewBundle<TImage> | null {
  const scopedDelivery = deliveryKind
    ? slot.deliveries.find((entry) => entry.deliveryKind === deliveryKind)
    : undefined;
  const scopedHistory = scopedDelivery?.history ?? slot.history;
  const scopedCurrentImageId = scopedDelivery?.currentImageId ?? slot.currentImageId;

  const orderedIds = scopedHistory.map((entry) => entry.imageId);
  if (scopedCurrentImageId && !orderedIds.includes(scopedCurrentImageId)) {
    orderedIds.push(scopedCurrentImageId);
  }

  const images = orderedIds
    .map((imageId) => imagesById.get(imageId))
    .filter((image): image is TImage => Boolean(image));

  if (images.length === 0) {
    return null;
  }

  const targetImageId = preferredImageId ?? scopedCurrentImageId ?? images[images.length - 1].id;
  const initialIndex = Math.max(0, images.findIndex((image) => image.id === targetImageId));

  return {
    images,
    initialIndex,
  };
}
