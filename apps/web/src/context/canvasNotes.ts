import type { Canvas, CanvasDrawing, CanvasNoteNode } from '../types.ts';
import { createCanvasCardPresentation } from './canvasPresentationMigration.ts';

export const convertCanvasDrawingsToNote = (
  canvas: Canvas,
  drawingIds: readonly string[],
  options: { id?: string; title?: string; now?: number } = {},
): Canvas => {
  const ids = new Set(drawingIds.filter(Boolean));
  if (ids.size === 0) throw new Error('At least one drawing is required.');
  const drawings = canvas.drawings.filter((drawing) => ids.has(drawing.id));
  const missingIds = [...ids].filter((id) => !drawings.some((drawing) => drawing.id === id));
  if (missingIds.length > 0) throw new Error(`Cannot find drawings: ${missingIds.join(', ')}`);
  const points = drawings.flatMap((drawing) => drawing.points || []);
  if (points.length === 0) throw new Error('Selected drawings do not contain vector points.');

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(280, maxX - minX + 48);
  const height = Math.max(180, maxY - minY + 72);
  const left = minX - 24 - Math.max(0, width - (maxX - minX + 48)) / 2;
  const top = minY - 48 - Math.max(0, height - (maxY - minY + 72)) / 2;
  const now = options.now ?? Date.now();
  const note: CanvasNoteNode = {
    id: options.id || `note-${now.toString(36)}`,
    title: options.title || 'Notebook',
    position: { x: left + width / 2, y: top + height },
    width,
    height,
    elements: drawings.map((drawing: CanvasDrawing) => ({
      id: drawing.id,
      type: drawing.type,
      points: drawing.points.map((point) => ({ x: point.x - left, y: point.y - top })),
      color: drawing.color,
      width: drawing.width,
      fillColor: drawing.fillColor,
      text: drawing.text,
      fontSize: drawing.fontSize,
      bindingNodeId: drawing.bindingNodeId,
      bindingGroupId: drawing.bindingGroupId,
    })),
    sourceNodeIds: Array.from(new Set(drawings.flatMap((drawing) => (
      [drawing.bindingNodeId, drawing.bindingGroupId].filter(Boolean) as string[]
    )))),
    presentation: createCanvasCardPresentation('notebook', 'column', width >= 380 ? 'wide' : 'standard'),
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...canvas,
    drawings: canvas.drawings.filter((drawing) => !ids.has(drawing.id)),
    noteNodes: [...(canvas.noteNodes || []), note],
    lastModified: now,
  };
};

export const restoreCanvasNoteToDrawings = (
  canvas: Canvas,
  noteId: string,
  options: { now?: number } = {},
): Canvas => {
  const note = (canvas.noteNodes || []).find((candidate) => candidate.id === noteId);
  if (!note) throw new Error(`Cannot find notebook card: ${noteId}`);
  const left = note.position.x - note.width / 2;
  const top = note.position.y - note.height;
  const restoredDrawings: CanvasDrawing[] = note.elements.map((element) => ({
    id: element.id,
    type: element.type,
    points: element.points.map((point) => ({ x: point.x + left, y: point.y + top })),
    color: element.color,
    width: element.width,
    fillColor: element.fillColor,
    text: element.text,
    fontSize: element.fontSize,
    bindingNodeId: element.bindingNodeId,
    bindingGroupId: element.bindingGroupId,
  }));
  const restoredIds = new Set(restoredDrawings.map((drawing) => drawing.id));
  return {
    ...canvas,
    drawings: [
      ...canvas.drawings.filter((drawing) => !restoredIds.has(drawing.id)),
      ...restoredDrawings,
    ],
    noteNodes: (canvas.noteNodes || []).filter((candidate) => candidate.id !== noteId),
    lastModified: options.now ?? Date.now(),
  };
};
