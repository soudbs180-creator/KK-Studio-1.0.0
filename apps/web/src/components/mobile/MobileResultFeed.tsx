import React, { useState, useMemo } from 'react';
import { Search, X, ArrowLeft, ChevronsDown, Copy, Download, Trash2, LayoutGrid, Rows } from 'lucide-react';

import type { MobileResultEntry, ResponsiveSurface, ResultViewMode } from '../../types';
import { useLocale } from '../../context/LocaleContext';
import {
  getAdaptiveResultColumnCount,
  getAdaptiveResultTileGridMetrics,
} from '../../utils/responsiveSurface';
import MobileResultTile from './MobileResultTile';
import { notify } from '../../services/system/notificationService';

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
  // 简体中文：支持多选删除与多选下载所需的批量操作回调
  onDeleteImage?: (imageId: string) => void;
  onDownloadEntry?: (entry: MobileResultEntry) => void;
}

// 简体中文：搜索无结果时显示的精致空状态组件
const MobileResultSearchEmptyState: React.FC<{ query: string; onClear: () => void }> = ({ query, onClear }) => {
  const { pick } = useLocale();
  return (
    <div
      data-testid="mobile-result-search-empty-state"
      className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center select-none"
    >
      <div className="h-12 w-12 rounded-2xl bg-[var(--mobile-clay-surface-bg)] border border-[var(--mobile-clay-border)] flex items-center justify-center text-[var(--text-tertiary)] mb-4">
        <Search size={22} />
      </div>
      <h3 className="text-lg font-bold tracking-wide text-[var(--text-primary)] mb-2">
        {pick('未找到匹配结果', 'No matching results')}
      </h3>
      <p className="text-xs leading-relaxed text-[var(--text-tertiary)] max-w-xs px-2 mb-5">
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

const stopMobileResultControlEvent = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

const MobileResultStandardEmptySkeleton: React.FC<{ columnCount: number }> = ({ columnCount }) => {
  const skeletonCount = Math.max(4, Math.min(columnCount + 2, 6));

  return (
    <div
      data-testid="mobile-result-empty-standard-skeleton"
      className="min-h-0 flex-1 rounded-[20px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] p-3"
    >
      <div
        className="grid h-full min-h-[190px] gap-2.5 overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.min(columnCount, 4))}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <div
            key={index}
            className={`relative overflow-hidden rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/80 ${
              index === 0 && columnCount >= 3 ? 'col-span-2' : ''
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/0 to-black/10" />
            <div className="absolute inset-x-2 bottom-2 space-y-1.5">
              <div className="h-1.5 w-2/3 rounded-full bg-[var(--text-muted)]/15" />
              <div className="h-1.5 w-1/2 rounded-full bg-[var(--text-muted)]/10" />
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
    className="min-h-0 flex-1 rounded-[20px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] p-4"
  >
    <div className="flex h-full min-h-[190px] flex-col gap-3 overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/80">
        <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-white/0 to-black/12" />
        <div className="absolute left-3 top-3 h-6 w-20 rounded-full bg-[var(--text-muted)]/12" />
      </div>
      <div className="space-y-2 rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] p-3">
        <div className="h-2 w-3/4 rounded-full bg-[var(--text-muted)]/20" />
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
      <h3 className="text-xl font-bold tracking-wide text-[var(--text-primary)] mb-2">
        {pick('我们从哪里开始？', 'Where should we start?')}
      </h3>
      <p className="text-xs leading-relaxed text-[var(--text-tertiary)] max-w-sm px-2">
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
  onDeleteImage,
  onDownloadEntry,
}) => {
  const { pick } = useLocale();
  const [measuredWidth, setMeasuredWidth] = React.useState(() => (
    typeof window !== 'undefined' ? window.innerWidth : getFallbackWidth(surface)
  ));

  // 简体中文：本地搜索过滤关键词状态
  const [searchQuery, setSearchQuery] = useState('');

  // 简体中文：监听输入法/输入框的聚焦状态，以在软键盘弹出时隐藏悬浮按钮，防止误触和穿模
  const [isInputActive, setIsInputActive] = useState(false);

  React.useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        setIsInputActive(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          const activeEl = document.activeElement;
          if (!activeEl || (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA')) {
            setIsInputActive(false);
          }
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // 简体中文：定义多选状态与选中条目的 Set 集合，以便进行批量操作
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 简体中文：当退出多选模式时，自动清空选中状态，防止状态泄露
  React.useEffect(() => {
    if (!isMultiSelectMode) {
      setSelectedIds(new Set());
    }
  }, [isMultiSelectMode]);

  // 简体中文：批量复制选中图片提示词的处理器
  const handleBatchCopyPrompts = () => {
    if (selectedIds.size === 0) return;
    const prompts = Array.from(selectedIds)
      .map(id => {
        const entry = resultEntries.find(e => e.id === id);
        return entry ? (entry.fullPrompt || entry.prompt || '') : '';
      })
      .filter(Boolean);

    if (prompts.length === 0) return;

    const textToCopy = prompts.join('\n\n');
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        notify.success(
          pick('复制成功', 'Copied successfully'),
          pick(`已复制 ${prompts.length} 个提示词到剪贴板。`, `Copied ${prompts.length} prompts to clipboard.`)
        );
      })
      .catch(() => {
        notify.error(
          pick('复制失败', 'Copy failed'),
          pick('当前环境不支持剪贴板写入', 'Clipboard write not supported in this environment')
        );
      });
  };

  // 简体中文：批量下载选中图片的处理器
  const handleBatchDownload = () => {
    if (selectedIds.size === 0 || !onDownloadEntry) return;
    let count = 0;
    selectedIds.forEach(id => {
      const entry = resultEntries.find(e => e.id === id);
      if (entry) {
        onDownloadEntry(entry);
        count++;
      }
    });
    notify.success(
      pick('下载已启动', 'Downloads started'),
      pick(`已开始批量下载选中的 ${count} 张图片。`, `Started batch downloading ${count} selected images.`)
    );
  };

  // 简体中文：批量从画布中删除选中图片的处理器，带二次弹窗确认
  const handleBatchDelete = () => {
    if (selectedIds.size === 0 || !onDeleteImage) return;

    const confirmMessage = pick(
      `确定要删除选中的 ${selectedIds.size} 张图片吗？该操作无法撤销。`,
      `Are you sure you want to delete the ${selectedIds.size} selected images? This action cannot be undone.`
    );

    if (window.confirm(confirmMessage)) {
      let count = 0;
      selectedIds.forEach(id => {
        const entry = resultEntries.find(e => e.id === id);
        if (entry && entry.imageId) {
          onDeleteImage(entry.imageId);
          count++;
        }
      });
      notify.success(
        pick('删除成功', 'Deleted successfully'),
        pick(`已成功从画布删除 ${count} 张图片。`, `Successfully deleted ${count} images from the canvas.`)
      );
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    }
  };

  // 简体中文：本地对历史生成记录的匹配过滤逻辑，参考电脑端设计：标签匹配优先，且按最新时间戳降序重排
  const filteredEntries = useMemo(() => {
    if (!isHistoryView || !searchQuery.trim()) {
      return resultEntries;
    }
    const query = searchQuery.toLowerCase().trim();
    const matching = resultEntries.filter((entry) => {
      const matchPrompt = (entry.fullPrompt && entry.fullPrompt.toLowerCase().includes(query)) ||
                          (entry.promptSummary && entry.promptSummary.toLowerCase().includes(query)) ||
                          (entry.prompt && entry.prompt.toLowerCase().includes(query));
      const matchModel = entry.modelLabel && entry.modelLabel.toLowerCase().includes(query);
      const matchTags = entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(query));
      return matchPrompt || matchModel || matchTags;
    });

    // 简体中文：匹配排序算法——标签匹配优先置顶，其次按 timestamp 最新生成时间倒序
    matching.sort((a, b) => {
      const aTagMatch = a.tags && a.tags.some(tag => tag.toLowerCase().includes(query));
      const bTagMatch = b.tags && b.tags.some(tag => tag.toLowerCase().includes(query));

      if (aTagMatch && !bTagMatch) return -1;
      if (!aTagMatch && bTagMatch) return 1;

      return b.timestamp - a.timestamp;
    });

    return matching;
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

      // 顶部超界下拉：进行紧实型阻尼位移，最大偏移限制在屏幕高度的 35%
      if (startScrollTop <= 0 && deltaY > 0) {
        if (e.cancelable) e.preventDefault();
        const limit = window.innerHeight * 0.35;
        const offset = (deltaY * limit) / (deltaY + limit);
        content.style.transform = `translateY(${offset}px)`;
      }
      // 底部超界上拉：进行大余量阻尼位移，最大偏移限制在屏幕高度 of 50%（允许轻松拉过屏幕一半）
      else if (startScrollTop >= maxScrollTop - 1 && deltaY < 0) {
        if (e.cancelable) e.preventDefault();
        const pullDistance = -deltaY;
        const limit = window.innerHeight * 0.5;
        const offset = (pullDistance * limit) / (pullDistance + limit);
        content.style.transform = `translateY(${-offset}px)`;
      }
    };

    const handleTouchEnd = () => {
      active = false;
      // 触手松开，以更具动量弹性质感的缓动曲线物理回弹复位
      content.style.transition = 'transform var(--kk-motion-panel) var(--kk-motion-ease-standard)';
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
    <section className="kk-result-surface relative flex h-full min-h-0 flex-col overflow-hidden">
      {/* 简体中文：极致高颜值的移动端顶部搜索和历史控制栏，带半透明磨砂质感 and 返回面包屑 */}
      {isHistoryView && (
        <div 
          className="kk-result-history-header shrink-0 px-3.5 pb-2.5 flex flex-col gap-2.5 border-b"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          }}
        >
          {/* 面包屑返回头部与多选切换胶囊 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onCloseHistory}
              className="kk-result-control inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[var(--text-secondary)] active:scale-[0.97]"
            >
              <ArrowLeft size={13} className="text-[var(--text-tertiary)]" />
              <span>{pick('返回工作区', 'Back to Workspace')}</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMultiSelectMode(prev => !prev)}
                className={`kk-result-control inline-flex items-center rounded-full px-3 text-xs font-semibold active:scale-[0.97] ${isMultiSelectMode ? 'border-[var(--mobile-clay-active-border)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                aria-pressed={isMultiSelectMode}
              >
                {isMultiSelectMode ? pick('取消多选', 'Cancel') : pick('多选', 'Select')}
              </button>
            </div>
          </div>

          {/* 极其精致的磨砂毛玻璃搜索框 */}
          <div 
            className="kk-result-control relative flex items-center rounded-xl px-3.5 py-0 focus-within:border-[var(--mobile-clay-active-border)] focus-within:bg-[var(--mobile-clay-active-bg)]"
          >
            <Search size={16} className="text-[var(--text-tertiary)] mr-2 shrink-0" />
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
                className="kk-result-icon-control -mr-2 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
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
        className="flex-1 overflow-y-auto overscroll-contain px-3 pb-24 flex flex-col"
        style={{
          paddingTop: isHistoryView ? '12px' : 'var(--mobile-content-top-inset, 76px)',
        }}
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
                        // 简体中文：支持移动端多选状态下的点击拦截和复选框展示
                        isMultiSelectMode={isMultiSelectMode}
                        isSelected={selectedIds.has(entry.id)}
                        onToggleSelect={(id) => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) {
                              next.delete(id);
                            } else {
                              next.add(id);
                            }
                            return next;
                          });
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            {/* 移动端专属：底部超大安全占位块（约占 45% 屏幕高度），防止最新生成的图片被手机软键盘和输入法遮挡，提供极致舒适的输入与观赏间距 */}
            <div className="h-[45vh] w-full pointer-events-none shrink-0" />
            {/* 用来滚动定位到底部的锚点，避免内容滚动被遮挡 */}
            <div ref={bottomRef} className="h-1 w-full pointer-events-none shrink-0" />
          </div>
        )}
        </div>
      </div>

      {/* 底部悬浮操作与模式切换控制区，多选模式下切换为批量操作栏 */}
      <div 
        className={`kk-result-bottom-bar absolute bottom-0 inset-x-0 z-20 flex items-center justify-between gap-3 px-4 pt-4 select-none pointer-events-none transition-[opacity,transform] transform ${
          isInputActive 
            ? 'opacity-0 pointer-events-none translate-y-6' 
            : 'opacity-100'
        }`}
      >
        <div 
          className="absolute inset-0 -z-10"
          style={{
            background: 'var(--kk-result-bottom-scrim-bg)'
          }}
        />

        {isMultiSelectMode ? (
          // 简体中文：多选模式下的精致批量操作控制栏，毛玻璃暗色效果
          <div 
            className="w-full flex touch-manipulation items-center justify-between gap-3 pointer-events-auto py-1"
            onPointerDown={stopMobileResultControlEvent}
            onMouseDown={stopMobileResultControlEvent}
            onClick={stopMobileResultControlEvent}
            onTouchStart={stopMobileResultControlEvent}
            onTouchEnd={stopMobileResultControlEvent}
          >
            <div className="min-w-0 flex flex-col justify-center">
              <span className="text-xs font-bold text-white tracking-wide">
                {pick(`已选择 ${selectedIds.size} 项`, `Selected ${selectedIds.size} items`)}
              </span>
              <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest mt-0.5 select-none">
                {pick('批量整理与操作', 'BATCH ACTIONS')}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {/* 批量复制提示词 */}
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onPointerDown={stopMobileResultControlEvent}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBatchCopyPrompts();
                }}
                className="kk-result-control flex touch-manipulation items-center gap-1 rounded-full px-3 text-xs font-semibold active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                title={pick('复制选中提示词', 'Copy selected prompts')}
              >
                <Copy size={13} />
                <span>{pick('复制', 'Copy')}</span>
              </button>

              {/* 批量下载 */}
              {onDownloadEntry && (
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onPointerDown={stopMobileResultControlEvent}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBatchDownload();
                  }}
                  className="kk-result-control flex touch-manipulation items-center gap-1 rounded-full px-3 text-xs font-semibold active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                  title={pick('下载选中图片', 'Download selected images')}
                >
                  <Download size={13} />
                  <span>{pick('下载', 'DL')}</span>
                </button>
              )}

              {/* 批量删除 */}
              {onDeleteImage && (
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onPointerDown={stopMobileResultControlEvent}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBatchDelete();
                  }}
                  className="kk-result-control kk-result-danger-control flex touch-manipulation items-center gap-1 rounded-full px-3 text-xs font-semibold active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                  title={pick('删除选中图片', 'Delete selected images')}
                >
                  <Trash2 size={13} />
                  <span>{pick('删除', 'Delete')}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          // 简体中文：常规模式下的切换胶囊和计数器
          <>
            <div 
              className="flex min-h-11 min-w-0 touch-manipulation flex-col justify-center gap-0.5 pointer-events-auto"
              onPointerDown={stopMobileResultControlEvent}
              onMouseDown={stopMobileResultControlEvent}
              onClick={stopMobileResultControlEvent}
              onTouchStart={stopMobileResultControlEvent}
              onTouchEnd={stopMobileResultControlEvent}
            >
              <p className="text-[11px] leading-none text-[var(--text-primary)] font-semibold">
                {pick('生成结果', 'Generated results')}
              </p>
              <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                {hasSelectedSource ? `${counterLabel} / ${selectedSourceLabel}` : counterLabel}
              </div>
            </div>
            {/* 简体中文：紧凑模式切换坞与独立回底按钮共用一层视觉外壳，触控目标保持 44px。 */}
            <div 
              data-testid="mobile-result-view-controls"
              className="kk-result-panel kk-result-view-controls flex shrink-0 touch-manipulation items-center pointer-events-auto text-[11px] font-medium"
              onPointerDown={stopMobileResultControlEvent}
              onMouseDown={stopMobileResultControlEvent}
              onClick={stopMobileResultControlEvent}
              onTouchStart={stopMobileResultControlEvent}
              onTouchEnd={stopMobileResultControlEvent}
            >
              {/* 模式切换胶囊 */}
              <div className="kk-result-view-mode-group flex text-[11px] font-medium text-[var(--text-primary)]">
                {(['standard', 'detail'] as ResultViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onViewModeChange(mode);
                    }}
                    title={mode === 'detail' ? pick('详细视图', 'Detail view') : pick('标准视图', 'Standard view')}
                    aria-pressed={viewMode === mode}
                    className={`kk-result-view-mode-button ${
                      viewMode === mode
                        ? 'kk-result-view-mode-button--active'
                        : ''
                    }`}
                  >
                    {mode === 'detail' ? <Rows size={13} aria-hidden="true" /> : <LayoutGrid size={13} aria-hidden="true" />}
                    <span>{mode === 'detail' ? pick('详细', 'Detail') : pick('标准', 'Standard')}</span>
                  </button>
                ))}
              </div>

              {/* 快速一键滚动回底部的圆形毛玻璃按钮，高度与切换胶囊完全对齐，具备弹性缩放交互动效 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }}
                title={pick('回到底部', 'Scroll to Bottom')}
                aria-label={pick('回到底部', 'Scroll to Bottom')}
                className="kk-result-view-scroll-control flex items-center justify-center text-[var(--text-primary)]"
              >
                <ChevronsDown size={15} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default MobileResultFeed;
