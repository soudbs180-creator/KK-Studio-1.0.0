import React, { useMemo, useState } from 'react';

import { Download, Eye, Loader2, Sparkles, Trash2, Wand2, X } from 'lucide-react';

import type { GeneratedImage, PartialRedrawRequest, PromptNode, ReferenceImage } from '../../types';
import { PartialRedrawModal } from '../image/PartialRedrawModal';
import { resolveModelDisplayName } from '../../utils/modelDisplayName';
import { selectMobileFeedResults, type MobileFeedResult } from './mobileFeedSelectors';

interface MobileResultFeedProps {
  promptNodes: PromptNode[];
  imageNodes: GeneratedImage[];
  highlightedId?: string | null;
  activeSourceImage?: string | null;
  onImagePreview: (id: string) => void;
  onImageDelete: (id: string) => void;
  onImageSelect: (id: string) => void;
  onUseAsSource: (id: string) => void;
  onPartialRedraw: (image: GeneratedImage, request: PartialRedrawRequest) => void;
}

const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) {
    return '刚刚更新';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

const truncateText = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 3))}...` : value;

const triggerDownload = (item: MobileFeedResult) => {
  if (!item.primaryImageSource) {
    return;
  }

  const link = document.createElement('a');
  link.href = item.primaryImageSource;
  link.download = `${item.imageId}.png`;
  link.rel = 'noopener';
  link.click();
};

const resolveReferenceImageSource = (referenceImage: ReferenceImage): string | null => {
  if (referenceImage.url) {
    return referenceImage.url;
  }

  if (!referenceImage.data) {
    return null;
  }

  if (
    referenceImage.data.startsWith('data:') ||
    referenceImage.data.startsWith('blob:') ||
    referenceImage.data.startsWith('http://') ||
    referenceImage.data.startsWith('https://')
  ) {
    return referenceImage.data;
  }

  return `data:${referenceImage.mimeType || 'image/png'};base64,${referenceImage.data}`;
};

const MobileResultFeed: React.FC<MobileResultFeedProps> = ({
  promptNodes,
  imageNodes,
  highlightedId,
  activeSourceImage,
  onImagePreview,
  onImageDelete,
  onImageSelect,
  onUseAsSource,
  onPartialRedraw,
}) => {
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [showPartialRedraw, setShowPartialRedraw] = useState(false);

  const promptNodeById = useMemo(
    () => new Map(promptNodes.map((promptNode) => [promptNode.id, promptNode] as const)),
    [promptNodes],
  );
  const imageNodeById = useMemo(
    () => new Map(imageNodes.map((imageNode) => [imageNode.id, imageNode] as const)),
    [imageNodes],
  );
  const feedResults = useMemo(
    () => selectMobileFeedResults(promptNodes, imageNodes),
    [promptNodes, imageNodes],
  );

  const activeDetailResult = detailEntryId ? feedResults.find((item) => item.id === detailEntryId) || null : null;
  const activeDetailImage = activeDetailResult ? imageNodeById.get(activeDetailResult.imageId) || null : null;
  const activeDetailPrompt = activeDetailResult?.detailEntry.promptId
    ? promptNodeById.get(activeDetailResult.detailEntry.promptId) || null
    : null;
  const detailReferenceImages = activeDetailPrompt?.referenceImages || [];

  return (
    <section className="relative flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Mobile Creation Flow</div>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">结果瀑布流</h2>
        </div>
        <div className="rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)]/85 px-3 py-1 text-xs text-[var(--text-secondary)]">
          {feedResults.length} 张
        </div>
      </div>

      {feedResults.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-[var(--border-light)] bg-[var(--bg-secondary)]/80 px-6 text-center shadow-[0_18px_48px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <div className="mb-3 rounded-full bg-[var(--bg-tertiary)] p-3 text-[var(--text-secondary)]">
            <Sparkles size={18} />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">从底部输入框开始创作</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            生成结果会直接出现在这里。点击任意结果卡，可以查看原图、提示词、时间、模型信息和下载操作。
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          <div className="columns-2 gap-3 [column-fill:_balance]">
            {feedResults.map((item) => {
              const imageNode = imageNodeById.get(item.imageId);
              const isHighlighted = item.imageId === highlightedId || item.parentPromptId === highlightedId;
              const isActive = activeSourceImage === item.imageId;

              return (
                <article
                  key={item.id}
                  className={`mb-3 break-inside-avoid rounded-[24px] border bg-[var(--bg-secondary)]/92 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-transform duration-200 ${
                    isHighlighted ? 'border-blue-400/60 ring-1 ring-blue-400/40' : 'border-[var(--border-light)]'
                  } ${isActive ? 'border-amber-400/60 ring-1 ring-amber-400/30' : ''}`}
                >
                  <button
                    type="button"
                    className="group flex w-full flex-col text-left"
                    onClick={() => {
                      onImageSelect(item.imageId);
                      setDetailEntryId(item.detailEntryId);
                    }}
                  >
                    <div className="relative overflow-hidden rounded-[18px] bg-[var(--bg-tertiary)]">
                      {item.primaryImageSource ? (
                        <img
                          src={item.primaryImageSource}
                          alt={item.promptSummary}
                          className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex aspect-[3/4] items-center justify-center text-[var(--text-secondary)]">
                          <Loader2 size={18} className="animate-spin" />
                        </div>
                      )}
                      <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md">
                        {formatTimestamp(item.timestamp)}
                      </div>
                    </div>

                    <div className="px-1 pb-1 pt-2">
                      <div className="line-clamp-2 text-sm font-medium leading-5 text-[var(--text-primary)]">
                        {truncateText(item.promptSummary, 72)}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                        <span className="truncate">
                          {resolveModelDisplayName(
                            imageNode?.model || imageNode?.id || item.imageId,
                            imageNode?.modelLabel || imageNode?.model || imageNode?.id || item.imageId,
                          )}
                        </span>
                        <span className="shrink-0">{imageNode?.aspectRatio || 'AUTO'}</span>
                      </div>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {activeDetailResult && activeDetailImage ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/45 md:hidden"
            aria-label="关闭结果详情"
            onClick={() => setDetailEntryId(null)}
          />
          <section className="fixed inset-x-0 bottom-0 z-[71] rounded-t-[28px] border border-white/10 bg-[var(--bg-secondary)]/96 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl md:hidden">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Result Detail</div>
                <h3 className="mt-1 line-clamp-2 text-base font-semibold text-[var(--text-primary)]">
                  {activeDetailResult.promptSummary}
                </h3>
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--border-light)] p-2 text-[var(--text-secondary)]"
                onClick={() => setDetailEntryId(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-3">
              <div className="overflow-hidden rounded-[18px] bg-[var(--bg-tertiary)]">
                {activeDetailResult.primaryImageSource ? (
                  <img
                    src={activeDetailResult.primaryImageSource}
                    alt={activeDetailResult.promptSummary}
                    className="h-[136px] w-full object-cover"
                  />
                ) : (
                  <div className="flex h-[136px] items-center justify-center text-[var(--text-secondary)]">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">提示词</div>
                  <div className="mt-1 line-clamp-4 text-[var(--text-primary)]">
                    {activeDetailPrompt?.originalPrompt || activeDetailPrompt?.prompt || activeDetailResult.promptSummary}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">时间</div>
                  <div className="mt-1 text-[var(--text-primary)]">{formatTimestamp(activeDetailResult.timestamp)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-tertiary)]/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">模型</div>
                    <div className="mt-1 truncate text-[var(--text-primary)]">
                      {resolveModelDisplayName(
                        activeDetailImage.model || activeDetailImage.id,
                        activeDetailImage.modelLabel || activeDetailImage.model || activeDetailImage.id,
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-tertiary)]/60 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">尺寸</div>
                    <div className="mt-1 text-[var(--text-primary)]">
                      {activeDetailImage.aspectRatio || 'AUTO'} / {activeDetailImage.imageSize || '1K'}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">参考图</div>
                  {detailReferenceImages.length > 0 ? (
                    <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                      {detailReferenceImages.slice(0, 4).map((referenceImage) => {
                        const referenceImageSource = resolveReferenceImageSource(referenceImage);
                        return (
                          <div
                            key={referenceImage.id}
                            className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-tertiary)]"
                          >
                            {referenceImageSource ? (
                              <img
                                src={referenceImageSource}
                                alt="参考图"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--text-secondary)]">
                                Ref
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-1 text-[var(--text-secondary)]">未附带参考图</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-tertiary)]/70 text-sm font-medium text-[var(--text-primary)]"
                onClick={() => onImagePreview(activeDetailImage.id)}
              >
                <Eye size={15} />
                查看
              </button>
              <button
                type="button"
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-tertiary)]/70 text-sm font-medium text-[var(--text-primary)]"
                onClick={() => {
                  onUseAsSource(activeDetailImage.id);
                  setDetailEntryId(null);
                }}
              >
                <Sparkles size={15} />
                继续创作
              </button>
              <button
                type="button"
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-tertiary)]/70 text-sm font-medium text-[var(--text-primary)]"
                onClick={() => setShowPartialRedraw(true)}
                disabled={!activeDetailResult.primaryImageSource}
              >
                <Wand2 size={15} />
                重绘
              </button>
              <button
                type="button"
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-tertiary)]/70 text-sm font-medium text-[var(--text-primary)]"
                onClick={() => triggerDownload(activeDetailResult)}
                disabled={!activeDetailResult.primaryImageSource}
              >
                <Download size={15} />
                下载
              </button>
              <button
                type="button"
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border border-red-400/30 bg-red-500/10 text-sm font-medium text-red-400"
                onClick={() => {
                  onImageDelete(activeDetailImage.id);
                  setDetailEntryId(null);
                }}
              >
                <Trash2 size={15} />
                删除
              </button>
            </div>
          </section>
          {showPartialRedraw && activeDetailResult.primaryImageSource ? (
            <PartialRedrawModal
              image={activeDetailImage}
              imageUrl={activeDetailResult.primaryImageSource}
              onCancel={() => setShowPartialRedraw(false)}
              onSubmit={(request) => {
                setShowPartialRedraw(false);
                setDetailEntryId(null);
                onPartialRedraw(activeDetailImage, request);
              }}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
};

export default MobileResultFeed;
