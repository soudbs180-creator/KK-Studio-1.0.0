import React from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';

import type { MobileResultEntry, PartialRedrawRequest } from '../../types';
import { useLocale } from '../../context/LocaleContext';
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

interface MobileResultDetailScreenProps {
  entry: MobileResultEntry;
  onClose: () => void;
  onPreviewOriginal: (imageId: string) => void;
  onUseAsSource: (imageId: string) => void;
  onPartialRedraw: (entry: MobileResultEntry, request: PartialRedrawRequest) => void;
  onDownload: (entry: MobileResultEntry) => void;
  onDelete: (imageId: string) => void;
  onEditEcommerceTask: (entry: MobileResultEntry) => void;
  onConfirmEcommerceDesktop: (entry: MobileResultEntry) => void;
  onGenerateEcommerceMobile: (entry: MobileResultEntry) => void;
  onToggleEcommerceSelected: (entry: MobileResultEntry, selected: boolean) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onGenerateFollowUp?: (prompt: string, parentImageId: string) => void;
}

const iconButtonClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/90 disabled:opacity-40';

const resolveReferenceImageSource = (
  referenceImage: MobileResultEntry['referenceImages'][number],
): string | null => {
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

const normalizeText = (value: string | null | undefined, fallback: string): string => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const noopPartialRedrawRequest = (entry: MobileResultEntry): PartialRedrawRequest => ({
  model: entry.modelId || entry.modelLabel,
  aspectRatio: entry.aspectRatio as PartialRedrawRequest['aspectRatio'],
  prompt: entry.fullPrompt,
  selectionRect: { x: 0, y: 0, width: 1, height: 1 },
  generationRect: { x: 0, y: 0, width: 1, height: 1 },
  sourceImageDimensions: { width: 1, height: 1 },
  referenceImages: entry.referenceImages,
});

const ActionButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, icon, tone = 'default', disabled = false, onClick }) => {
  const toneClass =
    tone === 'danger'
      ? 'border-red-400/30 bg-red-500/10 text-red-300'
      : tone === 'primary'
        ? 'border-white/10 bg-white/6 text-[var(--text-primary)]'
        : 'border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] text-[var(--text-primary)]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] border px-3 text-[13px] font-medium transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
};

const stageToneClassMap: Record<
  NonNullable<MobileResultEntry['ecommerceContinuation']>['stageTone'],
  string
> = {
  amber: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  blue: 'border-[var(--mobile-clay-stage-info-border)] bg-[var(--mobile-clay-stage-info-bg)] text-[var(--mobile-clay-stage-info-text)]',
  emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  rose: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
};

const resolveAssetRoleLabel = (
  assetRole: NonNullable<MobileResultEntry['ecommerceContinuation']>['assetRoles'][number],
): string => {
  const normalized = assetRole.label?.trim();
  if (normalized) {
    return normalized;
  }

  switch (assetRole.role) {
    case 'product':
      return '产品图';
    case 'reference':
      return '参考图';
    case 'extra-reference':
      return '额外参考图';
    case 'series-template':
      return '系列模板';
    case 'accessory':
      return '配件图';
    default:
      return '素材';
  }
};

