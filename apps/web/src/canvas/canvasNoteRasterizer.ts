import type { CanvasNoteNode } from '../types.ts';

const drawNoteElement = (ctx: CanvasRenderingContext2D, element: CanvasNoteNode['elements'][number]) => {
  if (element.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = element.color;
  ctx.fillStyle = element.fillColor && element.fillColor !== 'none' ? element.fillColor : 'transparent';
  ctx.lineWidth = element.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const [start, end = start] = element.points;

  if (element.type === 'pen' || element.type === 'marker') {
    if (element.type === 'marker') ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    element.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  } else if (element.type === 'rect') {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (ctx.fillStyle !== 'transparent') ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
  } else if (element.type === 'circle') {
    ctx.beginPath();
    ctx.arc((start.x + end.x) / 2, (start.y + end.y) / 2, Math.hypot(end.x - start.x, end.y - start.y) / 2, 0, Math.PI * 2);
    if (ctx.fillStyle !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (element.type === 'line' || element.type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    if (element.type === 'arrow') {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const length = 14 + element.width * 1.5;
      ctx.lineTo(end.x - length * Math.cos(angle - Math.PI / 6), end.y - length * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - length * Math.cos(angle + Math.PI / 6), end.y - length * Math.sin(angle + Math.PI / 6));
    }
    ctx.stroke();
  } else if (element.type === 'text' && element.text) {
    ctx.fillStyle = element.color;
    ctx.font = `500 ${element.fontSize || 16}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(element.text, start.x, start.y);
  }
  ctx.restore();
};

export type CanvasNoteRasterResult = {
  blob: Blob;
  mimeType: 'image/png';
  width: number;
  height: number;
  sourceNodeIds: string[];
};

export const rasterizeCanvasNote = async (
  note: CanvasNoteNode,
  options: { scale?: number; background?: string } = {},
): Promise<CanvasNoteRasterResult> => {
  const scale = Math.min(4, Math.max(0.5, options.scale || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(4096, Math.max(1, Math.round(note.width * scale)));
  canvas.height = Math.min(4096, Math.max(1, Math.round(note.height * scale)));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  ctx.scale(scale, scale);
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, note.width, note.height);
  }
  note.elements.forEach((element) => drawNoteElement(ctx, element));
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Notebook rasterization failed.')), 'image/png');
  });
  return {
    blob,
    mimeType: 'image/png',
    width: canvas.width,
    height: canvas.height,
    sourceNodeIds: note.sourceNodeIds || [],
  };
};
