import React from 'react';

import type { MobileResultEntry, ResultViewMode } from '../../types';
import type { AdaptiveResultTileGridMetrics } from '../../utils/responsiveSurface';
import { keyManager } from '../../services/auth/keyManager';
import { calculateCost } from '../../services/billing/costService';

const getCostDisplay = (entry: MobileResultEntry) => {
  const isUserApi = entry.modelId ? keyManager.hasCustomKeyForModel(entry.modelId) : false;

  if (isUserApi) {
    try {
      const sizeStr = String(entry.imageSize || '1024x1024');
      const { cost } = calculateCost(
        entry.modelId || '',
        sizeStr as any,
        1, // 单张
        entry.fullPrompt?.length || 0,
        entry.referenceImages?.length || 0
      );
      return `$${cost.toFixed(4)}`;
    } catch (e) {
      return '$0.0000';
    }
  } else {
    return entry.creditCost ? `${entry.creditCost} 积分` : '0 积分';
  }
};

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

  const [imgLoadError, setImgLoadError] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(() => {
    return Math.max(0, Math.floor((Date.now() - entry.timestamp) / 1000));
  });

  React.useEffect(() => {
    if (!entry.isGenerating) return;
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - entry.timestamp) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [entry.isGenerating, entry.timestamp]);

  const isFailed = Boolean(entry.error || imgLoadError);

  return (
    <article
      className="relative min-w-0 overflow-hidden rounded-2xl border bg-[var(--mobile-clay-surface-bg)] transition-transform duration-200"
      style={{
        borderColor: isActive || isSource ? 'var(--mobile-clay-active-border)' : 'var(--mobile-clay-border)',
        boxShadow: isActive || isSource ? 'var(--mobile-clay-active-ring)' : 'var(--mobile-clay-shadow)',
      }}
    >
      <button
        type="button"
        disabled={entry.isGenerating}
        data-testid={`mobile-result-tile-${entry.id}`}
        className={`group relative flex flex-col h-full min-h-0 w-full text-left ${entry.isGenerating ? 'cursor-default' : 'cursor-pointer'}`}
        onClick={() => onEntryOpen(entry.id)}
        title={promptSummary}
      >
        {/* 核心展示区 */}
        <div
          className="relative flex-1 min-h-0 w-full overflow-hidden bg-[var(--bg-tertiary)]"
          style={!entry.isGenerating ? { aspectRatio: imageAspectRatio } : undefined}
        >
          {entry.isGenerating ? (
            /* 占位态：带 Shimmer 扫光和耗时计时器 */
            <div className="relative w-full h-full flex flex-col items-center justify-center min-h-[120px] overflow-hidden bg-[var(--bg-secondary)]/50">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer-sweep" />
              <div className="relative flex flex-col items-center gap-1.5 select-none">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
                  <svg className="h-4.5 w-4.5 animate-spin text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] animate-pulse">
                  生成中...
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                  已耗时 {elapsed}s
                </span>
              </div>
            </div>
          ) : entry.displaySrc ? (
            /* 渲染图片 - 去除 aspectRatio 限制以强制 w-full h-full object-cover 占满卡片 */
            <img
              src={entry.displaySrc}
              alt={promptSummary}
              onError={() => setImgLoadError(true)}
              className={`block h-full min-h-0 w-full object-cover transition-transform duration-300 group-active:scale-[0.985] group-hover:scale-[1.01] ${isFailed ? 'filter grayscale opacity-40' : ''}`}
            />
          ) : (
            /* 暂无预览占位 - 去除 fallback aspect 限制以支持铺满 */
            <div
              className="flex h-full min-h-0 w-full items-center justify-center bg-[var(--bg-tertiary)] text-[13px] text-[var(--text-secondary)]"
            >
              暂无预览
            </div>
          )}

          {/* 绝对定位浮动层：错误遮罩 */}
          {!entry.isGenerating && isFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[1px] p-3 text-center">
              <svg className="w-6 h-6 text-red-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="text-[11px] font-medium text-white/95 leading-4">
                {entry.error || '图片加载失败'}
              </span>
            </div>
          )}

          {/* 顶部暗色渐变过渡（为顶部信息标签提供对比度，防死黑） */}
          {!entry.isGenerating && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/60 via-black/20 to-transparent z-10" />
          )}

          {/* 绝对定位浮动层：时间 / 参考图标记 */}
          {!entry.isGenerating && (
            <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 z-20">
              {viewMode === 'detail' && (
                <span className="rounded-full border border-white/10 bg-black/25 backdrop-blur-md px-2 py-0.5 text-[9.5px] font-medium text-white/90">
                  {formatTimestamp(entry.timestamp)}
                </span>
              )}
              {isSource && (
                <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[9.5px] font-semibold text-black shadow-sm">
                  参考图
                </span>
              )}
            </div>
          )}

          {/* 右上角：组标记 */}
          {!entry.isGenerating && entry.groupCount && entry.groupCount > 1 && (
            <div className="pointer-events-none absolute right-2.5 top-2.5 flex items-center z-20">
              <span className="rounded-full border border-amber-400/20 bg-amber-500/90 backdrop-blur-md px-2.5 py-0.5 text-[9.5px] font-bold text-white shadow-sm flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {entry.groupCount}张图
              </span>
            </div>
          )}

          {/* 标准模式单行底栏 */}
          {viewMode === 'standard' && !entry.isGenerating && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2 pt-6">
              <div className="flex items-center justify-between text-[10px] text-white/90">
                <span className="font-light opacity-80">{formatTimestamp(entry.timestamp)}</span>
                <span className="truncate mx-1 opacity-70 max-w-[50%]">{entry.modelLabel}</span>
                <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 font-mono scale-90">
                  {entry.displayLabel || entry.aspectRatio}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 详细模式毛玻璃参数卡片区域 */}
        {viewMode === 'detail' && !entry.isGenerating && (
          <div className="shrink-0 p-3 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-t border-white/5 flex flex-col gap-2 w-full">
            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)] font-normal">
              {entry.fullPrompt || promptSummary}
            </p>
            <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] border-t border-white/5 pt-1.5 mt-0.5 font-medium">
              <div className="flex items-center gap-1">
                <span>耗时:</span>
                <span className="text-[var(--text-secondary)] font-mono">
                  {entry.generationTime ? `${(entry.generationTime / 1000).toFixed(1)}s` : '-'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>费用:</span>
                <span className="text-amber-400 font-semibold font-mono">
                  {getCostDisplay(entry)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>比例:</span>
                <span className="text-[var(--text-secondary)] uppercase font-mono">
                  {entry.displayLabel || entry.aspectRatio}
                </span>
              </div>
            </div>
          </div>
        )}
      </button>
    </article>
  );
};

export default MobileResultTile;