const MobileResultDetailScreen: React.FC<MobileResultDetailScreenProps> = ({
  entry,
  onClose,
  onPreviewOriginal,
  onUseAsSource,
  onPartialRedraw,
  onDownload,
  onDelete,
  onEditEcommerceTask,
  onConfirmEcommerceDesktop,
  onGenerateEcommerceMobile,
  onToggleEcommerceSelected,
  onPrevious,
  onNext,
  onGenerateFollowUp,
}) => {
  const [showFollowUpInput, setShowFollowUpInput] = React.useState(false);
  const [followUpPrompt, setFollowUpPrompt] = React.useState('');
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const generatingNode = entry.groupEntries?.find(item => item.isGenerating);
    if (!generatingNode) return;

    setElapsed(Math.max(0, Math.floor((Date.now() - generatingNode.timestamp) / 1000)));

    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - generatingNode.timestamp) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [entry.groupEntries]);

  const handleSendFollowUp = () => {
    if (!followUpPrompt.trim()) return;
    onGenerateFollowUp?.(followUpPrompt.trim(), entry.imageId);
    setFollowUpPrompt('');
    setShowFollowUpInput(false);
  };
  const touchStartX = React.useRef(0);
  const touchStartY = React.useRef(0);
  const touchEndX = React.useRef(0);
  const touchEndY = React.useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;
    const thresholdX = 55;

    // 判定为水平滑动的核心：X轴位移大于阈值，且X轴位移是Y轴位移的 1.5 倍以上
    if (Math.abs(diffX) > thresholdX && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      // 🚀 手机端边缘手势返回适配：
      // 如果是从屏幕最左侧（边缘 45px 内）起手向右滑动（diffX < 0，即右滑），直接关闭详情页
      if (touchStartX.current < 45 && diffX < 0) {
        onClose();
        return;
      }

      // 正常切图
      if (diffX > 0) {
        if (onNext) onNext();
      } else {
        if (onPrevious) onPrevious();
      }
    }
  };
  const { pick } = useLocale();
  const promptSummary = normalizeText(entry.promptSummary, '未命名结果');
  const fullPrompt = normalizeText(entry.fullPrompt, promptSummary);
  const ecommerceContinuation = entry.ecommerceContinuation;
  const metadataItems = [
    entry.displayLabel ? { label: '任务', value: entry.displayLabel } : null,
    ecommerceContinuation?.outputTypeLabel &&
    ecommerceContinuation.outputTypeLabel !== entry.displayLabel
      ? { label: '模块', value: ecommerceContinuation.outputTypeLabel }
      : null,
    ecommerceContinuation?.declaredSizeText
      ? { label: '需求尺寸', value: ecommerceContinuation.declaredSizeText }
      : null,
    { label: '费用', value: getCostDisplay(entry) },
    entry.generationTime ? { label: '耗时', value: `${(entry.generationTime / 1000).toFixed(1)}s` } : null,
    { label: '比例', value: String(entry.aspectRatio) },
    { label: '尺寸', value: String(entry.imageSize) },
    { label: '素材', value: entry.hasOriginal ? '含原图' : '仅结果图' },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const previewLabel = entry.hasOriginal ? '原图' : '无原图';
  const ecommerceRequirementText = normalizeText(ecommerceContinuation?.taskPrompt, fullPrompt);
  const frameworkStatus = ecommerceContinuation?.frameworkStatus;
  const [showSecondaryActions, setShowSecondaryActions] = React.useState(false);

  return (
    <section
      data-testid="mobile-result-detail-screen"
      className="fixed inset-0 z-[990] flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]"
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)]">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            结果详情
          </div>
          <div className="mt-1 truncate text-base font-semibold leading-6">{promptSummary}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
            <span>{formatTimestamp(entry.timestamp)}</span>
            <span className="text-[var(--text-tertiary)]">路</span>
            <span className="truncate">{entry.modelLabel}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            className={iconButtonClass}
            disabled={!onPrevious}
            aria-label="查看上一张结果"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={onNext}
            className={iconButtonClass}
            disabled={!onNext}
            aria-label="查看下一张结果"
          >
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className={iconButtonClass}
            aria-label="关闭结果详情"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div 
        className="relative flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] overscroll-contain"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 🚀 组图垂直平铺展示（时间正序：最早在顶，最新在底） */}
        <div className="flex flex-col gap-6">
          {(entry.groupEntries && entry.groupEntries.length > 0 ? entry.groupEntries : [entry]).map((item, idx) => {
            const itemPromptSummary = normalizeText(item.promptSummary, '未命名结果');
            const itemFullPrompt = normalizeText(item.fullPrompt, itemPromptSummary);
            const itemIsFailed = Boolean(item.error);
            const itemMetadataItems = [
              item.displayLabel ? { label: '任务', value: item.displayLabel } : null,
              { label: '费用', value: getCostDisplay(item) },
              item.generationTime ? { label: '耗时', value: `${(item.generationTime / 1000).toFixed(1)}s` } : null,
              { label: '比例', value: String(item.aspectRatio) },
              { label: '尺寸', value: String(item.imageSize) },
            ].filter(Boolean) as Array<{ label: string; value: string }>;

            return (
              <div key={item.id} className="relative flex flex-col gap-2.5 border-b border-white/5 pb-5 last:border-b-0 last:pb-0">
                {/* 标号与时间戳 */}
                <div className="flex items-center justify-between px-1 text-xs select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white/10 text-[9.5px] font-bold font-mono text-[var(--text-secondary)]">
                      #{idx + 1}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <span className="text-[9.5px] text-[var(--text-tertiary)] uppercase font-mono tracking-wider font-semibold">
                    {item.modelLabel}
                  </span>
                </div>

                {/* 图片展示卡片 */}
                <div 
                  className="relative overflow-hidden rounded-[24px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] max-h-[380px] flex items-center justify-center cursor-pointer select-none"
                  onClick={() => item.hasOriginal && onPreviewOriginal(item.imageId)}
                >
                  {item.isGenerating ? (
                    /* 生成中占位卡片 */
                    <div className="relative w-full min-h-[190px] aspect-square h-[300px] flex flex-col items-center justify-center bg-[var(--mobile-clay-muted-surface-bg)]/50 rounded-[24px] overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer-sweep" />
                      <div className="relative flex flex-col items-center gap-2 select-none">
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
                          <svg className="h-4.5 w-4.5 animate-spin text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        </div>
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)] animate-pulse">正在生成关联图...</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] font-mono">已耗时 {elapsed}s</span>
                      </div>
                    </div>
                  ) : item.displaySrc ? (
                    <img src={item.displaySrc} alt={itemPromptSummary} className="max-h-[380px] w-full object-contain block pointer-events-none rounded-[24px]" />
                  ) : (
                    <div className="flex aspect-[3/4] h-[320px] items-center justify-center text-[var(--text-secondary)]">
                      暂无预览
                    </div>
                  )}

                  {!item.isGenerating && itemIsFailed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-3 text-center rounded-[24px]">
                      <svg className="w-6 h-6 text-red-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <span className="text-[11px] font-medium text-white/95 leading-4">{item.error || '生成失败'}</span>
                    </div>
                  )}
                </div>

                {/* 子卡片元数据胶囊 */}
                {!item.isGenerating && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 select-none scrollbar-none">
                    {itemMetadataItems.map((meta) => (
                      <div key={meta.label} className="shrink-0 rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/75 px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">
                        {meta.label}：<span className="font-semibold text-[var(--text-primary)]">{meta.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 子卡片独立提示词 */}
                {!item.isGenerating && (
                  <div className="rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/55 p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-tertiary)] block mb-1 uppercase tracking-wider text-[9px]">提示词:</span>
                    {itemFullPrompt}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {ecommerceContinuation ? (
          <div
            data-testid="mobile-ecommerce-continuation-panel"
            className="mt-3 rounded-[22px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/85 p-3.5"
          >
            <div data-testid="mobile-ecommerce-stage-card" className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  电商续作
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {ecommerceContinuation.displayLabel}
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {ecommerceContinuation.sourceSheet} 路 {ecommerceContinuation.outputTypeLabel}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${stageToneClassMap[ecommerceContinuation.stageTone]}`}
              >
                {ecommerceContinuation.stageLabel}
              </span>
            </div>

            <div className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {ecommerceContinuation.stageDescription}
            </div>

            {frameworkStatus ? (
              <div className="mt-3 rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                      {pick('框架队列', 'Framework Queue')}
                    </div>
                    <div className="mt-1 truncate text-sm font-medium text-[var(--text-primary)]">
                      {ecommerceContinuation.frameworkLabel || pick('框架', 'Framework')}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
                      frameworkStatus.paused
                        ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                        : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                    }`}
                  >
                    {frameworkStatus.paused ? pick('已暂停', 'Paused') : pick('运行中', 'Running')}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span>{pick('排队', 'Queued')} {frameworkStatus.queued}</span>
                  <span>{pick('运行', 'Running')} {frameworkStatus.running}</span>
                  <span>{pick('完成', 'Done')} {frameworkStatus.completed}</span>
                  <span>{pick('分发', 'Dispatch')} {frameworkStatus.dispatching}</span>
                  <span>{pick('失败', 'Failed')} {frameworkStatus.failed}</span>
                  <span>{pick('总数', 'Total')} {frameworkStatus.total}</span>
                </div>
              </div>
            ) : null}

            {ecommerceContinuation.reviewWarnings.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {ecommerceContinuation.reviewWarnings.map((warning) => (
                  <span
                    key={warning}
                    className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200"
                  >
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-3 rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/45 p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                当前需求
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">
                {ecommerceRequirementText}
              </div>
            </div>

            <div className="mt-3 rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/45 p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                素材角色
              </div>
              {ecommerceContinuation.assetRoles.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ecommerceContinuation.assetRoles.map((assetRole) => (
                    <span
                      key={`${assetRole.assetId}-${assetRole.role}`}
                      className="rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/85 px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                    >
                      {resolveAssetRoleLabel(assetRole)}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  产品图 / 参考图角色将在识别后显示在这里。
                </div>
              )}
            </div>

            <div className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">
              编辑、确认生成和后续电商动作已收进底部更多菜单，避免详情首层按钮拥挤。
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-[22px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/85 p-3.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            参考图 ({entry.referenceImages.length})
          </div>
          {entry.referenceImages.length > 0 ? (
            <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
              {entry.referenceImages.map((referenceImage) => {
                const src = resolveReferenceImageSource(referenceImage);
                return (
                  <div
                    key={referenceImage.id}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-[16px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]"
                  >
                    {src ? (
                      <img src={src} alt="Reference" className="h-full w-full object-cover rounded-[16px]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[var(--text-secondary)]">
                        Ref
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2.5 text-sm text-[var(--text-secondary)]">本次生成没有参考图。</div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-bottom-bar-bg)] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        {showFollowUpInput && (
          <div className="mb-3 flex flex-col gap-2 rounded-[22px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/95 p-3.5 shadow-md">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">继续创作</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                placeholder="输入新提示词以修改生成..."
                className="flex-1 rounded-[16px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/80 px-3.5 py-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-amber-400/40"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendFollowUp();
                }}
              />
              <button
                type="button"
                onClick={handleSendFollowUp}
                disabled={!followUpPrompt.trim()}
                className="rounded-[16px] bg-amber-400/95 text-black px-4 py-2.5 text-xs font-bold transition active:scale-[0.985] disabled:opacity-40"
              >
                发送
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px] gap-2">
          <ActionButton
            label={showFollowUpInput ? "收起输入" : "继续创作"}
            icon={<Sparkles size={15} />}
            tone={showFollowUpInput ? "default" : "primary"}
            onClick={() => setShowFollowUpInput((prev) => !prev)}
          />
          <ActionButton
            label={previewLabel}
            icon={<Eye size={15} />}
            disabled={!entry.hasOriginal}
            onClick={() => onPreviewOriginal(entry.imageId)}
          />
          <button
            type="button"
            onClick={() => setShowSecondaryActions((next) => !next)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[16px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] text-[var(--text-primary)] transition active:scale-[0.99]"
            aria-label="更多操作"
            aria-expanded={showSecondaryActions}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {showSecondaryActions ? (
          <div data-testid="mobile-result-secondary-actions" className="mt-2 grid grid-cols-2 gap-2">
            <ActionButton
              label="局部重绘"
              icon={<Wand2 size={15} />}
              tone="primary"
              onClick={() => onPartialRedraw(entry, noopPartialRedrawRequest(entry))}
            />
            <ActionButton
              label="下载"
              icon={<Download size={15} />}
              onClick={() => onDownload(entry)}
            />
            {ecommerceContinuation?.canToggleSelection ? (
              <ActionButton
                label={ecommerceContinuation.selectedForGeneration ? '取消确认生成' : '确认生成'}
                icon={<CheckCircle2 size={15} />}
                tone={ecommerceContinuation.selectedForGeneration ? 'default' : 'primary'}
                onClick={() =>
                  onToggleEcommerceSelected(entry, !ecommerceContinuation.selectedForGeneration)
                }
              />
            ) : null}
            {ecommerceContinuation?.canEditTask ? (
              <ActionButton
                label="编辑任务"
                icon={<FileText size={15} />}
                tone="primary"
                onClick={() => onEditEcommerceTask(entry)}
              />
            ) : null}
            {ecommerceContinuation?.kind === 'a-plus-module' ? (
              <>
                <ActionButton
                  label="确认桌面版"
                  icon={<CheckCircle2 size={15} />}
                  disabled={!ecommerceContinuation.canConfirmDesktop}
                  onClick={() => onConfirmEcommerceDesktop(entry)}
                />
                <ActionButton
                  label="生成手机版"
                  icon={<Sparkles size={15} />}
                  disabled={!ecommerceContinuation.canGenerateMobile}
                  onClick={() => onGenerateEcommerceMobile(entry)}
                />
              </>
            ) : null}
            <ActionButton
              label="删除"
              icon={<Trash2 size={15} />}
              tone="danger"
              onClick={() => onDelete(entry.imageId)}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default MobileResultDetailScreen;
