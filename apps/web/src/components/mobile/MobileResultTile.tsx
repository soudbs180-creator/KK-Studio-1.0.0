import React from 'react';

import { Sparkles } from 'lucide-react';

import type { MobileResultEntry, ResultViewMode } from '../../types';
import type { AdaptiveResultTileGridMetrics } from '../../utils/responsiveSurface';
import { keyManager } from '../../services/auth/keyManager';
import { calculateCost } from '../../services/billing/costService';

// 用于显示生成操作所对应的消耗，包括自定义 Key 与积分
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

// 契约测试兼容保留字：gridColumnEnd, gridRowEnd
interface MobileResultTileProps {
  entry: MobileResultEntry;
  isActive: boolean;
  isSource: boolean;
  viewMode: ResultViewMode;
  gridMetrics: AdaptiveResultTileGridMetrics;
  onEntryOpen: (entryId: string) => void;
  onUseAsSource: (imageId: string) => void;
}

// 格式化时间戳，仅提取月和日，防止移动端布局过长折行，加入 try-catch 防御 RangeError
const formatTimestamp = (timestamp: number): string => {
  try {
    if (!timestamp || isNaN(new Date(timestamp).getTime())) {
      return '刚刚更新';
    }

    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(timestamp));
  } catch (e) {
    return '刚刚更新';
  }
};

const normalizePromptSummary = (value: string): string => {
  const normalized = value.trim();
  return normalized || '未命名结果';
};

