import type { CanvasConnection } from '@kk/shared';
import type { Canvas, CanvasDrawing } from '../types';

type CanvasPoint = { x: number; y: number };

export const updateCanvasDrawingsOnCanvas = (
  canvas: Canvas,
  ids: string[],
  updates: Partial<CanvasDrawing>,
): Canvas => {
  const targetIds = new Set(ids.filter(Boolean));
  return {
    ...canvas,
    drawings: (canvas.drawings || []).map((drawing) => (
      targetIds.has(drawing.id) ? { ...drawing, ...updates } : drawing
    )),
  };
};

export const moveCanvasDrawingsOnCanvas = (
  canvas: Canvas,
  ids: string[],
  delta: CanvasPoint,
): Canvas => {
  const targetIds = new Set(ids.filter(Boolean));
  return {
    ...canvas,
    drawings: (canvas.drawings || []).map((drawing) => (
      targetIds.has(drawing.id)
        ? { ...drawing, points: drawing.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })) }
        : drawing
    )),
  };
};

export const upsertCanvasConnectionOnCanvas = (canvas: Canvas, connection: CanvasConnection): Canvas => ({
  ...canvas,
  connections: [...(canvas.connections || []).filter((item) => item.id !== connection.id), connection],
});

export const deleteCanvasConnectionOnCanvas = (canvas: Canvas, id: string): Canvas => ({
  ...canvas,
  connections: (canvas.connections || []).filter((connection) => connection.id !== id),
});

export const updateCanvasConnectionOnCanvas = (
  canvas: Canvas,
  id: string,
  updates: Partial<CanvasConnection>,
): Canvas => ({
  ...canvas,
  connections: (canvas.connections || []).map((connection) => (
    connection.id === id ? { ...connection, ...updates, updatedAt: Date.now() } : connection
  )),
});

const resolveNodePosition = (canvas: Canvas, nodeId: string): CanvasPoint | undefined => (
  canvas.promptNodes.find((node) => node.id === nodeId)?.position
  || canvas.imageNodes.find((node) => node.id === nodeId)?.position
  || canvas.workflow?.nodes.find((node) => node.id === nodeId)?.position
);

export const createCanvasConnectionOnCanvas = (
  canvas: Canvas,
  sourceNodeId: string,
  targetNodeId: string,
  generateId: () => string,
  sourcePort?: CanvasConnection['sourcePort'],
  targetPort?: CanvasConnection['targetPort'],
): CanvasConnection | null => {
  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return null;
  const source = resolveNodePosition(canvas, sourceNodeId);
  const target = resolveNodePosition(canvas, targetNodeId);
  if (!source || !target) return null;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const sourceSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  const targetSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
  const now = Date.now();
  const existing = (canvas.connections || []).find((connection) => (
    connection.sourceNodeId === sourceNodeId && connection.targetNodeId === targetNodeId
  ));
  const connection = existing || {
    id: `connection-${generateId()}`,
    sourceNodeId,
    targetNodeId,
    sourcePort: sourceSide,
    targetPort: targetSide,
    style: 'solid' as const,
    createdAt: now,
    updatedAt: now,
  };
  return { ...connection, sourcePort: sourcePort || sourceSide, targetPort: targetPort || targetSide, updatedAt: now };
};
