import { CanvasSpatialIndex, type CanvasNodeBounds } from '../canvas/CanvasSpatialIndex.ts';

export interface MinimapIndexNode {
  id: string;
  position: { x: number; y: number };
  hiddenInCanvas?: boolean;
  url?: unknown;
  storageId?: unknown;
}

export interface MinimapIndexedNode extends MinimapIndexNode {
  minimapKind: 'prompt' | 'image';
}

export interface MinimapSpatialIndexSnapshot {
  spatialIndex: CanvasSpatialIndex;
  nodeById: Map<string, MinimapIndexedNode>;
  orderById: Map<string, number>;
  totalNodeCount: number;
}

const MINIMAP_PROMPT_WIDTH = 500;
const MINIMAP_PROMPT_HEIGHT = 300;
const MINIMAP_IMAGE_WIDTH = 380;
const MINIMAP_IMAGE_HEIGHT = 380;

function getMinimapNodeBounds(node: MinimapIndexedNode): CanvasNodeBounds {
  const isImage = node.minimapKind === 'image';
  return {
    x: node.position.x,
    y: node.position.y,
    width: isImage ? MINIMAP_IMAGE_WIDTH : MINIMAP_PROMPT_WIDTH,
    height: isImage ? MINIMAP_IMAGE_HEIGHT : MINIMAP_PROMPT_HEIGHT,
  };
}

function intersects(bounds: CanvasNodeBounds, minX: number, minY: number, maxX: number, maxY: number): boolean {
  return !(
    bounds.x + bounds.width < minX
    || bounds.x > maxX
    || bounds.y + bounds.height < minY
    || bounds.y > maxY
  );
}

export function buildMinimapSpatialIndex(
  promptNodes: MinimapIndexNode[] | undefined | null,
  imageNodes: MinimapIndexNode[] | undefined | null,
): MinimapSpatialIndexSnapshot {
  const spatialIndex = new CanvasSpatialIndex(900);
  const nodeById = new Map<string, MinimapIndexedNode>();
  const orderById = new Map<string, number>();
  let order = 0;

  const addNode = (node: MinimapIndexNode, minimapKind: MinimapIndexedNode['minimapKind']) => {
    if (!node?.id || !node.position) {
      return;
    }
    if (minimapKind === 'prompt' && node.hiddenInCanvas) {
      return;
    }

    const indexedNode: MinimapIndexedNode = {
      ...node,
      minimapKind,
    };
    nodeById.set(indexedNode.id, indexedNode);
    orderById.set(indexedNode.id, order);
    order += 1;
    spatialIndex.updateNode(indexedNode.id, getMinimapNodeBounds(indexedNode));
  };

  (promptNodes || []).forEach((node) => addNode(node, 'prompt'));
  (imageNodes || []).forEach((node) => addNode(node, 'image'));

  return {
    spatialIndex,
    nodeById,
    orderById,
    totalNodeCount: nodeById.size,
  };
}

export function selectMinimapVisibleNodes(
  snapshot: MinimapSpatialIndexSnapshot,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): MinimapIndexedNode[] {
  const candidateIds = snapshot.spatialIndex.query(minX, minY, maxX, maxY);
  const visibleNodes: MinimapIndexedNode[] = [];

  candidateIds.forEach((nodeId) => {
    const node = snapshot.nodeById.get(nodeId);
    const bounds = snapshot.spatialIndex.getNodeBounds(nodeId);
    if (!node || !bounds || !intersects(bounds, minX, minY, maxX, maxY)) {
      return;
    }
    visibleNodes.push(node);
  });

  visibleNodes.sort((left, right) => (
    (snapshot.orderById.get(left.id) ?? 0) - (snapshot.orderById.get(right.id) ?? 0)
  ));

  return visibleNodes;
}
