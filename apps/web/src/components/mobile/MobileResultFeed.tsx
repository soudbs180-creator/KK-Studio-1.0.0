import React, { useState, useMemo } from 'react';
import { Search, X, ArrowLeft, ArrowDown } from 'lucide-react';

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
  isLoading?: boolean;
  isHistoryView?: boolean;
  onCloseHistory?: () => void;
}

// 简体中文：搜索无结果时显示的精致空状态组件
const MobileResultSearchEmptyState: React.FC<{ query: string; onClear: () => void }> = ({ query, onClear }) => {
  const { pick } = useLocale();
  return (
    <div
      data-testid="mobile-result-search-empty-state"
      className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center select-none"
    >
      <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 mb-4">
        <Search size={22} />
      </div>
      <h3 className="text-lg font-bold tracking-wide text-white/90 mb-2">
        {pick('未找到匹配结果', 'No matching results')}
      </h3>
      <p className="text-xs leading-relaxed text-white/40 max-w-xs px-2 mb-5">
        {pick(`没有找到包含 "${query}" 的生成历史记录，请尝试精简或更换关键词。`, `No results matching "${query}". Please check your spelling or try another query.`)}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full border border-[var(--mobile-clay-active-border)] bg-[var(--mobile-clay-active-bg)] px-5 py-2 text-xs font-semibold text-white shadow-md active:scale-95 transition-transform"
      >
        {pick('清除搜索词', 'Clear search')}
      </button>
    </div>
  );
};

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

const MobileResultFeedEmptyState: React.FC = () => {
  const { pick } = useLocale();
  return (
    <div
      data-testid="mobile-result-empty-state"
      className="flex flex-col items-center justify-center flex-1 py-12 px-6 text-center select-none"
    >
      <h3 className="text-xl font-bold tracking-wide text-white/90 drop-shadow-sm mb-2">
        {pick('我们从哪里开始？', 'Where should we start?')}
      </h3>
      <p className="text-xs leading-relaxed text-white/40 max-w-sm px-2">
        {pick('在下方输入您的创意提示词，即刻开启 AI 灵感之旅。', 'Enter your creative prompt below to begin your AI generation journey.')}
      </p>
    </div>
  );
};

// 简体中文：定义模块级别的滚动状态记录，防止组件卸载重建时丢失，确保仅在首次加载及新图生成时才自动滑到底部
let hasInitiallyScrolled = false;
let lastResultsCount = 0;

