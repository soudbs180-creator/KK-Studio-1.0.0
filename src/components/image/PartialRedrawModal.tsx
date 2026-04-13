import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';

import type {
  AspectRatio,
  GeneratedImage,
  NormalizedRect,
  PartialRedrawRequest,
  ReferenceImage,
} from '../../types';
import { keyManager } from '../../services/auth/keyManager';
import {
  expandSelectionToAspectRatio,
  type PixelSize,
} from '../../services/image/partialRedraw';
import {
  getMaxRefImages,
  getPartialRedrawSupportedRatios,
  modelSupportsPartialRedraw,
} from '../../services/model/modelCapabilities';

interface PartialRedrawModalProps {
  image: GeneratedImage;
  imageUrl: string;
  onCancel: () => void;
  onSubmit: (request: PartialRedrawRequest) => void;
}

type DisplayModel = {
  id: string;
  label: string;
  provider?: string;
};

type PointerPoint = {
  x: number;
  y: number;
};

const UI_TEXT = {
  close: '\u5173\u95ed',
  model: '\u6a21\u578b',
  ratio: '\u6bd4\u4f8b',
  resetSelection: '\u91cd\u7f6e\u6846\u9009',
  hideGenerationRegion: '\u9690\u85cf\u9001\u6a21\u533a\u57df',
  showGenerationRegion: '\u663e\u793a\u9001\u6a21\u533a\u57df',
  prompt: '\u63d0\u793a\u8bcd',
  promptPlaceholder: '\u63cf\u8ff0\u4f60\u60f3\u8ba9\u6240\u9009\u533a\u57df\u53d8\u6210\u4ec0\u4e48\u6837\u5b50',
  references: '\u53c2\u8003\u56fe',
  noSupportedModels: '\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u7684\u56fe\u751f\u56fe\u6a21\u578b\uff0c\u8bf7\u5148\u5728\u6a21\u578b\u5e93\u6216 API \u8bbe\u7f6e\u4e2d\u914d\u7f6e\u53ef\u7528\u6a21\u578b\u3002',
  removeReference: '\u79fb\u9664\u53c2\u8003\u56fe',
  uploadReference: '\u4e0a\u4f20\u53c2\u8003\u56fe',
  sourceSize: '\u539f\u56fe\u5c3a\u5bf8',
  selectionRegion: '\u4fee\u6539\u533a\u57df',
  generationRegion: '\u9001\u6a21\u533a\u57df',
  noSelection: '\u672a\u6846\u9009',
  waitingSelection: '\u7b49\u5f85\u6846\u9009',
  cancel: '\u53d6\u6d88',
  submit: '\u5f00\u59cb\u91cd\u7ed8',
  sourceAlt: 'partial redraw source',
  referenceAlt: 'reference',
  modelSeparator: ' · ',
} as const;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isMeaningfulSelection(rect: NormalizedRect | null): rect is NormalizedRect {
  return Boolean(rect && rect.width > 0.01 && rect.height > 0.01);
}

