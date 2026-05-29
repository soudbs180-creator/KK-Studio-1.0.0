import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brush, Check, Eraser, ImagePlus, Lasso, Move, Palette, Redo2, RotateCcw, Send, SlidersHorizontal, SquareDashedMousePointer, Undo2, X } from 'lucide-react';

import { AspectRatio, ImageSize, type GeneratedImage, type NormalizedRect, type RedrawColorBlock, type RedrawRegion, type RedrawRequest, type RedrawStroke, type ReferenceImage } from '../../types';
import { keyManager } from '../../services/auth/keyManager';
import { getAvailableSizes } from '../../services/model/modelCapabilities';
import {
  NANO_BANANA_2_MODEL_ID,
  NANO_BANANA_PRO_MODEL_ID,
  assignColorBlockLabels,
  buildRedrawPlan,
  getDefaultLocalRedrawModel,
  isLocalRedrawModel,
} from '../../services/image/redrawCore';

type RedrawWorkspaceTool = 'pan' | 'box' | 'brush' | 'color';
type Point = { x: number; y: number };
type DrawingState = {
  regions: RedrawRegion[];
  strokes: RedrawStroke[];
  colorBlocks: RedrawColorBlock[];
};

interface RedrawWorkspaceProps {
  image: GeneratedImage;
  imageUrl: string;
  defaultModel?: string;
  isMobile?: boolean;
  initialPrompt?: string;
  initialRegions?: RedrawRegion[];
  initialColorBlocks?: RedrawColorBlock[];
  initialReferenceImages?: ReferenceImage[];
  onCancel: () => void;
  onSubmit: (request: RedrawRequest) => void;
}

const STANDARD_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

