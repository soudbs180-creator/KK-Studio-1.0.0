import React from 'react';

import type { MobileResultEntry } from '../../types';

interface MobileResultTileProps {
  entry: MobileResultEntry;
  isActive: boolean;
  isSource: boolean;
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

const MobileResultTile: React.FC<MobileResultTileProps> = ({
  entry,
  isActive,
  isSource,
  onEntryOpen,
}) => {
  const promptSummary = normalizePromptSummary(entry.promptSummary);
  const spanClassName = getSpanClassName(entry);
  const emphasisShadow =
    entry.mobileTileEmphasis === 'hero'
      ? 'shadow-[0_24px_56px_rgba(15,23,42,0.28)]'
      : 'shadow-[0_16px_36px_rgba(15,23,42,0.2)]';

  return (
    <article
      className={`${spanClassName} ${emphasisShadow} overflow-hidden rounded-[24px] border bg-[var(--bg-secondary)]/92 transition-transform duration-200 ${
        isActive ? 'border-blue-400/55 ring-1 ring-blue-400/35' : 'border-[var(--border-light)]'
      } ${isSource ? 'border-amber-400/60 ring-1 ring-amber-400/30' : ''}`}
    >
      <button
        type="button"
        data-testid={`mobile-result-tile-${entry.id}`}
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
};

export default MobileResultTile;
