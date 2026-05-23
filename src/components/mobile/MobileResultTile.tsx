import React from 'react';

import type { MobileResultEntry, ResultViewMode } from '../../types';
import type { AdaptiveResultTileGridMetrics } from '../../utils/responsiveSurface';

interface MobileResultTileProps {
  entry: MobileResultEntry;
  isActive: boolean;
  isSource: boolean;
  viewMode: ResultViewMode;
  gridMetrics: AdaptiveResultTileGridMetrics;
  onEntryOpen: (entryId: string) => void;
  onUseAsSource: (imageId: string) => void;
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

const getFallbackAspectClassName = (entry: MobileResultEntry): string => {
  switch (entry.mobileLayout.aspectCategory) {
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
  viewMode,
  gridMetrics,
  onEntryOpen,
  onUseAsSource,
}) => {
  const promptSummary = normalizePromptSummary(entry.promptSummary);
  const imageAspectRatio = Number.isFinite(entry.mobileLayout.aspectRatio) && entry.mobileLayout.aspectRatio > 0
    ? entry.mobileLayout.aspectRatio
    : 1;

  return (
    <article
      className="relative min-w-0 overflow-hidden rounded-[20px] border bg-[var(--mobile-clay-surface-bg)] transition-transform duration-200"
      style={{
        gridColumnEnd: `span ${gridMetrics.columnSpan}`,
        gridRowEnd: `span ${gridMetrics.rowSpan}`,
        borderColor: isActive || isSource ? 'var(--mobile-clay-active-border)' : 'var(--mobile-clay-border)',
        boxShadow: isActive || isSource ? 'var(--mobile-clay-active-ring)' : 'var(--mobile-clay-shadow)',
      }}
    >
      <button
        type="button"
        data-testid={`mobile-result-tile-${entry.id}`}
        className="group relative block h-full min-h-0 w-full text-left"
        onClick={() => onEntryOpen(entry.id)}
        title={promptSummary}
      >
        {entry.displaySrc ? (
          <img
            src={entry.displaySrc}
            alt={promptSummary}
            className="block h-full min-h-0 w-full bg-[var(--bg-tertiary)] object-cover transition-transform duration-300 group-active:scale-[0.985] group-hover:scale-[1.01]"
            style={{ aspectRatio: imageAspectRatio }}
          />
        ) : (
          <div
            className={`flex h-full min-h-0 w-full items-center justify-center bg-[var(--bg-tertiary)] text-[13px] text-[var(--text-secondary)] ${getFallbackAspectClassName(entry)}`}
          >
            暂无预览
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <span className="max-w-[65%] truncate rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] px-2 py-1 text-[10px] font-medium text-[var(--text-primary)]">
            {formatTimestamp(entry.timestamp)}
          </span>
          {isSource ? (
            <span className="rounded-full bg-amber-400/90 px-2 py-1 text-[10px] font-medium text-black">
              参考图
            </span>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-2.5 pt-8">
          <div className="flex flex-col gap-1">
            <span className="line-clamp-2 text-[11px] font-medium leading-4 text-white/90">
              {promptSummary}
            </span>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="truncate text-[9px] text-white/70 font-light">
                {entry.modelLabel}
              </span>
              <span className="shrink-0 truncate rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-medium text-white/85">
                {entry.displayLabel || entry.aspectRatio}
              </span>
            </div>
          </div>
        </div>
      </button>
    </article>
  );
};

export default MobileResultTile;
