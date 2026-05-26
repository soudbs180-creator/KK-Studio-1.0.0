import type { EcommerceGroupSlotState } from '../services/ecommerce/groupSlotState.ts';
import { GenerationMode, type EcommerceGroupSheet, type PromptNode } from '../types';

export type EcommerceSelectionRuntimeState = {
  selectedItems: Record<string, boolean>;
  groupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
};

export function applyEcommerceAnalysisSelectionState<TState extends EcommerceSelectionRuntimeState>(
  previousState: TState,
  id: string,
  selected: boolean,
): TState {
  return {
    ...previousState,
    selectedItems: {
      ...previousState.selectedItems,
      [id]: selected,
    },
  } as TState;
}

export function applyEcommerceNodeSelectionState<TState extends EcommerceSelectionRuntimeState>(
  previousState: TState,
  node: PromptNode,
  selected: boolean,
): TState {
  if (!node.ecommerce) {
    return previousState;
  }

  const selectedItemKey = node.ecommerce.sourceRowKey || node.id;
  const slotSourceKey = node.ecommerce.sourceRowKey;
  const sourceSheet = node.ecommerce.sourceSheet;

  return {
    ...previousState,
    selectedItems: {
      ...previousState.selectedItems,
      [selectedItemKey]: selected,
    },
    groupSlots: {
      ...previousState.groupSlots,
      [sourceSheet]: (previousState.groupSlots[sourceSheet] || []).map((slot) => (
        slot.sourceKey === slotSourceKey
          ? { ...slot, selected }
          : slot
      )),
    },
  } as TState;
}

export function resolveEcommerceGroupSelectionTargets(
  promptNodes: PromptNode[] | null | undefined,
  groupNode: PromptNode,
): PromptNode[] {
  if (!groupNode.ecommerce || groupNode.ecommerce.kind !== 'a-plus-group') {
    return [];
  }

  return (promptNodes || []).filter((node) => (
    node.mode === GenerationMode.ECOMMERCE
    && node.ecommerce?.groupId === groupNode.id
    && node.ecommerce.kind !== 'a-plus-group'
    && node.ecommerce.kind !== 'framework'
  ));
}

export function applyEcommerceGroupSelectionState<TState extends EcommerceSelectionRuntimeState>(
  previousState: TState,
  groupNode: PromptNode,
  childNodes: PromptNode[],
  selected: boolean,
): TState {
  if (!groupNode.ecommerce || groupNode.ecommerce.kind !== 'a-plus-group') {
    return previousState;
  }

  const affectedSourceKeys = new Set(
    (childNodes || [])
      .map((node) => node.ecommerce?.sourceRowKey)
      .filter((sourceKey): sourceKey is string => Boolean(sourceKey)),
  );
  const sourceSheet = groupNode.ecommerce.sourceSheet;

  return {
    ...previousState,
    selectedItems: {
      ...previousState.selectedItems,
      ...Object.fromEntries(Array.from(affectedSourceKeys).map((sourceKey) => [sourceKey, selected])),
    },
    groupSlots: {
      ...previousState.groupSlots,
      [sourceSheet]: (previousState.groupSlots[sourceSheet] || []).map((slot) => (
        affectedSourceKeys.has(slot.sourceKey)
          ? { ...slot, selected }
          : slot
      )),
    },
  } as TState;
}
