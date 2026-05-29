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

import type { GeneratedImage, MobileResultEntry, RedrawRequest } from '../../types';
import { useLocale } from '../../context/LocaleContext';
import { RedrawWorkspace } from '../image/RedrawWorkspace';

interface MobileResultDetailScreenProps {
  entry: MobileResultEntry;
  onClose: () => void;
  onPreviewOriginal: (imageId: string) => void;
  onUseAsSource: (imageId: string) => void;
  onPartialRedraw: (entry: MobileResultEntry, request: RedrawRequest) => void;
  onDownload: (entry: MobileResultEntry) => void;
  onDelete: (imageId: string) => void;
  onEditEcommerceTask: (entry: MobileResultEntry) => void;
  onConfirmEcommerceDesktop: (entry: MobileResultEntry) => void;
  onGenerateEcommerceMobile: (entry: MobileResultEntry) => void;
  onToggleEcommerceSelected: (entry: MobileResultEntry, selected: boolean) => void;
  onPrevious?: () => void;
  onNext?: () => void;
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
        ? 'border-[var(--mobile-clay-active-border)] bg-[var(--mobile-clay-active-bg)] text-[var(--text-primary)]'
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
  pick: <T>(zh: T, en: T) => T,
): string => {
  const normalized = assetRole.label?.trim();
  if (normalized) {
    return normalized;
  }

  switch (assetRole.role) {
    case 'product':
      return pick('产品图', 'Product Image');
    case 'reference':
      return pick('参考图', 'Reference Image');
    case 'extra-reference':
      return pick('额外参考图', 'Extra Reference');
    case 'series-template':
      return pick('系列模板', 'Series Template');
    case 'accessory':
      return pick('配件图', 'Accessory Image');
    default:
      return pick('素材', 'Asset');
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
}) => {
  const [currentGroupImageIndex, setCurrentGroupImageIndex] = React.useState(0);
  const [showRedrawWorkspace, setShowRedrawWorkspace] = React.useState(false);

  React.useEffect(() => {
    setCurrentGroupImageIndex(0);
  }, [entry.id]);

  const hasGroup = entry.groupEntries && entry.groupEntries.length > 0;
  const currentActiveEntry = hasGroup && entry.groupEntries![currentGroupImageIndex]
    ? entry.groupEntries![currentGroupImageIndex]
    : entry;
  const redrawImageUrl = currentActiveEntry.primaryImageSource || currentActiveEntry.displaySrc;
  const redrawImage: GeneratedImage | null = redrawImageUrl
    ? {
        id: currentActiveEntry.imageId,
        storageId: currentActiveEntry.imageId,
        url: redrawImageUrl,
        originalUrl: currentActiveEntry.primaryImageSource || undefined,
        prompt: currentActiveEntry.fullPrompt,
        aspectRatio: currentActiveEntry.aspectRatio as GeneratedImage['aspectRatio'],
        imageSize: currentActiveEntry.imageSize as GeneratedImage['imageSize'],
        timestamp: currentActiveEntry.timestamp,
        model: currentActiveEntry.modelId || currentActiveEntry.modelLabel,
        modelLabel: currentActiveEntry.modelLabel,
        canvasId: 'mobile',
        parentPromptId: currentActiveEntry.parentPromptId || '',
        position: { x: 0, y: 0 },
        generationTime: currentActiveEntry.generationTime,
      }
    : null;

  const handlePrevAction = () => {
    if (currentGroupImageIndex > 0) {
      setCurrentGroupImageIndex((prev) => prev - 1);
    } else if (onPrevious) {
      onPrevious();
    }
  };

  const handleNextAction = () => {
    if (hasGroup && entry.groupEntries && currentGroupImageIndex < entry.groupEntries.length - 1) {
      setCurrentGroupImageIndex((prev) => prev + 1);
    } else if (onNext) {
      onNext();
    }
  };

  const canGoPrevious = currentGroupImageIndex > 0 || Boolean(onPrevious);
  const canGoNext = (hasGroup && entry.groupEntries && currentGroupImageIndex < entry.groupEntries.length - 1) || Boolean(onNext);

  // 🚀 [移动端专属] 手势检测坐标 Refs
  const touchStartX = React.useRef(0);
  const touchStartY = React.useRef(0);
  const touchEndX = React.useRef(0);
  const touchEndY = React.useRef(0);

  // 记录开始触摸坐标
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  // 记录滑动坐标变更
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  // 触摸结束时进行手势逻辑判定
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

      // 正常滑屏切换图片
      if (diffX > 0) {
        handleNextAction();
      } else {
        handlePrevAction();
      }
    }
  };

  const { pick } = useLocale();
  const promptSummary = normalizeText(currentActiveEntry.promptSummary, pick('未命名结果', 'Unnamed Result'));
  const fullPrompt = normalizeText(currentActiveEntry.fullPrompt, promptSummary);
  const ecommerceContinuation = currentActiveEntry.ecommerceContinuation;
  const metadataItems = [
    currentActiveEntry.displayLabel ? { label: pick('任务', 'Task'), value: currentActiveEntry.displayLabel } : null,
    ecommerceContinuation?.outputTypeLabel &&
    ecommerceContinuation.outputTypeLabel !== currentActiveEntry.displayLabel
      ? { label: pick('模块', 'Module'), value: ecommerceContinuation.outputTypeLabel }
      : null,
    ecommerceContinuation?.declaredSizeText
      ? { label: pick('需求尺寸', 'Required Size'), value: ecommerceContinuation.declaredSizeText }
      : null,
    { label: '比例', value: String(currentActiveEntry.aspectRatio) },
    { label: '尺寸', value: String(currentActiveEntry.imageSize) },
    { label: '素材', value: currentActiveEntry.hasOriginal ? '含原图' : '仅结果图' },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const previewLabel = currentActiveEntry.hasOriginal ? pick('原图', 'Source Image') : pick('无原图', 'No Source');
  const ecommerceRequirementText = normalizeText(ecommerceContinuation?.taskPrompt, fullPrompt);
  const frameworkStatus = ecommerceContinuation?.frameworkStatus;

  return (
    <>
    <section
      data-testid="mobile-result-detail-screen"
      className="fixed inset-0 z-[990] flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]"
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)]">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            {pick('结果详情', 'Result Details')} {hasGroup ? `(${currentGroupImageIndex + 1}/${entry.groupEntries!.length})` : ''}
          </div>
          <div className="mt-1 truncate text-base font-semibold leading-6">{promptSummary}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
            <span>{formatTimestamp(currentActiveEntry.timestamp)}</span>
            <span className="text-[var(--text-tertiary)]">路</span>
            <span className="truncate">{currentActiveEntry.modelLabel}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handlePrevAction}
            className={iconButtonClass}
            disabled={!canGoPrevious}
            aria-label={pick('查看上一张结果', 'View Previous Result')}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={handleNextAction}
            className={iconButtonClass}
            disabled={!canGoNext}
            aria-label={pick('查看下一张结果', 'View Next Result')}
          >
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className={iconButtonClass}
            aria-label={pick('关闭结果详情', 'Close Details')}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* 绑定全屏滑动手势的滚动主体容器 */}
      <div
        className="relative flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+145px)]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative overflow-hidden rounded-[12px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]">
          {currentActiveEntry.displaySrc ? (
            <img src={currentActiveEntry.displaySrc} alt={promptSummary} className="h-auto w-full object-cover" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center text-[var(--text-secondary)]">
              暂无预览
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-12 text-white">
            <div className="line-clamp-2 text-lg font-semibold leading-7">{promptSummary}</div>
          </div>
        </div>

        {/* 简体中文注释：多张图卡组图片列表卡片。只有在卡组条目数大于 1 时才进行条件渲染，配合阻尼震动微动效与高亮光环。 */}
        {hasGroup && entry.groupEntries && entry.groupEntries.length > 1 && (
          <div className="mt-3 flex flex-col gap-2 rounded-[12px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/85 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              卡组图片 ({entry.groupEntries.length} 张图)
            </div>
            <div className="mt-1 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {entry.groupEntries.map((item, index) => {
                const isSelected = index === currentGroupImageIndex;
                return (
                  <button
                    key={item.imageId}
                    type="button"
                    onClick={() => setCurrentGroupImageIndex(index)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border-2 p-0 transition-all duration-200 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-inset ring-indigo-500/30 opacity-100'
                        : 'border-[var(--mobile-clay-border)] opacity-60 hover:opacity-90'
                    }`}
                  >
                    {item.displaySrc ? (
                      <img
                        src={item.displaySrc}
                        alt={`卡组图 ${index + 1}`}
                        className="block h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--mobile-clay-muted-surface-bg)] text-xs text-[var(--text-secondary)]">
                        无预览
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-bold text-white leading-none">
                      {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {metadataItems.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="shrink-0 rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/75 px-3 py-1.5 text-xs text-[var(--text-secondary)]"
            >
              {item.label}{pick('：', ': ')}<span className="font-medium text-[var(--text-primary)]">{item.value}</span>
            </div>
          ))}
        </div>

        {ecommerceContinuation ? (
          <div
            data-testid="mobile-ecommerce-continuation-panel"
            className="mt-3 rounded-[10px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/85 p-3.5"
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
                  {ecommerceContinuation.sourceSheet} {pick('路', 'Lane')} {ecommerceContinuation.outputTypeLabel}
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
              <div className="mt-3 rounded-[8px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/45 p-3">
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

            <div className="mt-3 rounded-[8px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/45 p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                当前需求
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">
                {ecommerceRequirementText}
              </div>
            </div>

            <div className="mt-3 rounded-[8px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]/45 p-3">
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
                      {resolveAssetRoleLabel(assetRole, pick)}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  产品图 / 参考图角色将在识别后显示在这里。
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-[10px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/85 p-3.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{pick('提示词', 'Prompt')}</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{fullPrompt}</div>
        </div>

        <div className="mt-3 rounded-[10px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/85 p-3.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            {pick('参考图', 'Reference Images')} ({currentActiveEntry.referenceImages.length})
          </div>
          {currentActiveEntry.referenceImages.length > 0 ? (
            <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
              {currentActiveEntry.referenceImages.map((referenceImage) => {
                const src = resolveReferenceImageSource(referenceImage);
                return (
                  <div
                    key={referenceImage.id}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)]"
                  >
                    {src ? (
                      <img src={src} alt="Reference" className="h-full w-full object-cover" />
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
            <div className="mt-2.5 text-sm text-[var(--text-secondary)]">{pick('本次生成没有参考图。', 'No reference images for this generation.')}</div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-bottom-bar-bg)] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        {/* 第一排平铺按钮 */}
        <div className="grid grid-cols-3 gap-2">
          <ActionButton
            label={pick('继续创作', 'Continue')}
            icon={<Sparkles size={15} />}
            tone="primary"
            onClick={() => {
              onUseAsSource(currentActiveEntry.imageId);
              onClose();
            }}
          />
          <ActionButton
            label={pick('重绘', 'Redraw')}
            icon={<Wand2 size={15} />}
            tone="primary"
            disabled={!redrawImage || !redrawImageUrl}
            onClick={() => {
              setShowRedrawWorkspace(true);
            }}
          />
          <ActionButton
            label={pick('下载', 'Download')}
            icon={<Download size={15} />}
            onClick={() => onDownload(currentActiveEntry)}
          />
        </div>

        {/* 第二排平铺按钮 */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ActionButton
            label={previewLabel}
            icon={<Eye size={15} />}
            disabled={!currentActiveEntry.hasOriginal}
            onClick={() => onPreviewOriginal(currentActiveEntry.imageId)}
          />
          <ActionButton
            label={pick('删除', 'Delete')}
            icon={<Trash2 size={15} />}
            tone="danger"
            onClick={() => onDelete(currentActiveEntry.imageId)}
          />
        </div>

        {/* 电商专属动作排在底层 */}
        {ecommerceContinuation ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ecommerceContinuation.canToggleSelection ? (
              <ActionButton
                label={ecommerceContinuation.selectedForGeneration ? pick('取消确认生成', 'Cancel Confirm') : pick('确认生成', 'Confirm Generation')}
                icon={<CheckCircle2 size={15} />}
                tone={ecommerceContinuation.selectedForGeneration ? 'default' : 'primary'}
                onClick={() =>
                  onToggleEcommerceSelected(currentActiveEntry, !ecommerceContinuation.selectedForGeneration)
                }
              />
            ) : null}
            {ecommerceContinuation.canEditTask ? (
              <ActionButton
                label={pick('编辑任务', 'Edit Task')}
                icon={<FileText size={15} />}
                tone="primary"
                onClick={() => onEditEcommerceTask(currentActiveEntry)}
              />
            ) : null}
            {ecommerceContinuation.kind === 'a-plus-module' ? (
              <>
                <ActionButton
                  label={pick('确认桌面版', 'Confirm Desktop')}
                  icon={<CheckCircle2 size={15} />}
                  disabled={!ecommerceContinuation.canConfirmDesktop}
                  onClick={() => onConfirmEcommerceDesktop(currentActiveEntry)}
                />
                <ActionButton
                  label={pick('生成手机版', 'Generate Mobile')}
                  icon={<Sparkles size={15} />}
                  disabled={!ecommerceContinuation.canGenerateMobile}
                  onClick={() => onGenerateEcommerceMobile(currentActiveEntry)}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
    {showRedrawWorkspace && redrawImage && redrawImageUrl ? (
      <RedrawWorkspace
        image={redrawImage}
        imageUrl={redrawImageUrl}
        isMobile
        defaultModel={currentActiveEntry.modelId || currentActiveEntry.modelLabel}
        onCancel={() => setShowRedrawWorkspace(false)}
        onSubmit={(request) => {
          setShowRedrawWorkspace(false);
          onPartialRedraw(currentActiveEntry, request);
          onClose();
        }}
      />
    ) : null}
    </>
  );
};

export default MobileResultDetailScreen;