async function fileToReferenceImage(file: File): Promise<ReferenceImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`REFERENCE_FILE_READ_FAILED:${file.name}`));
    reader.readAsDataURL(file);
  });
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  return {
    id: `partial-redraw-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    data: match?.[2] || dataUrl,
    mimeType: match?.[1] || file.type || 'image/png',
    url: dataUrl,
  };
}

export const PartialRedrawModal: React.FC<PartialRedrawModalProps> = ({
  image,
  imageUrl,
  onCancel,
  onSubmit,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<PointerPoint | null>(null);
  const [imageFrame, setImageFrame] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const availableModels = useMemo<DisplayModel[]>(() => {
    const globalModels = keyManager.getGlobalModelList()
      .filter((model) => model.type === 'image')
      .filter((model) => modelSupportsPartialRedraw(model.id))
      .map((model) => ({
        id: model.id,
        label: model.name || model.id,
        provider: model.providerLabel || model.provider,
      }));

    const uniqueById = new Map<string, DisplayModel>();
    globalModels.forEach((model) => uniqueById.set(model.id, model));

    if (modelSupportsPartialRedraw(image.model) && !uniqueById.has(image.model)) {
      uniqueById.set(image.model, {
        id: image.model,
        label: image.modelLabel || image.model,
        provider: image.providerLabel || image.provider,
      });
    }

    return Array.from(uniqueById.values());
  }, [image.model, image.modelLabel, image.provider, image.providerLabel]);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (modelSupportsPartialRedraw(image.model)) {
      return image.model;
    }
    return availableModels[0]?.id || image.model;
  });
  const [selectionRect, setSelectionRect] = useState<NormalizedRect | null>(null);
  const [prompt, setPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [sourceDimensions, setSourceDimensions] = useState<PixelSize>(() => (
    image.exactDimensions || { width: 1024, height: 1024 }
  ));
  const [showGenerationFrame, setShowGenerationFrame] = useState(true);
  const hasSupportedModels = availableModels.length > 0;

  const availableRatios = useMemo(
    () => getPartialRedrawSupportedRatios(selectedModel),
    [selectedModel],
  );
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(
    () => (availableRatios[0] || image.aspectRatio || '1:1') as AspectRatio,
  );

  useEffect(() => {
    if (!availableModels.some((model) => model.id === selectedModel)) {
      setSelectedModel(availableModels[0]?.id || image.model);
    }
  }, [availableModels, image.model, selectedModel]);

  useEffect(() => {
    if (!availableRatios.includes(selectedRatio)) {
      setSelectedRatio((availableRatios[0] || image.aspectRatio || '1:1') as AspectRatio);
    }
  }, [availableRatios, image.aspectRatio, selectedRatio]);

  const generationRect = useMemo(() => (
    isMeaningfulSelection(selectionRect)
      ? expandSelectionToAspectRatio(selectionRect, sourceDimensions, selectedRatio)
      : null
  ), [selectionRect, selectedRatio, sourceDimensions]);

  const availableReferenceSlots = useMemo(
    () => Math.max(0, getMaxRefImages(selectedModel) - 1),
    [selectedModel],
  );

  useEffect(() => {
    setReferenceImages((previousValue) => previousValue.slice(0, availableReferenceSlots));
  }, [availableReferenceSlots]);

  const syncImageFrame = useCallback(() => {
    if (!imageRef.current || !stageRef.current) return;
    const imageRect = imageRef.current.getBoundingClientRect();
    const stageRect = stageRef.current.getBoundingClientRect();
    setImageFrame({
      left: imageRect.left - stageRect.left,
      top: imageRect.top - stageRect.top,
      width: imageRect.width,
      height: imageRect.height,
    });
  }, []);

  useEffect(() => {
    syncImageFrame();
    window.addEventListener('resize', syncImageFrame);
    return () => window.removeEventListener('resize', syncImageFrame);
  }, [syncImageFrame]);

  const resolveImageRect = useCallback(() => imageRef.current?.getBoundingClientRect() || null, []);

  const resolveNormalizedPoint = useCallback((clientX: number, clientY: number): PointerPoint | null => {
    const imageRect = resolveImageRect();
    if (!imageRect) return null;

    const normalizedX = clampUnit((clientX - imageRect.left) / imageRect.width);
    const normalizedY = clampUnit((clientY - imageRect.top) / imageRect.height);

    if (
      clientX < imageRect.left
      || clientX > imageRect.right
      || clientY < imageRect.top
      || clientY > imageRect.bottom
    ) {
      return null;
    }

    return { x: normalizedX, y: normalizedY };
  }, [resolveImageRect]);

  const buildSelectionRect = useCallback((start: PointerPoint, end: PointerPoint): NormalizedRect => ({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }), []);

  const handleSelectionStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const startPoint = resolveNormalizedPoint(event.clientX, event.clientY);
    if (!startPoint) return;
    dragStartRef.current = startPoint;
    setSelectionRect({ x: startPoint.x, y: startPoint.y, width: 0, height: 0 });
  }, [resolveNormalizedPoint]);

  const handleSelectionMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const currentPoint = resolveNormalizedPoint(event.clientX, event.clientY);
    if (!currentPoint) return;
    setSelectionRect(buildSelectionRect(dragStartRef.current, currentPoint));
  }, [buildSelectionRect, resolveNormalizedPoint]);

  const handleSelectionEnd = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const currentPoint = resolveNormalizedPoint(event.clientX, event.clientY);
    if (currentPoint) {
      setSelectionRect(buildSelectionRect(dragStartRef.current, currentPoint));
    }
    dragStartRef.current = null;
  }, [buildSelectionRect, resolveNormalizedPoint]);

  const handleReferenceFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || availableReferenceSlots <= 0) return;
    const nextFiles = Array.from(fileList).slice(0, availableReferenceSlots - referenceImages.length);
    if (nextFiles.length === 0) return;

    const nextImages = await Promise.all(nextFiles.map((file) => fileToReferenceImage(file)));
    setReferenceImages((previousValue) => [...previousValue, ...nextImages].slice(0, availableReferenceSlots));
  }, [availableReferenceSlots, referenceImages.length]);

  const handleSubmit = useCallback(() => {
    if (!isMeaningfulSelection(selectionRect) || !generationRect) return;
    if (!prompt.trim() && referenceImages.length === 0) return;

    onSubmit({
      model: selectedModel,
      aspectRatio: selectedRatio,
      prompt: prompt.trim(),
      selectionRect,
      generationRect,
      sourceImageDimensions: sourceDimensions,
      referenceImages,
    });
  }, [generationRect, onSubmit, prompt, referenceImages, selectedModel, selectedRatio, selectionRect, sourceDimensions]);

  const canSubmit = hasSupportedModels
    && isMeaningfulSelection(selectionRect)
    && Boolean(generationRect)
    && (prompt.trim().length > 0 || referenceImages.length > 0);

  const renderFrameStyle = (rect: NormalizedRect | null) => {
    if (!rect || imageFrame.width <= 0 || imageFrame.height <= 0) {
      return { display: 'none' };
    }

    return {
      left: `${rect.x * imageFrame.width}px`,
      top: `${rect.y * imageFrame.height}px`,
      width: `${rect.width * imageFrame.width}px`,
      height: `${rect.height * imageFrame.height}px`,
    };
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative flex h-[min(92vh,860px)] w-[min(94vw,1360px)] overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-secondary)] shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-black/45 p-2 text-white/80 transition-colors hover:text-white"
          title={UI_TEXT.close}
        >
          <X size={18} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col bg-black/35 p-5">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="min-w-[180px]">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">{UI_TEXT.model}</div>
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                disabled={!hasSupportedModels}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.provider ? `${model.label}${UI_TEXT.modelSeparator}${model.provider}` : model.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[120px]">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">{UI_TEXT.ratio}</div>
              <select
                value={selectedRatio}
                onChange={(event) => setSelectedRatio(event.target.value as AspectRatio)}
                disabled={!hasSupportedModels}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
              >
                {availableRatios.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectionRect(null);
                dragStartRef.current = null;
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:text-white"
            >
              <RefreshCw size={14} />
              {UI_TEXT.resetSelection}
            </button>

            <button
              type="button"
              onClick={() => setShowGenerationFrame((previousValue) => !previousValue)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:text-white"
            >
              {showGenerationFrame ? UI_TEXT.hideGenerationRegion : UI_TEXT.showGenerationRegion}
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
            <div
              ref={stageRef}
              className="relative flex h-full w-full items-center justify-center p-5"
              onMouseDown={handleSelectionStart}
              onMouseMove={handleSelectionMove}
              onMouseUp={handleSelectionEnd}
              onMouseLeave={handleSelectionEnd}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt={image.prompt || UI_TEXT.sourceAlt}
                className="max-h-full max-w-full select-none rounded-2xl object-contain"
                draggable={false}
                onLoad={(event) => {
                  const target = event.currentTarget;
                  setSourceDimensions({
                    width: target.naturalWidth || image.exactDimensions?.width || 1024,
                    height: target.naturalHeight || image.exactDimensions?.height || 1024,
                  });
                  requestAnimationFrame(() => syncImageFrame());
                }}
              />

              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${imageFrame.left}px`,
                  top: `${imageFrame.top}px`,
                  width: `${imageFrame.width}px`,
                  height: `${imageFrame.height}px`,
                }}
              >
                {showGenerationFrame && generationRect && (
                  <div
                    className="absolute rounded-[20px] border border-dashed border-sky-300/90 bg-sky-400/10"
                    style={renderFrameStyle(generationRect)}
                  />
                )}
                {selectionRect && (
                  <div
                    className="absolute rounded-[16px] border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                    style={renderFrameStyle(selectionRect)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-[360px] shrink-0 flex-col gap-4 border-l border-white/10 bg-[var(--bg-tertiary)] p-6">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/45">{UI_TEXT.prompt}</div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              disabled={!hasSupportedModels}
              placeholder={UI_TEXT.promptPlaceholder}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
            />
          </div>

          {!hasSupportedModels && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              {UI_TEXT.noSupportedModels}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em] text-white/45">
              <span>{UI_TEXT.references}</span>
              <span>{referenceImages.length}/{availableReferenceSlots}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((referenceImage) => (
                <div key={referenceImage.id} className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={referenceImage.url || referenceImage.data}
                    alt={UI_TEXT.referenceAlt}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setReferenceImages((previousValue) => previousValue.filter((item) => item.id !== referenceImage.id));
                    }}
                    className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white/80"
                    title={UI_TEXT.removeReference}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {referenceImages.length < availableReferenceSlots && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-white/15 text-white/70 transition-colors hover:text-white"
                  title={UI_TEXT.uploadReference}
                >
                  <ImagePlus size={18} />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void handleReferenceFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            <div>{UI_TEXT.sourceSize}: {sourceDimensions.width} x {sourceDimensions.height}</div>
            <div className="mt-2">
              {UI_TEXT.selectionRegion}: {selectionRect
                ? `${Math.round(selectionRect.width * 100)}% x ${Math.round(selectionRect.height * 100)}%`
                : UI_TEXT.noSelection}
            </div>
            <div className="mt-2">
              {UI_TEXT.generationRegion}: {generationRect
                ? `${Math.round(generationRect.width * 100)}% x ${Math.round(generationRect.height * 100)}%`
                : UI_TEXT.waitingSelection}
            </div>
          </div>

          <div className="mt-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
            >
              {UI_TEXT.cancel}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-900/40 disabled:text-white/40"
            >
              {UI_TEXT.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
