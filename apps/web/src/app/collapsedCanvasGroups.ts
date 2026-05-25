import type { CanvasGroup } from '../types';

export function getCollapsedCanvasGroupNodeIds(
  groups: readonly CanvasGroup[] | null | undefined,
): Set<string> {
  const nodeIds = new Set<string>();

  groups?.forEach((group) => {
    if (!group.collapsed) {
      return;
    }

    group.nodeIds?.forEach((nodeId) => {
      nodeIds.add(nodeId);
    });
  });

  return nodeIds;
}
