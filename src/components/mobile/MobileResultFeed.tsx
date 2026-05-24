import React from 'react';

import type { MobileResultEntry, ResponsiveSurface, ResultViewMode } from '../../types';
import { useLocale } from '../../context/LocaleContext';
import {
  getAdaptiveResultColumnCount,
  getAdaptiveResultTileGridMetrics,
} from '../../utils/responsiveSurface';
import MobileResultTile from './MobileResultTile';

interface MobileResultFeedProps {
  resultEntries: MobileResultEntry[];
  activeEntryId?: string | null;
  activeSourceImage?: string | null;
  surface: ResponsiveSurface;
  viewMode: ResultViewMode;
  onViewModeChange: (viewMode: ResultViewMode) => void;
  onEntryOpen: (entryId: string) => void;
  onUseAsSource: (imageId: string) => void;
}

const getFallbackWidth = (surface: ResponsiveSurface): number => {
  if (surface === 'phone') {
    return 768;
  }

  if (surface === 'tablet') {
    return 1024;
  }

  return 1280;
};

const MobileResultStandardEmptySkeleton: React.FC<{ columnCount: number }> = ({ columnCount }) => {
  const skeletonCount = Math.max(4, Math.min(columnCount + 2, 6));

  return (
    <div
      data-testid="mobile-result-empty-standard-skeleton"
      className="min-h-0 flex-1 rounded-[24px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] p-3"
    >
      <div
        className="grid h-full min-h-[190px] gap-2.5 overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.min(columnCount, 4))}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <div
            key={index}
            className={`relative overflow-hidden rounded-[18px] border border-white/8 bg-[var(--bg-tertiary)]/70 ${
              index === 0 && columnCount >= 3 ? 'col-span-2' : ''
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/0 to-black/10" />
            <div className="absolute inset-x-2 bottom-2 space-y-1.5">
              <div className="h-1.5 w-2/3 rounded-full bg-white/12" />
              <div className="h-1.5 w-1/2 rounded-full bg-white/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MobileResultDetailEmptySkeleton: React.FC = () => (
  <div
    data-testid="mobile-result-empty-detail-skeleton"
    className="min-h-0 flex-1 rounded-[24px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] p-4"
  >
    <div className="flex h-full min-h-[190px] flex-col gap-3 overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] border border-white/8 bg-[var(--bg-tertiary)]/75">
        <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-white/0 to-black/12" />
        <div className="absolute left-3 top-3 h-6 w-20 rounded-full bg-white/10" />
      </div>
      <div className="space-y-2 rounded-[18px] border border-white/8 bg-black/12 p-3">
        <div className="h-2 w-3/4 rounded-full bg-white/14" />
        <div className="h-2 w-full rounded-full bg-white/10" />
        <div className="h-2 w-2/5 rounded-full bg-white/8" />
      </div>
    </div>
  </div>
);

const MobileResultFeed: React.FC<MobileResultFeedProps> = ({
  resultEntries,
  activeEntryId,
  activeSourceImage,
  surface,
  viewMode,
  onViewModeChange,
  onEntryOpen,
  onUseAsSource,
}) => {
  const { pick } = useLocale();
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = React.useState(() => (
    typeof window !== 'undefined' ? window.innerWidth : getFallbackWidth(surface)
  ));
  const totalResults = resultEntries.length;
  const hasSelectedSource =
    Boolean(activeSourceImage) && resultEntries.some((entry) => entry.imageId === activeSourceImage);
  const counterLabel = totalResults === 0 ? pick('等待中', 'Waiting') : pick(`${totalResults} 个结果`, `${totalResults} results`);
  const selectedSourceLabel = pick('已选源图', 'source selected');
  const columnCount = getAdaptiveResultColumnCount({
    surface,
    width: measuredWidth,
    viewMode,
  });

  const actualCols = React.useMemo(() => {
    if (viewMode === 'detail') return 1;
    if (measuredWidth <= 480) return 2;
    return 3;
  }, [viewMode, measuredWidth]);

  const columnsData = React.useMemo(() => {
    const cols = Array.from({ length: actualCols }, () => [] as MobileResultEntry[]);
    resultEntries.forEach((entry, index) => {
      cols[index % actualCols].push(entry);
    });
    return cols;
  }, [resultEntries, actualCols]);

  React.useEffect(() => {
    if (totalResults > 0) {
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [totalResults]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      setMeasuredWidth(getFallbackWidth(surface));
      return;
    }

    const syncMeasuredWidth = () => {
      setMeasuredWidth(window.innerWidth);
    };

    syncMeasuredWidth();
    window.addEventListener('resize', syncMeasuredWidth);
    return () => {
      window.removeEventListener('resize', syncMeasuredWidth);
    };
  }, [surface]);

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 pr-1 pb-24">
        {totalResults === 0 ? (
          viewMode === 'detail' ? (
            <MobileResultDetailEmptySkeleton />
          ) : (
            <MobileResultStandardEmptySkeleton columnCount={columnCount} />
          )
        ) : (
          <div
            className="grid gap-3 pb-1 [grid-auto-flow:dense]"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gridAutoRows: '8px',
            }}
          >
            {resultEntries.map((entry) => {
              const gridMetrics = getAdaptiveResultTileGridMetrics({
                surface,
                width: measuredWidth,
                viewMode,
                columnCount,
                aspectRatio: entry.mobileLayout.aspectRatio,
                aspectCategory: entry.mobileLayout.aspectCategory,
              });

              return (
                <MobileResultTile
                  key={entry.id}
                  entry={entry}
                  isActive={activeEntryId === entry.id}
                  isSource={activeSourceImage === entry.imageId}
                  viewMode={viewMode}
                  gridMetrics={gridMetrics}
                  onEntryOpen={onEntryOpen}
                  onUseAsSource={onUseAsSource}
                />
              );
            })}
            <div ref={bottomRef} style={{ gridColumn: '1 / -1' }} className="h-1 w-full" />
          </div>
        )}
      </div>

      {/* 底部悬浮操作与模式切换控制区（带暗色渐变过渡，不遮挡内容） */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex items-end justify-between gap-4 px-4 pb-4 pt-12 select-none pointer-events-none bg-gradient-to-t from-black/95 via-black/50 to-transparent">
        <div className="min-w-0 flex flex-col gap-0.5 pointer-events-auto">
          <p className="text-[11px] leading-relaxed text-white/90 drop-shadow-sm font-medium">
            {pick('点击任意结果查看完整提示词和操作。', 'Tap any result to inspect the full prompt and actions.')}
          </p>
          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/55 drop-shadow-sm">
            {hasSelectedSource ? `${counterLabel} / ${selectedSourceLabel}` : counterLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center pointer-events-auto">
          <div className="flex rounded-full border border-white/12 bg-black/40 p-0.5 text-[11px] font-medium text-white/80 shadow-lg">
            {(['standard', 'detail'] as ResultViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={`rounded-full px-3 py-1 transition-all duration-150 ${
                  viewMode === mode ? 'bg-white text-black font-bold shadow-sm' : 'text-white/70 active:text-white active:bg-white/5'
                }`}
              >
                {mode === 'detail' ? pick('详细', 'Detail') : pick('标准', 'Standard')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MobileResultFeed;