const EMPTY_DRAWING_STATE: DrawingState = {
  regions: [],
  strokes: [],
  colorBlocks: [],
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isMeaningfulRect(rect: NormalizedRect): boolean {
  return rect.width > 0.005 && rect.height > 0.005;
}

function buildRect(start: Point, end: Point): NormalizedRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function fileToReferenceImage(file: File): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      resolve({
        id: `redraw-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        data: match?.[2] || dataUrl,
        mimeType: match?.[1] || file.type || 'image/png',
        url: dataUrl,
      });
    };
    reader.onerror = () => reject(new Error(`REDRAW_REFERENCE_FILE_READ_FAILED:${file.name}`));
    reader.readAsDataURL(file);
  });
}

function strokeToPolyline(stroke: RedrawStroke): string {
  return stroke.points.map((point) => `${point.x},${point.y}`).join(' ');
}

function unionStrokeRect(points: Point[], brushSize: number, sourceDimensions: { width: number; height: number }): NormalizedRect {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const padX = brushSize / Math.max(1, sourceDimensions.width);
  const padY = brushSize / Math.max(1, sourceDimensions.height);
  return {
    x: clampUnit(minX - padX),
    y: clampUnit(minY - padY),
    width: clampUnit(maxX - minX + padX * 2),
    height: clampUnit(maxY - minY + padY * 2),
  };
}

async function buildAnnotatedReferenceImage(options: {
  imageUrl: string;
  regions: RedrawRegion[];
  colorBlocks: RedrawColorBlock[];
  sourceDimensions: { width: number; height: number };
}): Promise<ReferenceImage | undefined> {
  if (options.colorBlocks.length === 0 && options.regions.length === 0) return undefined;

  const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('REDRAW_ANNOTATION_IMAGE_DECODE_FAILED'));
    img.crossOrigin = 'anonymous';
    img.src = options.imageUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth || options.sourceDimensions.width;
  canvas.height = sourceImage.naturalHeight || options.sourceDimensions.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  const lineWidth = Math.max(3, Math.round(Math.min(canvas.width, canvas.height) * 0.004));
  if (options.colorBlocks.length === 0) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = '#34d399';
    ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
    options.regions.forEach((region, index) => {
      if (region.stroke && region.stroke.points.length > 1) {
        ctx.beginPath();
        region.stroke.points.forEach((point, pointIndex) => {
          const x = point.x * canvas.width;
          const y = point.y * canvas.height;
          if (pointIndex === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(lineWidth, region.stroke.brushSize);
        ctx.stroke();
      } else {
        const x = region.rect.x * canvas.width;
        const y = region.rect.y * canvas.height;
        const width = region.rect.width * canvas.width;
        const height = region.rect.height * canvas.height;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.max(20, Math.round(Math.min(width, height) * 0.18))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`区域${index + 1}`, x + width / 2, y + height / 2);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
      }
    });
  }
  const labeledBlocks = assignColorBlockLabels(options.colorBlocks);
  labeledBlocks.forEach((block) => {
    const x = block.rect.x * canvas.width;
    const y = block.rect.y * canvas.height;
    const width = block.rect.width * canvas.width;
    const height = block.rect.height * canvas.height;
    ctx.fillStyle = `${block.color}99`;
    ctx.strokeStyle = block.color;
    ctx.lineWidth = lineWidth;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(24, Math.round(Math.min(width, height) * 0.24))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(block.label, x + width / 2, y + height / 2);
  });

  const dataUrl = canvas.toDataURL('image/png');
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return {
    id: `redraw-color-map-${Date.now()}`,
    data: match?.[2] || dataUrl,
    mimeType: match?.[1] || 'image/png',
    url: dataUrl,
  };
}

export const RedrawWorkspace: React.FC<RedrawWorkspaceProps> = ({
  image,
  imageUrl,
  defaultModel,
  isMobile = false,
  initialPrompt = '',
  initialRegions = [],
  initialColorBlocks = [],
  initialReferenceImages = [],
  onCancel,
  onSubmit,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingStartRef = useRef<Point | null>(null);
  const activeStrokeRef = useRef<RedrawStroke | null>(null);
  const panStartRef = useRef<{ pointer: Point; pan: Point } | null>(null);
  const toolbarDragRef = useRef<{ pointer: Point; position: Point } | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  const [tool, setTool] = useState<RedrawWorkspaceTool>('box');
  const [drawingState, setDrawingState] = useState<DrawingState>(() => ({
    regions: initialRegions,
    strokes: initialRegions.map((region) => region.stroke).filter((stroke): stroke is RedrawStroke => Boolean(stroke)),
    colorBlocks: assignColorBlockLabels(initialColorBlocks),
  }));
  const [redoStack, setRedoStack] = useState<DrawingState[]>([]);
  const [history, setHistory] = useState<DrawingState[]>([]);
  const [draftRect, setDraftRect] = useState<NormalizedRect | null>(null);
  const [draftStroke, setDraftStroke] = useState<RedrawStroke | null>(null);
  const [brushSize, setBrushSize] = useState(28);
  const [selectedColor, setSelectedColor] = useState(STANDARD_COLORS[0]);
  const [customRgb, setCustomRgb] = useState('239,68,68');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(initialReferenceImages);
  const [sourceDimensions, setSourceDimensions] = useState(() => image.exactDimensions || { width: 1024, height: 1024 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [toolbarPosition, setToolbarPosition] = useState<Point>({ x: 24, y: 92 });
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockPrompt, setEditingBlockPrompt] = useState('');

  const localModelOptions = useMemo(() => {
    const configured = keyManager.getGlobalModelList()
      .filter((model) => model.type === 'image' && isLocalRedrawModel(model.id))
      .map((model) => ({ id: getDefaultLocalRedrawModel(model.id), label: model.name || model.id }));
    const fallback = [
      { id: NANO_BANANA_2_MODEL_ID, label: 'Nano Banana 2' },
      { id: NANO_BANANA_PRO_MODEL_ID, label: 'Nano Banana Pro' },
    ];
    const unique = new Map<string, { id: string; label: string }>();
    [...configured, ...fallback].forEach((model) => unique.set(model.id, model));
    return Array.from(unique.values());
  }, []);

  const [localModel, setLocalModel] = useState(() => getDefaultLocalRedrawModel(image.model));
  const hasRegions = drawingState.regions.length > 0;
  const hasColorBlocks = drawingState.colorBlocks.length > 0;
  const effectiveModel = hasRegions || hasColorBlocks ? localModel : (defaultModel || image.model);
  const canSubmit = prompt.trim().length > 0 || referenceImages.length > 0 || hasRegions || hasColorBlocks;
  const labeledColorBlocks = useMemo(() => assignColorBlockLabels(drawingState.colorBlocks), [drawingState.colorBlocks]);

  const pushHistory = useCallback(() => {
    setHistory((previous) => [...previous.slice(-24), drawingState]);
    setRedoStack([]);
  }, [drawingState]);

  const resolveNormalizedPoint = useCallback((clientX: number, clientY: number): Point | null => {
    const imageRect = imageRef.current?.getBoundingClientRect();
    if (!imageRect || imageRect.width <= 0 || imageRect.height <= 0) return null;
    if (clientX < imageRect.left || clientX > imageRect.right || clientY < imageRect.top || clientY > imageRect.bottom) {
      return null;
    }
    return {
      x: clampUnit((clientX - imageRect.left) / imageRect.width),
      y: clampUnit((clientY - imageRect.top) / imageRect.height),
    };
  }, []);

  const handleReferenceFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextRefs = await Promise.all(Array.from(files).map(fileToReferenceImage));
    setReferenceImages((previous) => [...previous, ...nextRefs].slice(0, 13));
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setScale((previous) => Math.min(5, Math.max(0.4, Number((previous + delta).toFixed(2)))));
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-redraw-control="true"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const points = Array.from(pointersRef.current.values());
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      pinchRef.current = { distance, scale };
      return;
    }

    if (tool === 'pan') {
      panStartRef.current = { pointer: { x: event.clientX, y: event.clientY }, pan };
      return;
    }

    const point = resolveNormalizedPoint(event.clientX, event.clientY);
    if (!point) return;

    if (tool === 'box' || tool === 'color') {
      drawingStartRef.current = point;
      setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
    } else if (tool === 'brush') {
      pushHistory();
      const stroke: RedrawStroke = {
        id: `redraw-stroke-${Date.now()}`,
        points: [point],
        brushSize,
        color: selectedColor,
      };
      activeStrokeRef.current = stroke;
      setDraftStroke(stroke);
    }
  }, [brushSize, pan, pushHistory, resolveNormalizedPoint, scale, selectedColor, tool]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const points = Array.from(pointersRef.current.values());
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const nextScale = pinchRef.current.scale * (distance / Math.max(1, pinchRef.current.distance));
      setScale(Math.min(5, Math.max(0.4, nextScale)));
      return;
    }

    if (toolbarDragRef.current) {
      const dx = event.clientX - toolbarDragRef.current.pointer.x;
      const dy = event.clientY - toolbarDragRef.current.pointer.y;
      setToolbarPosition({
        x: Math.max(8, toolbarDragRef.current.position.x + dx),
        y: Math.max(8, toolbarDragRef.current.position.y + dy),
      });
      return;
    }

    if (panStartRef.current) {
      setPan({
        x: panStartRef.current.pan.x + event.clientX - panStartRef.current.pointer.x,
        y: panStartRef.current.pan.y + event.clientY - panStartRef.current.pointer.y,
      });
      return;
    }

    const point = resolveNormalizedPoint(event.clientX, event.clientY);
    if (!point) return;

    if (drawingStartRef.current && draftRect) {
      setDraftRect(buildRect(drawingStartRef.current, point));
    } else if (activeStrokeRef.current) {
      const stroke = {
        ...activeStrokeRef.current,
        points: [...activeStrokeRef.current.points, point],
      };
      activeStrokeRef.current = stroke;
      setDraftStroke(stroke);
    }
  }, [draftRect, resolveNormalizedPoint]);

  const finishDraftRect = useCallback(() => {
    if (!draftRect || !isMeaningfulRect(draftRect)) {
      setDraftRect(null);
      drawingStartRef.current = null;
      return;
    }

    pushHistory();
    const id = `redraw-region-${Date.now()}`;
    const region: RedrawRegion = {
      id,
      kind: 'rect',
      rect: draftRect,
      color: tool === 'color' ? selectedColor : undefined,
    };
    const block: RedrawColorBlock | null = tool === 'color'
      ? {
          id: `redraw-block-${Date.now()}`,
          color: selectedColor,
          label: selectedColor,
          rect: draftRect,
        }
      : null;

    setDrawingState((previous) => ({
      regions: [...previous.regions, region],
      strokes: previous.strokes,
      colorBlocks: block ? assignColorBlockLabels([...previous.colorBlocks, block]) : previous.colorBlocks,
    }));
    setDraftRect(null);
    drawingStartRef.current = null;
  }, [draftRect, pushHistory, selectedColor, tool]);

  const finishDraftStroke = useCallback(() => {
    const stroke = activeStrokeRef.current;
    if (!stroke || stroke.points.length < 2) {
      activeStrokeRef.current = null;
      setDraftStroke(null);
      return;
    }

    const rect = unionStrokeRect(stroke.points, stroke.brushSize, sourceDimensions);
    const region: RedrawRegion = {
      id: `redraw-region-${Date.now()}`,
      kind: 'stroke',
      rect,
      stroke,
      color: stroke.color,
    };
    setDrawingState((previous) => ({
      regions: [...previous.regions, region],
      strokes: [...previous.strokes, stroke],
      colorBlocks: previous.colorBlocks,
    }));
    activeStrokeRef.current = null;
    setDraftStroke(null);
  }, [sourceDimensions]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (toolbarDragRef.current) {
      toolbarDragRef.current = null;
      return;
    }
    panStartRef.current = null;
    finishDraftRect();
    finishDraftStroke();
  }, [finishDraftRect, finishDraftStroke]);

  const handleUndo = useCallback(() => {
    setHistory((previous) => {
      if (previous.length === 0) return previous;
      const nextHistory = previous.slice(0, -1);
      const last = previous[previous.length - 1];
      setRedoStack((redo) => [...redo, drawingState]);
      setDrawingState(last);
      return nextHistory;
    });
  }, [drawingState]);

  const handleRedo = useCallback(() => {
    setRedoStack((previous) => {
      if (previous.length === 0) return previous;
      const nextRedo = previous.slice(0, -1);
      const nextState = previous[previous.length - 1];
      setHistory((items) => [...items, drawingState]);
      setDrawingState(nextState);
      return nextRedo;
    });
  }, [drawingState]);

  const handleResetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleClearMarks = useCallback(() => {
    pushHistory();
    setDrawingState(EMPTY_DRAWING_STATE);
  }, [pushHistory]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const annotatedReferenceImage = drawingState.colorBlocks.length > 0 || drawingState.regions.length > 0
      ? await buildAnnotatedReferenceImage({
          imageUrl,
          regions: drawingState.regions,
          colorBlocks: drawingState.colorBlocks,
          sourceDimensions,
        }).catch(() => undefined)
      : undefined;

    const supportedSizes = isLocalRedrawModel(effectiveModel) ? getAvailableSizes(effectiveModel) as ImageSize[] : undefined;
    const plan = buildRedrawPlan({
      model: effectiveModel,
      prompt: prompt.trim(),
      sourceImageDimensions: sourceDimensions,
      regions: drawingState.regions,
      colorBlocks: drawingState.colorBlocks,
      supportedSizes,
      annotatedReferenceImage,
    });

    onSubmit({
      model: plan.model,
      aspectRatio: plan.aspectRatio,
      prompt: plan.prompt,
      sourceImageDimensions: sourceDimensions,
      referenceImages,
      regions: drawingState.regions,
      strokes: drawingState.strokes,
      colorBlocks: drawingState.colorBlocks,
      plan,
      selectionRect: plan.cropPlans[0]?.selectionRect || { x: 0, y: 0, width: 1, height: 1 },
      generationRect: plan.cropPlans[0]?.generationRect || { x: 0, y: 0, width: 1, height: 1 },
    });
  }, [canSubmit, drawingState, effectiveModel, imageUrl, onSubmit, prompt, referenceImages, sourceDimensions]);

  const handleBlockPromptConfirm = useCallback(() => {
    if (!editingBlockId) return;
    const nextPrompt = editingBlockPrompt.trim();
    setDrawingState((previous) => ({
      ...previous,
      colorBlocks: assignColorBlockLabels(previous.colorBlocks.map((block) => (
        block.id === editingBlockId ? { ...block, prompt: nextPrompt || undefined } : block
      ))),
    }));
    setEditingBlockId(null);
    setEditingBlockPrompt('');
  }, [editingBlockId, editingBlockPrompt]);

  useEffect(() => {
    const match = customRgb.match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/);
    if (!match) return;
    const rgb = match.slice(1).map((value) => Math.min(255, Math.max(0, Number(value))));
    setSelectedColor(`#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`);
  }, [customRgb]);

  useEffect(() => {
    setReferenceImages(initialReferenceImages);
  }, [initialReferenceImages]);

  const toolButtonClass = (active: boolean) => (
    `inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${active ? 'border-white/70 bg-white text-black' : 'border-white/15 bg-black/45 text-white hover:bg-white/10'}`
  );
  const shellTransform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-[100000] overflow-hidden bg-black text-white"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      <button
        data-redraw-control="true"
        type="button"
        onClick={onCancel}
        className="absolute right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white"
        title="关闭"
      >
        <X size={20} />
      </button>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={shellRef}
          className="relative max-h-full max-w-full"
          style={{ transform: shellTransform, transformOrigin: 'center center' }}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt={image.prompt || 'redraw source'}
            draggable={false}
            className="block max-h-[92vh] max-w-[96vw] select-none object-contain"
            onLoad={(event) => {
              const target = event.currentTarget;
              setSourceDimensions({
                width: target.naturalWidth || image.exactDimensions?.width || 1024,
                height: target.naturalHeight || image.exactDimensions?.height || 1024,
              });
            }}
          />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
            {drawingState.colorBlocks.map((block) => (
              <rect
                key={block.id}
                x={block.rect.x}
                y={block.rect.y}
                width={block.rect.width}
                height={block.rect.height}
                fill={block.color}
                fillOpacity={0.35}
                stroke={block.color}
                strokeWidth={0.004}
              />
            ))}
            {drawingState.regions.filter((region) => !region.stroke && !region.color).map((region) => (
              <rect
                key={region.id}
                x={region.rect.x}
                y={region.rect.y}
                width={region.rect.width}
                height={region.rect.height}
                fill="none"
                stroke="#34d399"
                strokeWidth={0.004}
              />
            ))}
            {drawingState.strokes.map((stroke) => (
              <polyline
                key={stroke.id}
                points={strokeToPolyline(stroke)}
                fill="none"
                stroke={stroke.color || '#34d399'}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={Math.max(0.002, stroke.brushSize / Math.max(sourceDimensions.width, sourceDimensions.height))}
              />
            ))}
            {draftRect && (
              <rect
                x={draftRect.x}
                y={draftRect.y}
                width={draftRect.width}
                height={draftRect.height}
                fill={tool === 'color' ? selectedColor : 'none'}
                fillOpacity={tool === 'color' ? 0.28 : 0}
                stroke={tool === 'color' ? selectedColor : '#38bdf8'}
                strokeWidth={0.004}
              />
            )}
            {draftStroke && (
              <polyline
                points={strokeToPolyline(draftStroke)}
                fill="none"
                stroke={draftStroke.color || '#34d399'}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={Math.max(0.002, draftStroke.brushSize / Math.max(sourceDimensions.width, sourceDimensions.height))}
              />
            )}
          </svg>
          {labeledColorBlocks.map((block) => (
            <button
              key={`${block.id}-label`}
              data-redraw-control="true"
              type="button"
              onClick={() => {
                setEditingBlockId(block.id);
                setEditingBlockPrompt(block.prompt || '');
              }}
              className="absolute rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-lg"
              style={{
                left: `${(block.rect.x + block.rect.width / 2) * 100}%`,
                top: `${(block.rect.y + block.rect.height / 2) * 100}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: block.color,
              }}
            >
              {block.label}
            </button>
          ))}
        </div>
      </div>

      <div
        data-redraw-control="true"
        className="absolute z-20 flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-2 rounded-full border border-white/10 bg-black/60 p-2 shadow-2xl backdrop-blur-xl"
        style={{ left: toolbarPosition.x, top: toolbarPosition.y }}
      >
        <button
          type="button"
          className={toolButtonClass(false)}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            toolbarDragRef.current = {
              pointer: { x: event.clientX, y: event.clientY },
              position: toolbarPosition,
            };
          }}
          title="拖动工具条"
        >
          <SlidersHorizontal size={17} />
        </button>
        <button type="button" className={toolButtonClass(tool === 'pan')} onClick={() => setTool('pan')} title="拖动画面"><Move size={17} /></button>
        <button type="button" className={toolButtonClass(tool === 'box')} onClick={() => setTool('box')} title="框选"><SquareDashedMousePointer size={17} /></button>
        <button type="button" className={toolButtonClass(tool === 'brush')} onClick={() => setTool('brush')} title="画笔"><Brush size={17} /></button>
        <button type="button" className={toolButtonClass(tool === 'color')} onClick={() => setTool('color')} title="色块填充"><Palette size={17} /></button>
        <button type="button" className={toolButtonClass(false)} onClick={handleUndo} title="撤回" disabled={history.length === 0}><Undo2 size={17} /></button>
        <button type="button" className={toolButtonClass(false)} onClick={handleRedo} title="重做" disabled={redoStack.length === 0}><Redo2 size={17} /></button>
        <button type="button" className={toolButtonClass(false)} onClick={handleResetView} title="图片复位"><RotateCcw size={17} /></button>
        <button type="button" className={toolButtonClass(false)} onClick={handleClearMarks} title="清除标记"><Eraser size={17} /></button>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
          <Lasso size={14} />
          <input
            type="range"
            min={4}
            max={96}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            className="w-20"
            title="画笔大小"
          />
        </div>
        <div className="flex items-center gap-1">
          {STANDARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className={`h-6 w-6 rounded-full border ${selectedColor === color ? 'border-white' : 'border-white/20'}`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          <input
            value={customRgb}
            onChange={(event) => setCustomRgb(event.target.value)}
            className="h-8 w-[86px] rounded-full border border-white/10 bg-black/40 px-2 text-xs text-white outline-none"
            placeholder="RGB"
          />
        </div>
        {hasRegions || hasColorBlocks ? (
          <select
            value={localModel}
            onChange={(event) => setLocalModel(event.target.value)}
            className="h-9 rounded-full border border-white/10 bg-black/50 px-3 text-xs text-white outline-none"
            title="重绘模型"
          >
            {localModelOptions.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        ) : null}
      </div>

      {editingBlockId && (
        <div data-redraw-control="true" className="absolute left-1/2 top-24 z-30 flex w-[min(92vw,520px)] -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/75 p-2 backdrop-blur-xl">
          <input
            value={editingBlockPrompt}
            onChange={(event) => setEditingBlockPrompt(event.target.value)}
            className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white outline-none placeholder:text-white/45"
            placeholder="描述这个色块要改成什么"
            autoFocus
          />
          <button type="button" onClick={handleBlockPromptConfirm} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black">
            <Check size={16} />
          </button>
        </div>
      )}

      <div
        data-redraw-control="true"
        className={`absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 p-2 shadow-2xl backdrop-blur-xl ${isMobile ? 'bottom-[calc(env(safe-area-inset-bottom)+14px)] w-[calc(100vw-20px)]' : 'bottom-8 w-[min(720px,calc(100vw-48px))]'}`}
      >
        <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white" title="上传参考图">
          <ImagePlus size={19} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full bg-white/8 px-2">
          {labeledColorBlocks.filter((block) => block.prompt?.trim()).map((block) => (
            <span key={block.id} className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-white" style={{ backgroundColor: block.color }}>
              @{block.label}
            </span>
          ))}
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="h-11 min-w-[120px] flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/45"
            placeholder="输入重绘要求，或用 @红色 指定色块"
          />
        </div>
        <button type="button" disabled={!canSubmit} onClick={() => void handleSubmit()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:opacity-40" title="发送">
          <Send size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleReferenceFiles(event.target.files);
            event.currentTarget.value = '';
          }}
        />
      </div>

      {referenceImages.length > 0 && (
        <div data-redraw-control="true" className={`absolute z-20 flex gap-2 overflow-x-auto ${isMobile ? 'bottom-24 left-4 right-4' : 'bottom-24 left-1/2 w-[min(720px,calc(100vw-48px))] -translate-x-1/2'}`}>
          {referenceImages.map((reference) => (
            <div key={reference.id} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/50">
              <img src={reference.url || reference.data} alt="reference" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setReferenceImages((items) => items.filter((item) => item.id !== reference.id))}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