const MobileResultFeed: React.FC<MobileResultFeedProps> = ({
  resultEntries,
  activeEntryId,
  activeSourceImage,
  surface,
  viewMode,
  onViewModeChange,
  onEntryOpen,
  onUseAsSource,
  isLoading = false,
  isHistoryView = false,
  onCloseHistory,
}) => {
  const { pick } = useLocale();
  const [measuredWidth, setMeasuredWidth] = React.useState(() => (
    typeof window !== 'undefined' ? window.innerWidth : getFallbackWidth(surface)
  ));

  // 简体中文：本地搜索过滤关键词状态
  const [searchQuery, setSearchQuery] = useState('');

  // 简体中文：本地对历史生成记录的匹配过滤逻辑，支持提示词、渲染模型、标签等的匹配
  const filteredEntries = useMemo(() => {
    if (!isHistoryView || !searchQuery.trim()) {
      return resultEntries;
    }
    const query = searchQuery.toLowerCase().trim();
    return resultEntries.filter((entry) => {
      const matchPrompt = (entry.fullPrompt && entry.fullPrompt.toLowerCase().includes(query)) ||
                          (entry.promptSummary && entry.promptSummary.toLowerCase().includes(query)) ||
                          (entry.prompt && entry.prompt.toLowerCase().includes(query));
      const matchModel = entry.modelLabel && entry.modelLabel.toLowerCase().includes(query);
      const matchTags = entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(query));
      return matchPrompt || matchModel || matchTags;
    });
  }, [resultEntries, searchQuery, isHistoryView]);

  const totalResults = filteredEntries.length;
  const hasSelectedSource =
    Boolean(activeSourceImage) && filteredEntries.some((entry) => entry.imageId === activeSourceImage);
  const counterLabel = totalResults === 0 ? pick('等待中', 'Waiting') : pick(`${totalResults} 个结果`, `${totalResults} results`);
  const selectedSourceLabel = pick('已选源图', 'source selected');
  const columnCount = getAdaptiveResultColumnCount({
    surface,
    width: measuredWidth,
    viewMode,
  });

  // 根据视口宽度与模式，计算出自适应列数以渲染 Pinterest 瀑布流，限制手机端最大为 2 列
  const actualCols = React.useMemo(() => {
    if (viewMode === 'detail') return 1;
    if (surface === 'phone' || measuredWidth <= 640) return 2;
    return 3;
  }, [viewMode, measuredWidth, surface]);

  // 简体中文：将结果条目动态分发到当前累计高度最小的一列，实现高度极其均衡的自适应瀑布流效果
  const columnsData = React.useMemo(() => {
    const cols = Array.from({ length: actualCols }, () => [] as MobileResultEntry[]);
    const colHeights = Array(actualCols).fill(0);

    filteredEntries.forEach((entry) => {
      // 估算当前图片在设定宽度下的相对物理高度（与 1 / aspectRatio 成正比）
      const ratio = entry.mobileLayout?.aspectRatio || 1;
      const relativeHeight = ratio > 0 ? (1.0 / ratio) : 1.0;

      // 详细模式（detail）下，卡片底部会多出一部分固定比例的文字参数展示区
      const textHeight = viewMode === 'detail' ? 0.6 : 0.0;
      const totalItemHeight = relativeHeight + textHeight;

      // 动态寻找当前累计高度最小的列
      let minColIdx = 0;
      let minColHeight = colHeights[0];
      for (let i = 1; i < actualCols; i++) {
        if (colHeights[i] < minColHeight) {
          minColHeight = colHeights[i];
          minColIdx = i;
        } else if (colHeights[i] === minColHeight) {
          // 如果高度相同，优先选择当前列中图片数量较少的列，若数量也相同则优先选择右侧列，防止右侧留空
          if (cols[i].length <= cols[minColIdx].length) {
            minColIdx = i;
          }
        }
      }

      cols[minColIdx].push(entry);
      colHeights[minColIdx] += totalItemHeight;
    });

    return cols;
  }, [filteredEntries, actualCols, viewMode]);

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const contentWrapperRef = React.useRef<HTMLDivElement>(null);

  // 简体中文：如果数据被清空，重置滚动状态，以便下次有数据时重新对焦
  React.useEffect(() => {
    if (totalResults === 0) {
      hasInitiallyScrolled = false;
      lastResultsCount = 0;
    }
  }, [totalResults]);

  React.useEffect(() => {
    if (totalResults > 0) {
      // 仅在首屏初次加载，或者新图生成使得结果总数增加时，才触发平滑滚动到底部
      const shouldScroll = !hasInitiallyScrolled || totalResults > lastResultsCount;
      
      if (shouldScroll) {
        const timer = setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 150);
        hasInitiallyScrolled = true;
        lastResultsCount = totalResults;
        return () => clearTimeout(timer);
      }
      
      // 其他渲染或操作导致 useEffect 执行时，更新结果数记录以保持一致
      lastResultsCount = totalResults;
    }
  }, [totalResults]);

  // 简体中文：为滚动展示区赋予极致流畅（120Hz 满帧 GPU 硬件加速）的 iOS 橡皮筋阻尼弹性回弹效果
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    const content = contentWrapperRef.current;
    if (!container || !content) return;

    let startY = 0;
    let startScrollTop = 0;
    let maxScrollTop = 0;
    let active = false;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startScrollTop = container.scrollTop;
      // 实时计算容器当前的最大可滚动高度
      maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      content.style.transition = 'none';
      active = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!active) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      // 顶部超界下拉：进行紧实型阻尼位移，最大偏移限制在屏幕高度的 40%
      if (startScrollTop <= 0 && deltaY > 0) {
        if (e.cancelable) e.preventDefault();
        const limit = window.innerHeight * 0.4;
        const offset = (deltaY * limit) / (deltaY + limit);
        content.style.transform = `translateY(${offset}px)`;
      }
      // 底部超界上拉：进行大余量阻尼位移，最大偏移限制在屏幕高度 of 60%（允许轻松拉过屏幕一半）
      else if (startScrollTop >= maxScrollTop - 1 && deltaY < 0) {
        if (e.cancelable) e.preventDefault();
        const pullDistance = -deltaY;
        const limit = window.innerHeight * 0.6;
        const offset = (pullDistance * limit) / (pullDistance + limit);
        content.style.transform = `translateY(${-offset}px)`;
      }
    };

    const handleTouchEnd = () => {
      active = false;
      // 触手松开，以极富弹性质感的缓动曲线过渡复位
      content.style.transition = 'transform 0.45s cubic-bezier(0.25, 0.8, 0.25, 1)';
      content.style.transform = 'translateY(0px)';
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
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
      {/* 简体中文：极致高颜值的移动端顶部搜索和历史控制栏，带半透明磨砂质感和返回面包屑 */}
      {isHistoryView && (
        <div 
          className="shrink-0 px-3.5 pt-3 pb-2.5 flex flex-col gap-2.5 border-b"
          style={{
            background: 'linear-gradient(to bottom, rgba(20, 20, 22, 0.95) 0%, rgba(20, 20, 22, 0.85) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* 面包屑返回头部 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onCloseHistory}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-all active:scale-[0.97] active:bg-white/10"
            >
              <ArrowLeft size={13} className="text-[var(--text-tertiary)]" />
              <span>{pick('返回工作区', 'Back to Workspace')}</span>
            </button>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)] select-none">
              {pick('生成历史与检索', 'HISTORY & SEARCH')}
            </div>
          </div>

          {/* 极其精致的磨砂毛玻璃搜索框 */}
          <div 
            className="relative flex items-center rounded-xl border transition-all duration-300 focus-within:border-[var(--mobile-clay-active-border)] focus-within:bg-white/[0.06] bg-white/[0.03] px-3.5 py-2.5"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <Search size={16} className="text-white/40 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={pick('搜索提示词、模型、标签...', 'Search prompts, models, tags...')}
              className="flex-1 bg-transparent border-none p-0 text-sm font-medium focus:outline-none focus:ring-0 text-[var(--text-primary)]"
              style={{
                fontFamily: '"HarmonyOS Sans SC", "Inter", sans-serif',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-white/5 rounded-full text-white/50 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 采用 Pinterest 自适应列布局的滚动展示区 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain px-3 pr-1 pb-24 flex flex-col"
      >
        <div 
          ref={contentWrapperRef} 
          className="w-full flex flex-col min-h-full"
          style={{ willChange: 'transform' }}
        >
          {totalResults === 0 ? (
          searchQuery.trim() ? (
            <MobileResultSearchEmptyState query={searchQuery} onClear={() => setSearchQuery('')} />
          ) : isLoading ? (
            viewMode === 'detail' ? (
              <MobileResultDetailEmptySkeleton />
            ) : (
              <MobileResultStandardEmptySkeleton columnCount={actualCols} />
            )
          ) : (
            <MobileResultFeedEmptyState />
          )
        ) : (
          <div className="relative">
            <div className="flex gap-2 items-start pb-1">
              {columnsData.map((column, colIdx) => (
                <div key={colIdx} className="flex flex-1 flex-col gap-2 min-w-0">
                  {column.map((entry) => {
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
                </div>
              ))}
            </div>
            {/* 用来滚动定位到底部的锚点，避免内容滚动被遮挡 */}
            <div ref={bottomRef} className="h-1 w-full pointer-events-none" />
          </div>
        )}
        </div>
      </div>

      {/* 底部悬浮操作与模式切换控制区（带暗色渐变过渡，不遮挡内容，左右顶满） */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex items-end justify-between gap-4 px-4 pb-4 pt-12 select-none pointer-events-none bg-gradient-to-t from-black/95 via-black/50 to-transparent">
        <div className="min-w-0 flex flex-col gap-0.5 pointer-events-auto">
          <p className="text-[11px] leading-relaxed text-white/90 drop-shadow-sm font-medium">
            {pick('点击任意结果查看完整提示词和操作。', 'Tap any result to inspect the full prompt and actions.')}
          </p>
          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/55 drop-shadow-sm">
            {hasSelectedSource ? `${counterLabel} / ${selectedSourceLabel}` : counterLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pointer-events-auto">
          {/* 模式切换胶囊 */}
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

          {/* 快速一键滚动回底部的圆形毛玻璃按钮，高度与切换胶囊完全对齐，具备弹性缩放交互动效 */}
          <button
            type="button"
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }}
            title={pick('回到底部', 'Scroll to Bottom')}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-black/40 text-white/80 shadow-lg hover:text-white hover:border-white/20 active:scale-90 active:bg-white/10 transition-all duration-150"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default MobileResultFeed;
