import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers3,
  Type,
  X,
} from 'lucide-react';
import type { GeneratedImage, PptEditableLayer, PptEditablePage, PromptNode } from '../../types';
import {
  buildPptEditablePages,
  clonePptEditablePages,
  getPptTextLayer,
  patchPptTextLayer,
  sortPptLayers,
  syncPptSlidesFromEditablePages,
} from '../../utils/pptEditable';
import { useLocale } from '../../context/LocaleContext';

interface PptDeckEditorModalProps {
  promptNode: PromptNode;
  images: GeneratedImage[];
  initialIndex?: number;
  onClose: () => void;
  onSave: (pages: PptEditablePage[]) => void;
}

const layerIcon = (layer: PptEditableLayer) => {
  if (layer.type === 'image') return <ImageIcon size={14} />;
  return <Type size={14} />;
};

const hexToRgba = (value?: string, opacity = 1) => {
  if (!value) return undefined;

  const raw = value.trim().replace(/^#/, '');
  const normalized = raw.length === 3
    ? raw.split('').map((part) => `${part}${part}`).join('')
    : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return value;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, opacity));

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const PptDeckEditorModal: React.FC<PptDeckEditorModalProps> = ({
  promptNode,
  images,
  initialIndex = 0,
  onClose,
  onSave,
}) => {
  const { pick } = useLocale();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [pages, setPages] = useState<PptEditablePage[]>(() => (
    clonePptEditablePages(buildPptEditablePages(promptNode, images))
  ));

  useEffect(() => {
    setPages(clonePptEditablePages(buildPptEditablePages(promptNode, images)));
  }, [images, promptNode]);

  useEffect(() => {
    setActiveIndex(Math.max(0, Math.min(initialIndex, Math.max(0, pages.length - 1))));
  }, [initialIndex, pages.length]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const activePage = pages[activeIndex];
  const slideCount = pages.length;
  const outlinePreview = useMemo(() => syncPptSlidesFromEditablePages(pages), [pages]);

  const updatePage = (pageIndex: number, updater: (page: PptEditablePage) => PptEditablePage) => {
    setPages((prev) => prev.map((page, index) => {
      if (index !== pageIndex) return page;
      return updater(page);
    }));
  };

  const updateLayerVisibility = (pageIndex: number, layerId: string, visible: boolean) => {
    updatePage(pageIndex, (page) => ({
      ...page,
      layers: page.layers.map((layer) => (
        layer.id === layerId ? { ...layer, visible } : layer
      )),
    }));
  };

  const moveLayer = (pageIndex: number, layerId: string, direction: -1 | 1) => {
    updatePage(pageIndex, (page) => {
      const sorted = sortPptLayers(page.layers);
      const currentIndex = sorted.findIndex((layer) => layer.id === layerId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sorted.length) return page;

      const next = [...sorted];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);

      return {
        ...page,
        layers: next.map((layer, index) => ({ ...layer, zIndex: index * 10 })),
      };
    });
  };

  const resolveLayerImageSource = (imageNodeId?: string, fallbackUrl?: string) => {
    if (imageNodeId) {
      const matched = images.find((image) => image.id === imageNodeId);
      if (matched) {
        return matched.originalUrl || matched.url;
      }
    }

    return fallbackUrl;
  };

  const renderLayeredPreview = (page: PptEditablePage, compact = false) => (
    <>
      {sortPptLayers(page.layers).map((layer) => {
        if (!layer.visible) return null;

        if (layer.type === 'image') {
          const imageSource = resolveLayerImageSource(layer.imageNodeId, layer.sourceUrl);
          if (!imageSource) return null;

          return (
            <img
              key={layer.id}
              src={imageSource}
              alt={layer.name}
              className="absolute object-cover"
              style={{
                left: `${(layer.x / 1920) * 100}%`,
                top: `${(layer.y / 1080) * 100}%`,
                width: `${(layer.width / 1920) * 100}%`,
                height: `${(layer.height / 1080) * 100}%`,
                opacity: layer.opacity ?? 1,
              }}
            />
          );
        }

        if (!layer.text.trim()) return null;

        const style: React.CSSProperties = {
          left: `${(layer.x / 1920) * 100}%`,
          top: `${(layer.y / 1080) * 100}%`,
          width: `${(layer.width / 1920) * 100}%`,
          color: layer.color || '#ffffff',
          fontSize: compact
            ? `${Math.max(8, Math.round(layer.fontSize / 4))}px`
            : `${Math.max(14, Math.round((layer.fontSize / 1080) * 720)) / 10}vw`,
          fontWeight: layer.fontWeight || 500,
          textAlign: layer.align || 'left',
          backgroundColor: hexToRgba(layer.backgroundColor, layer.backgroundOpacity ?? 1),
          opacity: layer.opacity ?? 1,
          lineHeight: compact ? 1.2 : 1.35,
          minHeight: compact ? undefined : `${(layer.height / 1080) * 100}%`,
          height: compact ? `${(layer.height / 1080) * 100}%` : undefined,
        };

        return (
          <div
            key={layer.id}
            className={`absolute overflow-hidden ${compact ? 'rounded-lg px-2 py-1' : 'rounded-2xl px-4 py-3 backdrop-blur-[1px]'}`}
            style={style}
          >
            {layer.text.split(/\r?\n/).map((line, lineIndex) => (
              <div key={`${layer.id}-${lineIndex}`} className={lineIndex > 0 ? 'mt-1' : ''}>
                {line || <span>&nbsp;</span>}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );

  const titleLayer = activePage ? getPptTextLayer(activePage, 'title') : undefined;
  const subtitleLayer = activePage ? getPptTextLayer(activePage, 'subtitle') : undefined;
  const bodyLayer = activePage ? getPptTextLayer(activePage, 'body') : undefined;

  const handleSave = () => {
    onSave(pages.map((page, index) => ({
      ...page,
      pageIndex: index,
      outline: outlinePreview[index] || page.outline,
    })));
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[100001] bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={isMobile ? {
        paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: '8px',
        paddingRight: '8px',
      } : undefined}
    >
      <div
        className={`overflow-hidden border border-white/10 bg-[#0f172a] text-white shadow-2xl ${isMobile ? 'h-full rounded-[24px]' : 'absolute inset-[4%] rounded-3xl'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b border-white/10 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-500/15 p-2 text-sky-300">
              <Layers3 size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold">{pick('可编辑 PPT 页面包', 'Editable PPT Deck')}</div>
              <div className="text-xs text-white/60">
                {pick('导出分层 PPTX 之前，可以先在这里调整文字图层。', 'Edit text layers before exporting a layered PPTX package.')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400"
            >
              {pick('保存页面包', 'Save deck')}
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              title={pick('关闭', 'Close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={`grid min-h-0 ${isMobile ? 'h-[calc(100%-65px)] grid-cols-1' : 'h-[calc(100%-73px)] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)]'}`}>
          <aside className="overflow-y-auto border-b border-white/10 bg-white/[0.03] p-4 xl:border-b-0 xl:border-r">
            <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/45">
              {pick('页面列表', 'Slides')}
            </div>
            <div className="space-y-3">
              {pages.map((page, index) => {
                const image = images[index];
                const isActive = index === activeIndex;
                const title = getPptTextLayer(page, 'title')?.text.trim() || pick(`第 ${index + 1} 页`, `Slide ${index + 1}`);
                const subtitle = getPptTextLayer(page, 'subtitle')?.text.trim() || outlinePreview[index] || '';

                return (
                  <button
                    key={page.id}
                    onClick={() => setActiveIndex(index)}
                    className={`w-full rounded-2xl border p-2 text-left transition-all ${
                      isActive
                        ? 'border-sky-400/70 bg-sky-500/10 shadow-lg shadow-sky-500/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                      <div className="relative aspect-video w-full bg-slate-900">
                        {image ? renderLayeredPreview(page, true) : null}
                      </div>
                      <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium">
                        {index + 1}/{slideCount}
                      </div>
                    </div>
                    <div className="mt-2 text-sm font-medium">{title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-white/55">{subtitle || pick('暂未填写副标题', 'No subtitle yet')}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className={`grid h-full grid-cols-1 ${isMobile ? '' : '2xl:grid-cols-[minmax(0,1.15fr)_360px]'}`}>
            <div className="overflow-y-auto p-6">
              {activePage ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-white/45">{pick('预览', 'Preview')}</div>
                      <div className="mt-1 text-lg font-semibold">
                        {titleLayer?.text.trim() || activePage.name || pick(`第 ${activeIndex + 1} 页`, `Slide ${activeIndex + 1}`)}
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                      {pick('1920 x 1080 分层画面', '1920 x 1080 layered scene')}
                    </div>
                  </div>

                  <div className="mx-auto max-w-[920px] rounded-[28px] border border-white/10 bg-[#020617] p-4 shadow-2xl">
                    <div className="relative aspect-video overflow-hidden rounded-[22px] border border-white/10 bg-slate-950">
                      {renderLayeredPreview(activePage)}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="overflow-y-auto border-t border-white/10 bg-white/[0.03] p-5 2xl:border-l 2xl:border-t-0">
              {activePage ? (
                <>
                  <div className="mb-5">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">{pick('文字图层', 'Text layers')}</div>
                    <div className="mt-3 space-y-4">
                      <label className="block">
                        <div className="mb-1 text-xs text-white/60">{pick('标题', 'Title')}</div>
                        <textarea
                          value={titleLayer?.text || ''}
                          onChange={(event) => updatePage(activeIndex, (page) => patchPptTextLayer(page, 'title', event.target.value))}
                          className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-sky-400/60"
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-xs text-white/60">{pick('副标题', 'Subtitle')}</div>
                        <textarea
                          value={subtitleLayer?.text || ''}
                          onChange={(event) => updatePage(activeIndex, (page) => patchPptTextLayer(page, 'subtitle', event.target.value))}
                          className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-sky-400/60"
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-xs text-white/60">{pick('正文', 'Body')}</div>
                        <textarea
                          value={bodyLayer?.text || ''}
                          onChange={(event) => updatePage(activeIndex, (page) => patchPptTextLayer(page, 'body', event.target.value))}
                          className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-sky-400/60"
                          placeholder={pick('可选正文，支持段落或项目符号式内容。', 'Optional body copy or bullet-style text.')}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">{pick('图层顺序', 'Layer order')}</div>
                    <div className="text-[11px] text-white/45">{pick('越靠上的图层，在 PPTX 中越晚导出。', 'Top layers export later in PPTX.')}</div>
                  </div>

                  <div className="space-y-2">
                    {sortPptLayers(activePage.layers).map((layer, index, sorted) => (
                      <div
                        key={layer.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/65 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-white/10 p-1.5 text-white/70">
                            {layerIcon(layer)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{layer.name}</div>
                            <div className="text-[11px] text-white/45">
                              {layer.type} / {layer.role} / z {layer.zIndex}
                            </div>
                          </div>
                          <button
                            onClick={() => updateLayerVisibility(activeIndex, layer.id, !layer.visible)}
                            className="rounded-full bg-white/8 p-2 text-white/70 transition-colors hover:bg-white/14"
                            title={layer.visible ? pick('隐藏图层', 'Hide layer') : pick('显示图层', 'Show layer')}
                          >
                            {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            onClick={() => moveLayer(activeIndex, layer.id, -1)}
                            disabled={index === 0}
                            className="rounded-full bg-white/8 p-2 text-white/70 transition-colors hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-30"
                            title={pick('下移一层', 'Move down')}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            onClick={() => moveLayer(activeIndex, layer.id, 1)}
                            disabled={index === sorted.length - 1}
                            className="rounded-full bg-white/8 p-2 text-white/70 transition-colors hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-30"
                            title={pick('上移一层', 'Move up')}
                          >
                            <ChevronUp size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PptDeckEditorModal;
