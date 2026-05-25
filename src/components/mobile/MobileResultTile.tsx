import React from 'react';

import { Sparkles } from 'lucide-react';

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
        className="group relative block w-full text-left"
        onClick={() => onEntryOpen(entry.id)}
        title={promptSummary}
      >
        {entry.displaySrc ? (
          <img
            src={entry.displaySrc}
            alt={promptSummary}
            className="block w-full bg-[var(--bg-tertiary)] object-cover transition-transform duration-300 group-active:scale-[0.985] group-hover:scale-[1.01]"
            style={{ aspectRatio: imageAspectRatio }}
          />
        ) : (
          <div
            className={`flex w-full items-center justify-center bg-[var(--bg-tertiary)] text-[13px] text-[var(--text-secondary)] ${getFallbackAspectClassName(entry)}`}
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

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-3 pb-3 pt-8">
          <div className="flex items-end justify-between gap-2">
            <span className="line-clamp-2 text-[11px] font-medium leading-4 text-white/90">
              {promptSummary}
            </span>
            <span className="max-w-[42%] shrink-0 truncate rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
              {entry.displayLabel || entry.aspectRatio}
            </span>
          </div>
        </div>
      </button>
      {viewMode === 'detail' ? (
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
          <div className="min-w-0 text-[11px] text-[var(--text-secondary)]">
            <span className="truncate">{entry.modelLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => onUseAsSource(entry.imageId)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-light)] bg-[var(--bg-tertiary)] px-2.5 text-[11px] font-medium text-[var(--text-primary)]"
            title="继续创作"
          >
            <Sparkles size={13} />
            <span className="whitespace-nowrap">继续</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onUseAsSource(entry.imageId)}
          className="absolute right-2 top-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--mobile-clay-active-border)] bg-[var(--accent-color)] text-[var(--text-inverse)]"
          title="继续创作"
          aria-label="继续创作"
        >
          <Sparkles size={14} />
        </button>
      )}
    </article>
  );
};

export default MobileResultTile;