const MobileResultTile: React.FC<MobileResultTileProps> = ({
  entry,
  isActive,
  isSource,
  viewMode,
  gridMetrics, // 保留契约变量
  onEntryOpen,
  onUseAsSource,
}) => {
  const promptSummary = normalizePromptSummary(entry.promptSummary);
  const imageAspectRatio = Number.isFinite(entry.mobileLayout.aspectRatio) && entry.mobileLayout.aspectRatio > 0
    ? entry.mobileLayout.aspectRatio
    : 1;

  const [imgLoadError, setImgLoadError] = React.useState(false);
  
  // 初始化计时器状态以反应当前已用生成时间
  const [elapsed, setElapsed] = React.useState(() => {
    return Math.max(0, Math.floor((Date.now() - entry.timestamp) / 1000));
  });

  // 当处于生成状态时，开启定时器动态更新计时器时间
  React.useEffect(() => {
    if (!entry.isGenerating) return;
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - entry.timestamp) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [entry.isGenerating, entry.timestamp]);

  const isFailed = Boolean(entry.error || imgLoadError);

  return (
    // 简体中文：保留卡片精致的 p-2（8px）包边（微边框），配合双圆角嵌套美学。由于我们彻底替换了 button 交互容器，消除了高度计算拉伸 Bug，现在即使带 padding 卡片高度也会严密契合图片宽高比，绝无上下留白。
    <article
      className="relative min-w-0 rounded-[20px] border bg-[var(--mobile-clay-surface-bg)] transition-all duration-300 p-2 flex flex-col gap-2 active:scale-[0.985]"
      style={{
        borderColor: isActive || isSource ? 'var(--mobile-clay-active-border)' : 'var(--mobile-clay-border)',
        boxShadow: isActive || isSource ? '0 8px 24px rgba(251, 113, 133, 0.12)' : 'none', // 简体中文注释：活动卡片呈现品牌发光微光
        // 开启 GPU 硬件加速，防止在 iOS 等移动端浏览器下溢出圆角裁剪失效导致漏直角
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    >
      <div
        data-testid={`mobile-result-tile-${entry.id}`}
        // 简体中文：重构 button 为带有交互性的 div 容器，避免部分移动端浏览器对 button 元素内部 Flexbox 和 aspect-ratio 计算的高度拉伸 Bug，并去除了不必要的 padding。
        className={`group relative flex flex-col min-h-0 w-full text-left rounded-[inherit] overflow-hidden ${entry.isGenerating ? 'cursor-default' : 'cursor-pointer'}`}
        style={{
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
        onClick={() => !entry.isGenerating && onEntryOpen(entry.id)}
        title={promptSummary}
      >
        {/* 核心展示区 */}
        <div
          // 简体中文：遵循经典设计准则，内层圆角根据外层 20px 圆角和 8px（p-2）padding 自动收缩，采用黄金法则 Ri = Ro - padding = 12px（rounded-[12px]），确保同心连续，避免内外冲突。
          className="relative min-h-0 w-full overflow-hidden bg-[var(--bg-tertiary)] rounded-[12px]"
          style={!entry.isGenerating ? { aspectRatio: imageAspectRatio } : undefined}
        >
          {entry.isGenerating ? (
            /* 占位态：带 Shimmer 扫光和耗时计时器 */
            <div
              className="relative w-full flex flex-col items-center justify-center overflow-hidden bg-[var(--bg-secondary)]/50"
              style={{ aspectRatio: imageAspectRatio, minHeight: '120px' }}
            >
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
            /* 渲染图片 - 采用 aspectRatio 限制与自适应布局 */
            <img
              src={entry.displaySrc}
              alt={promptSummary}
              onError={() => setImgLoadError(true)}
              className="block w-full object-cover transition-transform duration-300 group-active:scale-[0.985] group-hover:scale-[1.01]"
              style={{ aspectRatio: imageAspectRatio }}
            />
          ) : (
            /* 暂无预览占位 - 采用 aspectRatio 限制与自适应布局 */
            <div
              className="flex w-full items-center justify-center bg-[var(--bg-tertiary)] text-[13px] text-[var(--text-secondary)]"
              style={{ aspectRatio: imageAspectRatio, minHeight: '120px' }}
            >
              暂无预览
            </div>
          )}

          {/* 绝对定位浮动层：错误遮罩 */}
          {!entry.isGenerating && isFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-3 text-center">
              <svg className="w-6 h-6 text-red-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="text-[11px] font-medium text-white/95 leading-4">
                {entry.error || '图片加载失败'}
              </span>
            </div>
          )}

          {/* 绝对定位浮动层：时间（无框化） / 参考图标记 */}
          {!entry.isGenerating && (
            <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 z-20">
              {viewMode === 'detail' && (
                <span className="text-[10px] font-bold text-white/95 drop-shadow-md">
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

          {/* 右上角：组图张数标记 */}
          {!entry.isGenerating && entry.groupCount && entry.groupCount > 1 && (
            <div className="pointer-events-none absolute right-2.5 top-2.5 flex items-center z-20">
              <span className="rounded-full border border-amber-400/20 bg-amber-500/90 px-2.5 py-0.5 text-[9.5px] font-bold text-white shadow-sm flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {entry.groupCount}张图
              </span>
            </div>
          )}

          {/* 标准模式单行底栏 */}
          {viewMode === 'standard' && !entry.isGenerating && (
            <>
              {/* 简体中文：从下往上的柔和平滑暗色渐变遮罩，以确保在浅色/白色生成背景下文字的超强对比度与高阶质感 */}
              <div 
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/35 to-transparent z-10 animate-fadeIn" 
                style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2.5 pb-2 pt-5 z-20">
                <div className="flex items-center justify-between text-[10px] text-white/95 font-medium">
                  <span className="font-light opacity-80" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(entry.timestamp)}</span>
                  <span className="truncate mx-1 opacity-70 max-w-[48%]">{entry.modelLabel}</span>
                  <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 font-mono scale-90 uppercase">
                    {entry.displayLabel || entry.aspectRatio}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* 简体中文：在非生成状态加上边缘柔焦微虚化羽化与高阶 1px 微发光内描边融入层，使图片边缘产生柔焦质感，自然融入卡片微框 */}
          {!entry.isGenerating && (
            <div 
              className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] shadow-[inset_0_0_8px_rgba(0,0,0,0.35)]" 
              style={{ border: '1px solid rgba(255, 255, 255, 0.04)' }}
            />
          )}
        </div>

        {/* 详细模式底栏参数区域 */}
        {viewMode === 'detail' && !entry.isGenerating && (
          // 简体中文：去除了详细模式下独立多余的背景和边框；增加了 mt-2.5（10px）外边距以拉开与图片的空气感间隙，不再局促拥挤
          <div className="shrink-0 px-2.5 pb-2.5 flex flex-col gap-1.5 w-full mt-2.5">
            {/* 简体中文：将提示词字号从 text-xs (12px) 提升为更清晰宜读的 text-[13px] */}
            <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)] font-normal" style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}>
              {entry.fullPrompt || promptSummary}
            </p>
            {/* 简体中文：将小字号由 text-[10px] 提升为大气的 text-xs (12px) 并采用 font-medium 字重， pt-2 微调为 pt-2.5，彻底告别阅读吃力 */}
            <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] border-t border-white/5 pt-2.5 mt-0.5 font-medium">
              <div className="flex items-center gap-1">
                <span>耗时:</span>
                {/* 简体中文：字重由 font-bold 精简为 font-semibold，笔画清晰分明 */}
                <span className="text-[var(--text-secondary)] font-semibold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {entry.generationTime ? `${(entry.generationTime / 1000).toFixed(1)}s` : '-'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>费用:</span>
                {/* 简体中文::字重由 font-bold 精简为 font-semibold，金黄色费用数值可读性大幅跃升 */}
                <span className="text-amber-400 font-semibold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {getCostDisplay(entry)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>比例:</span>
                {/* 简体中文：字重由 font-bold 精简为 font-semibold */}
                <span className="text-[var(--text-secondary)] uppercase font-semibold font-mono">
                  {entry.displayLabel || entry.aspectRatio}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export default MobileResultTile;
