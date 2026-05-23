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
}) => {
  const touchStartX = React.useRef(0);
  const touchEndX = React.useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    e.stopPropagation();
  };

  const handleTouchEnd = () => {
    const diffX = touchStartX.current - touchEndX.current;
    const threshold = 55;

    if (Math.abs(diffX) > threshold) {
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

      <div className="relative flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] overscroll-contain">
        <div 
          className="relative overflow-hidden rounded-[24px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] max-h-[380px] flex items-center justify-center cursor-pointer select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => entry.hasOriginal && onPreviewOriginal(entry.imageId)}
        >
          {entry.displaySrc ? (
            <img src={entry.displaySrc} alt={promptSummary} className="max-h-[380px] w-full object-contain block pointer-events-none" />
          ) : (
            <div className="flex aspect-[3/4] h-[320px] items-center justify-center text-[var(--text-secondary)]">
              暂无预览
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-12 text-white z-10">
            <div className="line-clamp-2 text-lg font-semibold leading-7">{promptSummary}</div>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {metadataItems.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="shrink-0 rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/75 px-3 py-1.5 text-xs text-[var(--text-secondary)]"
            >
              {item.label}：<span className="font-medium text-[var(--text-primary)]">{item.value}</span>
            </div>
          ))}
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
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">提示词</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{fullPrompt}</div>
        </div>

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
            <div className="mt-2.5 text-sm text-[var(--text-secondary)]">本次生成没有参考图。</div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-bottom-bar-bg)] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px] gap-2">
          <ActionButton
            label="继续创作"
            icon={<Sparkles size={15} />}
            tone="primary"
            onClick={() => onUseAsSource(entry.imageId)}
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
