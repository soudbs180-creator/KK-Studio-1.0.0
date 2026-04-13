import React from 'react';

import { Sparkles } from 'lucide-react';

import type { MobileResultEntry } from '../../types';

interface MobileResultFeedProps {
  resultEntries: MobileResultEntry[];
  activeEntryId?: string | null;
  activeSourceImage?: string | null;
  onEntryOpen: (entryId: string) => void;
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

const normalizePromptSummary = (value: string): string => {
  const normalized = value.trim();
  return normalized || '未命名结果';
};

const getSpanClassName = (entry: MobileResultEntry): string => {
  if (entry.mobileTileSpan === 6) {
    return 'col-span-6';
  }

  if (entry.mobileTileSpan === 3) {
    return 'col-span-3';
  }

  return 'col-span-2';
};

const getFallbackAspectClassName = (entry: MobileResultEntry): string => {
  switch (entry.mobileAspectCategory) {
    case 'wide':
      return 'aspect-[16/8]';
    case 'landscape':
      return 'aspect-[4/3]';
    case 'portrait':
      return 'aspect-[3/4]';
    default:
      return 'aspect-square';
  }
};

const MobileResultFeed: React.FC<MobileResultFeedProps> = ({
  resultEntries,
  activeEntryId,
  activeSourceImage,
  onEntryOpen,
}) => {
  const totalResults = resultEntries.length;
  const hasSelectedSource =
    Boolean(activeSourceImage) && resultEntries.some((entry) => entry.imageId === activeSourceImage);
  const counterLabel = totalResults === 0 ? '等待生成' : `${totalResults} 张结果`;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            创作结果
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            中间区域只看图，点开任意结果再查看完整提示词和操作。
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)]/85 px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
          {hasSelectedSource ? `${counterLabel} · 已选参考图` : counterLabel}
        </div>
      </div>

      {totalResults === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-[var(--border-light)] bg-[var(--bg-secondary)]/82 px-6 py-8 text-center shadow-[0_22px_52px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <div className="mb-3 rounded-full bg-[var(--bg-tertiary)] p-3 text-[var(--text-secondary)]">
            <Sparkles size={18} />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">还没有生成结果</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            从底部输入区发送提示词后，新的结果会优先进入这里。首页默认只展示图片内容，详细信息在详情页查看。
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <div className="grid grid-cols-6 gap-3 pb-1 [grid-auto-flow:dense]">
            {resultEntries.map((entry) => {
              const promptSummary = normalizePromptSummary(entry.promptSummary);
              const isActive = activeEntryId === entry.id;
              const isSource = activeSourceImage === entry.imageId;
              const spanClassName = getSpanClassName(entry);
              const emphasisShadow =
                entry.mobileTileEmphasis === 'hero'
                  ? 'shadow-[0_24px_56px_rgba(15,23,42,0.28)]'
                  : 'shadow-[0_16px_36px_rgba(15,23,42,0.2)]';

              return (
                <article
                  key={entry.id}
                  className={`${spanClassName} ${emphasisShadow} overflow-hidden rounded-[24px] border bg-[var(--bg-secondary)]/92 transition-transform duration-200 ${
                    isActive ? 'border-blue-400/55 ring-1 ring-blue-400/35' : 'border-[var(--border-light)]'
                  } ${isSource ? 'border-amber-400/60 ring-1 ring-amber-400/30' : ''}`}
                >
                  <button
                    type="button"
                    className="group relative block w-full text-left"
                    onClick={() => onEntryOpen(entry.id)}
                    title={promptSummary}
                  >
                    {entry.displaySrc ? (
                      <img
                        src={entry.displaySrc}
                        alt={promptSummary}
                        className="block h-auto w-full bg-[var(--bg-tertiary)] object-cover transition-transform duration-300 group-active:scale-[0.985] group-hover:scale-[1.01]"
                      />
                    ) : (
                      <div
                        className={`flex w-full items-center justify-center bg-[var(--bg-tertiary)] text-[13px] text-[var(--text-secondary)] ${getFallbackAspectClassName(entry)}`}
                      >
                        暂无预览
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
                      <span className="rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      {isSource ? (
                        <span className="rounded-full bg-amber-400/90 px-2 py-1 text-[10px] font-medium text-black">
                          参考图
                        </span>
                      ) : null}
                    </div>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-3 pb-3 pt-8">
                      <div className="flex items-end justify-between gap-2">
                        <span className="line-clamp-2 text-[11px] font-medium leading-4 text-white/90">
                          {promptSummary}
                        </span>
                        <span className="shrink-0 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
                          {entry.displayLabel || entry.aspectRatio}
                        </span>
                      </div>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

export default MobileResultFeed;
