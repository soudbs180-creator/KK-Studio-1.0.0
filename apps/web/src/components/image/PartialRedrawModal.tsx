import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';

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
    <div
      className="kk-image-modal-backdrop fixed inset-0 flex items-center justify-center"
      style={{ zIndex: KK_LAYER.fullscreen }}
    >
      <div className="kk-image-modal-panel relative flex h-[min(92vh,860px)] w-[min(94vw,1360px)] overflow-hidden rounded-3xl border">
        <button
          type="button"
          onClick={onCancel}
          className="kk-image-modal-icon-button absolute right-4 top-4 z-20 rounded-full"
          title={UI_TEXT.close}
        >
          <X size={18} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="kk-image-modal-toolbar mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3">
            <div className="min-w-[180px]">
              <div className="kk-image-modal-label mb-1 text-[11px] font-medium uppercase tracking-[0.2em]">{UI_TEXT.model}</div>
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                disabled={!hasSupportedModels}
                className="kk-image-modal-field w-full rounded-xl px-3 py-2 text-sm outline-none"
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.provider ? `${model.label}${UI_TEXT.modelSeparator}${model.provider}` : model.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[120px]">
              <div className="kk-image-modal-label mb-1 text-[11px] font-medium uppercase tracking-[0.2em]">{UI_TEXT.ratio}</div>
              <select
                value={selectedRatio}
                onChange={(event) => setSelectedRatio(event.target.value as AspectRatio)}
                disabled={!hasSupportedModels}
                className="kk-image-modal-field w-full rounded-xl px-3 py-2 text-sm outline-none"
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
              className="kk-image-modal-control mt-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            >
              <RefreshCw size={14} />
              {UI_TEXT.resetSelection}
            </button>

            <button
              type="button"
              onClick={() => setShowGenerationFrame((previousValue) => !previousValue)}
              className="kk-image-modal-control mt-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            >
              {showGenerationFrame ? UI_TEXT.hideGenerationRegion : UI_TEXT.showGenerationRegion}
            </button>
          </div>

          <div className="kk-image-modal-stage relative min-h-0 flex-1 overflow-hidden rounded-3xl border">
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
                    className="kk-image-generation-frame absolute rounded-[20px]"
                    style={renderFrameStyle(generationRect)}
                  />
                )}
                {selectionRect && (
                  <div
                    className="kk-image-selection-frame absolute rounded-[16px]"
                    style={renderFrameStyle(selectionRect)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="kk-image-modal-sidebar flex w-[360px] shrink-0 flex-col gap-4 border-l p-6">
          <div>
            <div className="kk-image-modal-label mb-2 text-xs font-medium uppercase tracking-[0.2em]">{UI_TEXT.prompt}</div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              disabled={!hasSupportedModels}
              placeholder={UI_TEXT.promptPlaceholder}
              className="kk-image-modal-field w-full resize-none rounded-2xl px-3 py-3 text-sm outline-none"
            />
          </div>

          {!hasSupportedModels && (
            <div className="kk-image-warning-panel rounded-2xl border p-4 text-sm">
              {UI_TEXT.noSupportedModels}
            </div>
          )}

          <div>
            <div className="kk-image-modal-label mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em]">
              <span>{UI_TEXT.references}</span>
              <span>{referenceImages.length}/{availableReferenceSlots}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((referenceImage) => (
                <div key={referenceImage.id} className="kk-image-reference-tile relative h-16 w-16 overflow-hidden rounded-xl border">
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
                    className="kk-image-modal-icon-button absolute right-1 top-1 rounded-full"
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
                  className="kk-image-reference-upload inline-flex h-16 w-16 items-center justify-center rounded-xl transition-colors"
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

          <div className="kk-image-info-panel rounded-2xl border p-4 text-sm">
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
              className="kk-image-modal-control flex-1 rounded-2xl px-4 py-3 text-sm"
            >
              {UI_TEXT.cancel}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="kk-image-modal-primary flex-1 rounded-2xl px-4 py-3 text-sm font-medium"
            >
              {UI_TEXT.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
