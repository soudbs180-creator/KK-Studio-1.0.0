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
import { KK_LAYER } from '@kk/ui';
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
import { isPhoneResponsiveWidth } from '../../utils/responsiveSurface';

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

const hexToRgbAlpha = (value?: string, opacity = 1) => {
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

  return `rgb(${red} ${green} ${blue} / ${alpha})`; // UI_TOKEN_EXCEPTION
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
    typeof window !== 'undefined' ? isPhoneResponsiveWidth(window.innerWidth) : false
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
    const onResize = () => setIsMobile(isPhoneResponsiveWidth(window.innerWidth));
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
          color: layer.color || 'var(--kk-ppt-layer-default-text)',
          fontSize: compact
            ? `${Math.max(8, Math.round(layer.fontSize / 4))}px`
            : `${Math.max(14, Math.round((layer.fontSize / 1080) * 720)) / 10}vw`,
          fontWeight: layer.fontWeight || 500,
          textAlign: layer.align || 'left',
          backgroundColor: hexToRgbAlpha(layer.backgroundColor, layer.backgroundOpacity ?? 1),
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
      className="kk-image-modal-backdrop kk-ppt-deck-editor fixed inset-0"
      onClick={onClose}
      style={{
        zIndex: KK_LAYER.fullscreen,
        ...(isMobile ? {
          paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
          paddingLeft: '8px',
          paddingRight: '8px',
        } : {}),
      }}
    >
      <div
        className={`kk-image-modal-panel overflow-hidden border ${isMobile ? 'h-full rounded-[24px]' : 'absolute inset-[4%] rounded-3xl'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`kk-ppt-deck-header flex items-center justify-between border-b ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
          <div className="flex items-center gap-3">
            <div className="kk-ppt-layer-icon rounded-2xl p-2">
              <Layers3 size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold">{pick('可编辑 PPT 页面包', 'Editable PPT Deck')}</div>
              <div className="kk-ppt-muted text-xs">
                {pick('导出分层 PPTX 之前，可以先在这里调整文字图层。', 'Edit text layers before exporting a layered PPTX package.')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="kk-image-modal-primary rounded-full px-4 py-2 text-sm font-medium"
            >
              {pick('保存页面包', 'Save deck')}
            </button>
            <button
              onClick={onClose}
              className="kk-image-modal-icon-button inline-flex items-center justify-center rounded-full"
              title={pick('关闭', 'Close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={`grid min-h-0 ${isMobile ? 'h-[calc(100%-65px)] grid-cols-1' : 'h-[calc(100%-73px)] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)]'}`}>
          <aside className="kk-ppt-editor-panel overflow-y-auto border-b p-4 xl:border-b-0 xl:border-r">
            <div className="kk-image-modal-label mb-3 text-xs uppercase tracking-[0.16em]">
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
                    className="kk-ppt-slide-nav w-full rounded-2xl p-2 text-left"
                    data-active={isActive}
                  >
                    <div className="kk-ppt-preview-frame relative overflow-hidden rounded-xl">
                      <div className="relative aspect-video w-full">
                        {image ? renderLayeredPreview(page, true) : null}
                      </div>
                      <div className="kk-ppt-page-badge absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-medium">
                        {index + 1}/{slideCount}
                      </div>
                    </div>
                    <div className="mt-2 text-sm font-medium">{title}</div>
                    <div className="kk-ppt-muted mt-1 line-clamp-2 text-xs">{subtitle || pick('暂未填写副标题', 'No subtitle yet')}</div>
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
                      <div className="kk-image-modal-label text-xs uppercase tracking-[0.16em]">{pick('预览', 'Preview')}</div>
                      <div className="mt-1 text-lg font-semibold">
                        {titleLayer?.text.trim() || activePage.name || pick(`第 ${activeIndex + 1} 页`, `Slide ${activeIndex + 1}`)}
                      </div>
                    </div>
                    <div className="kk-image-info-panel rounded-full border px-3 py-1 text-xs">
                      {pick('1920 x 1080 分层画面', '1920 x 1080 layered scene')}
                    </div>
                  </div>

                  <div className="kk-ppt-preview-frame mx-auto max-w-[920px] rounded-[28px] p-4">
                    <div className="kk-ppt-stack-page relative aspect-video overflow-hidden rounded-[22px] border">
                      {renderLayeredPreview(activePage)}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="kk-ppt-editor-panel overflow-y-auto border-t p-5 2xl:border-l 2xl:border-t-0">
              {activePage ? (
                <>
                  <div className="mb-5">
                    <div className="kk-image-modal-label text-xs uppercase tracking-[0.16em]">{pick('文字图层', 'Text layers')}</div>
                    <div className="mt-3 space-y-4">
                      <label className="block">
                        <div className="kk-ppt-muted mb-1 text-xs">{pick('标题', 'Title')}</div>
                        <textarea
                          value={titleLayer?.text || ''}
                          onChange={(event) => updatePage(activeIndex, (page) => patchPptTextLayer(page, 'title', event.target.value))}
                          className="kk-image-modal-field min-h-[88px] w-full rounded-2xl px-3 py-2 text-sm outline-none transition-colors"
                        />
                      </label>

                      <label className="block">
                        <div className="kk-ppt-muted mb-1 text-xs">{pick('副标题', 'Subtitle')}</div>
                        <textarea
                          value={subtitleLayer?.text || ''}
                          onChange={(event) => updatePage(activeIndex, (page) => patchPptTextLayer(page, 'subtitle', event.target.value))}
                          className="kk-image-modal-field min-h-[88px] w-full rounded-2xl px-3 py-2 text-sm outline-none transition-colors"
                        />
                      </label>

                      <label className="block">
                        <div className="kk-ppt-muted mb-1 text-xs">{pick('正文', 'Body')}</div>
                        <textarea
                          value={bodyLayer?.text || ''}
                          onChange={(event) => updatePage(activeIndex, (page) => patchPptTextLayer(page, 'body', event.target.value))}
                          className="kk-image-modal-field min-h-[140px] w-full rounded-2xl px-3 py-2 text-sm outline-none transition-colors"
                          placeholder={pick('可选正文，支持段落或项目符号式内容。', 'Optional body copy or bullet-style text.')}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    <div className="kk-image-modal-label text-xs uppercase tracking-[0.16em]">{pick('图层顺序', 'Layer order')}</div>
                    <div className="kk-ppt-muted text-[11px]">{pick('越靠上的图层，在 PPTX 中越晚导出。', 'Top layers export later in PPTX.')}</div>
                  </div>

                  <div className="space-y-2">
                    {sortPptLayers(activePage.layers).map((layer, index, sorted) => (
                      <div
                        key={layer.id}
                        className="kk-ppt-layer-card rounded-2xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="kk-ppt-layer-icon rounded-lg p-1.5">
                            {layerIcon(layer)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{layer.name}</div>
                            <div className="kk-ppt-muted text-[11px]">
                              {layer.type} / {layer.role} / z {layer.zIndex}
                            </div>
                          </div>
                          <button
                            onClick={() => updateLayerVisibility(activeIndex, layer.id, !layer.visible)}
                            className="kk-image-modal-icon-button rounded-full disabled:cursor-not-allowed disabled:opacity-30"
                            title={layer.visible ? pick('隐藏图层', 'Hide layer') : pick('显示图层', 'Show layer')}
                          >
                            {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            onClick={() => moveLayer(activeIndex, layer.id, -1)}
                            disabled={index === 0}
                            className="kk-image-modal-icon-button rounded-full disabled:cursor-not-allowed disabled:opacity-30"
                            title={pick('下移一层', 'Move down')}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            onClick={() => moveLayer(activeIndex, layer.id, 1)}
                            disabled={index === sorted.length - 1}
                            className="kk-image-modal-icon-button rounded-full disabled:cursor-not-allowed disabled:opacity-30"
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
