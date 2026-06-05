export type PromptGroupOverlapBounds = { x: number; y: number; width: number; height: number };

const PROMPT_GROUP_OVERLAP_CELL_SIZE = 900;

const boundsIntersect = (
  left: PromptGroupOverlapBounds,
  right: PromptGroupOverlapBounds,
) => !(
  left.x + left.width <= right.x
  || right.x + right.width <= left.x
  || left.y + left.height <= right.y
  || right.y + right.height <= left.y
);

const getPromptGroupOverlapCellRange = (bounds: PromptGroupOverlapBounds) => ({
  minX: Math.floor(bounds.x / PROMPT_GROUP_OVERLAP_CELL_SIZE),
  maxX: Math.floor((bounds.x + bounds.width) / PROMPT_GROUP_OVERLAP_CELL_SIZE),
  minY: Math.floor(bounds.y / PROMPT_GROUP_OVERLAP_CELL_SIZE),
  maxY: Math.floor((bounds.y + bounds.height) / PROMPT_GROUP_OVERLAP_CELL_SIZE),
});

export const buildPromptGroupOverlapMap = (
  boundsById: ReadonlyMap<string, PromptGroupOverlapBounds>,
): Record<string, string[]> => {
  const overlapMap: Record<string, string[]> = {};
  const cells = new Map<string, string[]>();
  const comparedPairs = new Set<string>();

  boundsById.forEach((bounds, groupId) => {
    overlapMap[groupId] = [];
    const range = getPromptGroupOverlapCellRange(bounds);

    for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
      for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
        const cellKey = `${cellX}:${cellY}`;
        const occupants = cells.get(cellKey) || [];

        occupants.forEach((otherGroupId) => {
          const otherBounds = boundsById.get(otherGroupId);
          if (!otherBounds) {
            return;
          }

          const pairKey = groupId < otherGroupId
            ? `${groupId}\u0000${otherGroupId}`
            : `${otherGroupId}\u0000${groupId}`;
          if (comparedPairs.has(pairKey)) {
            return;
          }
          comparedPairs.add(pairKey);

          if (!boundsIntersect(bounds, otherBounds)) {
            return;
          }

          overlapMap[groupId].push(otherGroupId);
          overlapMap[otherGroupId].push(groupId);
        });

        if (occupants.length === 0) {
          cells.set(cellKey, [groupId]);
        } else {
          occupants.push(groupId);
        }
      }
    }
  });

  return overlapMap;
};

