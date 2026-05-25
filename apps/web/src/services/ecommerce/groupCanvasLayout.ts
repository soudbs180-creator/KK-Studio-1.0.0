type GroupKey = 'main' | 'aplus';

export interface GroupSlotPlan {
  slotId: string;
  sourceKey: string;
  position: { x: number; y: number };
}

export interface GroupPlan {
  groupKey: GroupKey;
  label: string;
  exportLabel: string;
  position: { x: number; y: number };
  slots: GroupSlotPlan[];
}

export interface BuildEcommerceCanvasGroupLayoutInput {
  basePosition: { x: number; y: number };
  mainSlotKeys: string[];
  aPlusSlotKeys: string[];
  columnGap?: number;
  shellToSlotGap?: number;
  slotGap?: number;
}

export interface EcommerceCanvasGroupLayoutPlan {
  mainGroup: GroupPlan;
  aPlusGroup: GroupPlan;
}

const DEFAULT_COLUMN_GAP = 940;
const DEFAULT_SHELL_TO_SLOT_GAP = 180;
const DEFAULT_SLOT_GAP = 220;

function buildSlots(params: {
  groupKey: GroupKey;
  sourceKeys: string[];
  x: number;
  baseY: number;
  shellToSlotGap: number;
  slotGap: number;
}): GroupSlotPlan[] {
  return params.sourceKeys.map((sourceKey, index) => ({
    slotId: `${params.groupKey}-slot-${index + 1}`,
    sourceKey,
    position: {
      x: params.x,
      y: params.baseY + params.shellToSlotGap + index * params.slotGap,
    },
  }));
}

export function buildEcommerceCanvasGroupLayout(
  input: BuildEcommerceCanvasGroupLayoutInput,
): EcommerceCanvasGroupLayoutPlan {
  const columnGap = input.columnGap ?? DEFAULT_COLUMN_GAP;
  const shellToSlotGap = input.shellToSlotGap ?? DEFAULT_SHELL_TO_SLOT_GAP;
  const slotGap = input.slotGap ?? DEFAULT_SLOT_GAP;

  const mainGroupPosition = { ...input.basePosition };
  const aPlusGroupPosition = {
    x: input.basePosition.x + columnGap,
    y: input.basePosition.y,
  };

  return {
    mainGroup: {
      groupKey: 'main',
      label: '主图',
      exportLabel: '主图包',
      position: mainGroupPosition,
      slots: buildSlots({
        groupKey: 'main',
        sourceKeys: input.mainSlotKeys,
        x: mainGroupPosition.x,
        baseY: mainGroupPosition.y,
        shellToSlotGap,
        slotGap,
      }),
    },
    aPlusGroup: {
      groupKey: 'aplus',
      label: 'A+',
      exportLabel: 'A+包',
      position: aPlusGroupPosition,
      slots: buildSlots({
        groupKey: 'aplus',
        sourceKeys: input.aPlusSlotKeys,
        x: aPlusGroupPosition.x,
        baseY: aPlusGroupPosition.y,
        shellToSlotGap,
        slotGap,
      }),
    },
  };
}
