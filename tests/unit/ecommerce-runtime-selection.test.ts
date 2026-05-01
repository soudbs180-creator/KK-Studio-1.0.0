import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyEcommerceAnalysisSelectionState,
  applyEcommerceGroupSelectionState,
  applyEcommerceNodeSelectionState,
  resolveEcommerceGroupSelectionTargets,
} from '../../src/app/ecommerceSelectionRuntime.ts';
import { AspectRatio, GenerationMode, ImageSize, type PromptNode } from '../../src/types.ts';
import type { EcommerceGroupSlotState } from '../../src/services/ecommerce/groupSlotState.ts';

type SelectionState = {
  selectedItems: Record<string, boolean>;
  groupSlots: Record<'主图' | 'A+', EcommerceGroupSlotState[]>;
  untouched: string;
};

function createSlot(sourceKey: string, selected = true): EcommerceGroupSlotState {
  return {
    slotId: `${sourceKey}-slot`,
    groupKey: sourceKey.startsWith('main') ? 'main' : 'aplus',
    sourceKey,
    selected,
    currentImageId: null,
    currentSource: null,
    deliveries: [],
    history: [],
  };
}

function createEcommerceNode(
  id: string,
  ecommerce: Partial<NonNullable<PromptNode['ecommerce']>>,
): PromptNode {
  return {
    id,
    prompt: id,
    position: { x: 0, y: 0 },
    aspectRatio: AspectRatio.SQUARE,
    imageSize: ImageSize.SIZE_1K,
    model: 'gemini-3.1-flash-image-preview',
    childImageIds: [],
    timestamp: 1,
    mode: GenerationMode.ECOMMERCE,
    ecommerce: {
      kind: 'a-plus-module',
      sourceSheet: 'A+',
      sourceRowKey: id,
      stage: 'ready',
      desktopStage: 'pending',
      mobileStage: 'locked',
      ...ecommerce,
    },
  } as PromptNode;
}

test('ecommerce runtime selection helpers keep selected items and group slots synchronized', () => {
  const state: SelectionState = {
    selectedItems: { existing: true },
    groupSlots: {
      '主图': [createSlot('main-1')],
      'A+': [createSlot('module-1'), createSlot('module-2')],
    },
    untouched: 'preserved',
  };

  const afterAnalysisToggle = applyEcommerceAnalysisSelectionState(state, 'analysis-row', false);
  assert.equal(afterAnalysisToggle.selectedItems['analysis-row'], false);
  assert.equal(afterAnalysisToggle.untouched, 'preserved');

  const moduleNode = createEcommerceNode('node-1', {
    sourceSheet: 'A+',
    sourceRowKey: 'module-1',
    groupId: 'group-1',
  });
  const afterNodeToggle = applyEcommerceNodeSelectionState(afterAnalysisToggle, moduleNode, false);
  assert.equal(afterNodeToggle.selectedItems['module-1'], false);
  assert.equal(afterNodeToggle.groupSlots['A+'][0].selected, false);
  assert.equal(afterNodeToggle.groupSlots['A+'][1].selected, true);
  assert.equal(afterNodeToggle.groupSlots['主图'][0].selected, true);

  const groupNode = createEcommerceNode('group-1', {
    kind: 'a-plus-group',
    sourceSheet: 'A+',
    sourceRowKey: 'group-1',
  });
  const secondModule = createEcommerceNode('node-2', {
    sourceSheet: 'A+',
    sourceRowKey: 'module-2',
    groupId: 'group-1',
  });
  const nestedGroup = createEcommerceNode('nested-group', {
    kind: 'a-plus-group',
    sourceSheet: 'A+',
    sourceRowKey: 'nested-group',
    groupId: 'group-1',
  });
  const frameworkNode = createEcommerceNode('framework', {
    kind: 'framework',
    sourceSheet: 'A+',
    sourceRowKey: 'framework',
    groupId: 'group-1',
  });

  const targets = resolveEcommerceGroupSelectionTargets(
    [moduleNode, nestedGroup, frameworkNode, secondModule],
    groupNode,
  );
  assert.deepEqual(targets.map((node) => node.id), ['node-1', 'node-2']);

  const afterGroupToggle = applyEcommerceGroupSelectionState(afterNodeToggle, groupNode, targets, true);
  assert.equal(afterGroupToggle.selectedItems['module-1'], true);
  assert.equal(afterGroupToggle.selectedItems['module-2'], true);
  assert.equal(afterGroupToggle.selectedItems['nested-group'], undefined);
  assert.equal(afterGroupToggle.selectedItems.framework, undefined);
  assert.equal(afterGroupToggle.groupSlots['A+'][0].selected, true);
  assert.equal(afterGroupToggle.groupSlots['A+'][1].selected, true);
});
