import React from 'react';
import { AlertTriangle, CheckSquare, ChevronDown, ChevronUp, Square, Upload, X } from 'lucide-react';

import type {
  EcommerceEditableTaskState,
  EcommerceTaskAssetRoleBinding,
  ReferenceImage,
} from '../../types';
import type {
  EcommerceAnalysisAsset,
  EcommerceAnalysisResult,
} from '../../services/ecommerce/types.ts';
import { buildEcommerceUploadPreviewModel } from './ecommerceImportPreview.ts';
import EcommerceTaskEditorPanel, {
  type EcommerceTaskStateChangeHandler,
} from './EcommerceTaskEditorPanel';

type ManualReferenceBinding = {
  assetId: string;
  label: string;
  fileName: string;
  referenceImage: ReferenceImage;
  assetRole: EcommerceTaskAssetRoleBinding;
};

type ReviewItemDescriptor = {
  id: string;
  title: string;
  subtitle: string;
  sizeTier?: EcommerceEditableTaskState['sizeTier'];
  effectiveSizeTier?: EcommerceEditableTaskState['effectiveSizeTier'];
  promptDraft: string;
  taskState: EcommerceEditableTaskState | null;
  designRequirements: string;
  autoReferenceAssets: EcommerceAnalysisAsset[];
  manualReferenceBindings: ManualReferenceBinding[];
  warnings: string[];
  checked: boolean;
  section: '主图' | 'A+';
};

interface EcommerceAnalysisReviewPanelProps {
  analysis: EcommerceAnalysisResult;
  selection: Record<string, boolean>;
  taskStates?: Record<string, EcommerceEditableTaskState | undefined>;
  activeTaskState?: EcommerceEditableTaskState | null;
  globalProductFiles?: File[];
  globalExtraReferenceFiles?: File[];
  manualReferenceFilesByItem?: Record<string, ManualReferenceBinding[]>;
  onPickManualReferenceFiles?: (sourceKey: string, files: FileList | File[]) => void;
  onRemoveManualReferenceFile?: (sourceKey: string, index: number) => void;
  onToggleSelection: (id: string, selected: boolean) => void;
  onTaskStateChange?: EcommerceTaskStateChangeHandler;
  isConfirming?: boolean;
  onConfirm: () => void | Promise<void>;
}

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  borderColor: 'var(--border-light)',
};

const warningStyle: React.CSSProperties = {
  borderColor: 'rgba(245, 158, 11, 0.35)',
  background: 'rgba(245, 158, 11, 0.08)',
  color: 'var(--text-secondary)',
};

const cardStyle: React.CSSProperties = {
  borderColor: 'var(--border-light)',
  background: 'rgba(255, 255, 255, 0.02)',
};

const reviewViewportStyle: React.CSSProperties = {
  maxHeight: 'min(70vh, 720px)',
};

function useFilePreviewUrls(files: File[]): string[] {
  const [urls, setUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setUrls([]);
      return undefined;
    }

    const nextUrls = files.map((file) => URL.createObjectURL(file));
    setUrls(nextUrls);

    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  return urls;
}

function isAnalysisReferenceAsset(
  reference: EcommerceAnalysisAsset | ManualReferenceBinding,
): reference is EcommerceAnalysisAsset {
  return 'previewUrl' in reference;
}

function resolveTaskStateForKey(
  rowKey: string,
  taskStates: Record<string, EcommerceEditableTaskState | undefined>,
  activeTaskStateProp: EcommerceEditableTaskState | null,
): EcommerceEditableTaskState | null {
  const mappedTaskState = taskStates[rowKey];
  if (mappedTaskState) return mappedTaskState;
  if (!activeTaskStateProp) return null;
  if (activeTaskStateProp.sourceRowKey === rowKey || activeTaskStateProp.taskId === rowKey) {
    return activeTaskStateProp;
  }
  return null;
}

function resolveReferencePreviewSource(
  reference: EcommerceAnalysisAsset | ManualReferenceBinding,
): string | null {
  if (isAnalysisReferenceAsset(reference)) {
    return reference.previewUrl || null;
  }

  if (reference.referenceImage.url) {
    return reference.referenceImage.url;
  }

  if (!reference.referenceImage.data) {
    return null;
  }

  return `data:${reference.referenceImage.mimeType};base64,${reference.referenceImage.data}`;
}

const EcommerceAnalysisReviewPanel: React.FC<EcommerceAnalysisReviewPanelProps> = ({
  analysis,
  selection,
  taskStates = {},
  activeTaskState: activeTaskStateProp = null,
  globalProductFiles = [],
  globalExtraReferenceFiles = [],
  manualReferenceFilesByItem = {},
  onPickManualReferenceFiles,
  onRemoveManualReferenceFile,
  onToggleSelection,
  onTaskStateChange,
  isConfirming = false,
  onConfirm,
}) => {
  const manualReferenceInputRef = React.useRef<HTMLInputElement>(null);
  const [activeReviewItemKey, setActiveReviewItemKey] = React.useState<string | null>(null);
  const [expandedGalleryKeys, setExpandedGalleryKeys] = React.useState<Record<string, boolean>>({});
  const [manualReferenceUploadTarget, setManualReferenceUploadTarget] = React.useState<string | null>(null);
  const uploadPreviewModel = React.useMemo(() => buildEcommerceUploadPreviewModel({
    analyzedProductName: analysis.projectMeta.productName,
    productFiles: globalProductFiles,
    extraReferenceFiles: globalExtraReferenceFiles,
  }), [analysis.projectMeta.productName, globalExtraReferenceFiles, globalProductFiles]);
  const productPreviewUrls = useFilePreviewUrls(globalProductFiles);
  const extraPreviewUrls = useFilePreviewUrls(globalExtraReferenceFiles);

  const extractEcommerceManualReferenceBindings = React.useCallback((rowKey: string) => (
    manualReferenceFilesByItem[rowKey] || []
  ), [manualReferenceFilesByItem]);

  const mainReviewItems = React.useMemo<ReviewItemDescriptor[]>(() => (
    analysis.mainImageItems.map((item) => {
      const taskState = resolveTaskStateForKey(item.itemId, taskStates, activeTaskStateProp);
      return {
        id: item.itemId,
        title: `${item.sequence}. ${item.theme || item.type}`,
        subtitle: item.designRequirements,
        sizeTier: taskState?.sizeTier,
        effectiveSizeTier: taskState?.effectiveSizeTier,
        promptDraft: taskState?.resolvedPromptPreview || item.promptDraft,
        taskState,
        designRequirements: item.designRequirements,
        autoReferenceAssets: analysis.assets.referenceAssets.filter((asset) => item.referenceAssetIds.includes(asset.assetId)),
        manualReferenceBindings: extractEcommerceManualReferenceBindings(item.itemId),
        warnings: item.reviewWarnings,
        checked: selection[item.itemId] !== false,
        section: '主图',
      };
    })
  ), [activeTaskStateProp, analysis.assets.referenceAssets, analysis.mainImageItems, extractEcommerceManualReferenceBindings, selection, taskStates]);

  const aPlusReviewItems = React.useMemo<ReviewItemDescriptor[]>(() => (
    analysis.aPlusGroup.modules.map((item) => {
      const taskState = resolveTaskStateForKey(item.moduleId, taskStates, activeTaskStateProp);
      return {
        id: item.moduleId,
        title: item.moduleName,
        subtitle: item.declaredSizeText ? `尺寸 ${item.declaredSizeText} · ${item.designRequirements}` : item.designRequirements,
        sizeTier: taskState?.sizeTier || item.sizeTier,
        effectiveSizeTier: taskState?.effectiveSizeTier,
        promptDraft: taskState?.resolvedPromptPreview || item.promptDraft,
        taskState,
        designRequirements: item.designRequirements,
        autoReferenceAssets: analysis.assets.referenceAssets.filter((asset) => item.referenceAssetIds.includes(asset.assetId)),
        manualReferenceBindings: extractEcommerceManualReferenceBindings(item.moduleId),
        warnings: item.reviewWarnings,
        checked: selection[item.moduleId] !== false,
        section: 'A+',
      };
    })
  ), [activeTaskStateProp, analysis.aPlusGroup.modules, analysis.assets.referenceAssets, extractEcommerceManualReferenceBindings, selection, taskStates]);

  const allReviewItems = React.useMemo(
    () => [...mainReviewItems, ...aPlusReviewItems],
    [aPlusReviewItems, mainReviewItems],
  );

  React.useEffect(() => {
    if (allReviewItems.length === 0) {
      setActiveReviewItemKey(null);
      return;
    }

    const preferredKey = activeTaskStateProp?.sourceRowKey || activeReviewItemKey;
    const nextActiveItem = allReviewItems.find((item) => item.id === preferredKey) || allReviewItems[0];
    if (nextActiveItem.id !== activeReviewItemKey) {
      setActiveReviewItemKey(nextActiveItem.id);
    }
  }, [activeReviewItemKey, activeTaskStateProp?.sourceRowKey, allReviewItems]);

  const activeReviewItem = allReviewItems.find((item) => item.id === activeReviewItemKey) || allReviewItems[0] || null;
  const activeTaskState = activeReviewItem?.taskState || null;
  const configuredTaskCount = Object.values(taskStates).filter(Boolean).length;
  const activePromptPreview = activeReviewItem
    ? (activeTaskState?.promptOverride || activeTaskState?.resolvedPromptPreview || activeReviewItem.promptDraft || '暂无提示词')
    : '暂无提示词';

  const openManualReferencePicker = (sourceKey: string) => {
    setManualReferenceUploadTarget(sourceKey);
    manualReferenceInputRef.current?.click();
  };

  const renderReferenceGallery = (
    label: string,
    items: Array<EcommerceAnalysisAsset | ManualReferenceBinding>,
    itemKey: string,
    removable = false,
  ) => {
    const galleryStateKey = `${itemKey}:${label}`;
    const isGalleryExpanded = expandedGalleryKeys[galleryStateKey] === true;
    const referenceGalleryHeightClassName = isGalleryExpanded ? 'max-h-56' : 'max-h-28';

    return (
    <div className="rounded-xl border p-3" style={cardStyle}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-[var(--text-secondary)]">
          {label} ({items.length})
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <button
              type="button"
              data-testid="ecommerce-review-reference-toggle"
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
              style={cardStyle}
              onClick={() => setExpandedGalleryKeys((previous) => ({
                ...previous,
                [galleryStateKey]: !previous[galleryStateKey],
              }))}
            >
              {isGalleryExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {isGalleryExpanded ? '收起' : '展开'}
            </button>
          ) : null}
          {label === '参考图预览' && onPickManualReferenceFiles ? (
            <button
              type="button"
              data-testid="ecommerce-review-reference-upload"
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.24)',
                background: 'rgba(59, 130, 246, 0.10)',
                color: 'var(--text-primary)',
              }}
              onClick={() => openManualReferencePicker(itemKey)}
            >
              <Upload size={12} />
              手动补传
            </button>
          ) : null}
        </div>
      </div>

      <div
        data-testid="ecommerce-review-reference-gallery"
        className={`custom-scrollbar mt-3 grid ${referenceGalleryHeightClassName} min-w-0 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3`}
      >
        {items.length > 0 ? items.map((item, index) => {
          const src = resolveReferencePreviewSource(item);
          const itemLabel = isAnalysisReferenceAsset(item)
            ? item.label
            : item.label || item.fileName || `手动参考图${index + 1}`;

          return (
            <div
              key={`${itemKey}-${item.assetId}-${index}`}
              className="relative overflow-hidden rounded-xl border"
              style={cardStyle}
            >
              <div className="aspect-square bg-[var(--bg-secondary)]">
                {src ? (
                  <img src={src} alt={itemLabel} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">
                    无预览
                  </div>
                )}
              </div>
              <div className="border-t px-2 py-1.5 text-[10px] text-[var(--text-secondary)]" style={{ borderColor: 'var(--border-light)' }}>
                <div className="truncate">{itemLabel}</div>
              </div>
              {removable && onRemoveManualReferenceFile ? (
                <button
                  type="button"
                  data-testid="ecommerce-review-manual-reference-remove"
                  className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-black/70 text-white"
                  style={{ borderColor: 'rgba(255,255,255,0.18)' }}
                  onClick={() => onRemoveManualReferenceFile(itemKey, index)}
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
          );
        }) : (
          <div className="col-span-full rounded-xl border border-dashed px-3 py-6 text-center text-[11px] text-[var(--text-tertiary)]" style={cardStyle}>
            当前条目暂无{label === '手动补传图' ? '手动补传图' : '自动识别参考图'}
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderUploadGallery = (
    label: string,
    items: Array<{ id: string; displayLabel: string; fileName: string }>,
    urls: string[],
    startIndex: number,
    rolePrefix: string,
  ) => (
    <div className="rounded-xl border p-3" style={cardStyle}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-[var(--text-secondary)]">
          {label} ({items.length})
        </div>
      </div>

      <div className="custom-scrollbar mt-3 grid max-h-28 min-w-0 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {items.length > 0 ? items.map((item, index) => {
          const itemLabel = `图${startIndex + index + 1} · ${rolePrefix}${index + 1}`;
          return (
            <div
              key={`${label}-${item.id}`}
              className="relative overflow-hidden rounded-xl border"
              style={cardStyle}
            >
              <div className="aspect-square bg-[var(--bg-secondary)]">
                {urls[index] ? (
                  <img src={urls[index]} alt={itemLabel} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">
                    无预览
                  </div>
                )}
              </div>
              <div className="border-t px-2 py-1.5 text-[10px] text-[var(--text-secondary)]" style={{ borderColor: 'var(--border-light)' }}>
                <div className="truncate">{itemLabel}</div>
                <div className="truncate text-[9px] text-[var(--text-tertiary)]">{item.displayLabel || item.fileName}</div>
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full rounded-xl border border-dashed px-3 py-6 text-center text-[11px] text-[var(--text-tertiary)]" style={cardStyle}>
            当前暂无{label}
          </div>
        )}
      </div>
    </div>
  );

  const renderActiveDetail = (reviewItem: ReviewItemDescriptor, compact = false) => (
    <div
      data-testid="ecommerce-review-active-detail"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border p-3"
      style={cardStyle}
    >
      <div className={compact ? 'space-y-3' : 'min-h-0 flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1'}>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            {reviewItem.section === '主图' ? '主图条目详情' : 'A+ 条目详情'}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            {reviewItem.title}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {reviewItem.subtitle}
          </div>
          {reviewItem.section === 'A+' ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {reviewItem.sizeTier ? (
                <span className="rounded-full border px-2 py-1 text-[10px]" style={cardStyle}>
                  识别档位 {reviewItem.sizeTier}
                </span>
              ) : null}
              {reviewItem.effectiveSizeTier ? (
                <span className="rounded-full border px-2 py-1 text-[10px]" style={cardStyle}>
                  实际采用档位 {reviewItem.effectiveSizeTier}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border p-3" style={cardStyle}>
          <div className="text-[11px] font-medium text-[var(--text-secondary)]">提示词预览</div>
          <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]">
            {activePromptPreview}
          </div>
        </div>

        {reviewItem.warnings.length > 0 ? (
          <div className="rounded-xl border px-3 py-2 text-xs" style={warningStyle}>
            {reviewItem.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}

        {renderReferenceGallery('参考图预览', reviewItem.autoReferenceAssets, reviewItem.id)}
        {renderReferenceGallery('手动补传图', reviewItem.manualReferenceBindings, reviewItem.id, true)}
        {renderUploadGallery(
          '全局产品图',
          uploadPreviewModel.productItems,
          productPreviewUrls,
          reviewItem.autoReferenceAssets.length + reviewItem.manualReferenceBindings.length,
          '产品图',
        )}
        {renderUploadGallery(
          '全局补充参考图',
          uploadPreviewModel.extraReferenceItems,
          extraPreviewUrls,
          reviewItem.autoReferenceAssets.length + reviewItem.manualReferenceBindings.length + uploadPreviewModel.productItems.length,
          '补充参考图',
        )}

        {activeTaskState && onTaskStateChange ? (
          <EcommerceTaskEditorPanel
            taskState={activeTaskState}
            onTaskStateChange={(taskId, updater) => onTaskStateChange(activeTaskState.taskId === taskId ? taskId : activeTaskState.taskId, updater)}
            compact={compact}
            collapsible
            defaultExpanded={compact}
          />
        ) : null}
      </div>
    </div>
  );

  const renderReviewSection = (label: string, items: ReviewItemDescriptor[], accent: string) => (
    <section>
      <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{label}</div>
      <div className="space-y-2">
        {items.map((item) => {
          const taskState = item.taskState;
          const isTaskActive = activeReviewItem?.id === item.id;
          const shouldShowTaskEditor = Boolean(taskState && isTaskActive && onTaskStateChange);

          return (
            <div key={item.id} className="rounded-lg border border-transparent">
              <div
                className="flex items-start gap-2 rounded-lg border px-3 py-2"
                style={{
                  borderColor: isTaskActive ? accent : 'var(--border-light)',
                  background: isTaskActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                }}
              >
                <button
                  type="button"
                  className="mt-0.5 shrink-0"
                  onClick={() => onToggleSelection(item.id, !item.checked)}
                >
                  {item.checked ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setActiveReviewItemKey(item.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {item.title}
                    </div>
                    {item.sizeTier ? (
                      <span
                        className="rounded-full border px-2 py-1 text-[10px]"
                        style={{
                          borderColor: 'rgba(16, 185, 129, 0.22)',
                          background: 'rgba(16, 185, 129, 0.10)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        识别档位 {item.sizeTier}
                      </span>
                    ) : null}
                    {item.effectiveSizeTier ? (
                      <span
                        className="rounded-full border px-2 py-1 text-[10px]"
                        style={{
                          borderColor: 'rgba(59, 130, 246, 0.22)',
                          background: 'rgba(59, 130, 246, 0.10)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        实际采用档位 {item.effectiveSizeTier}
                      </span>
                    ) : null}
                    <span
                      className="rounded-full border px-2 py-1 text-[10px]"
                      style={{
                        borderColor: item.warnings.length > 0 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(59, 130, 246, 0.20)',
                        background: item.warnings.length > 0 ? 'rgba(245, 158, 11, 0.10)' : 'rgba(59, 130, 246, 0.08)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      自动图 {item.autoReferenceAssets.length} · 补传 {item.manualReferenceBindings.length}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {item.promptDraft || item.designRequirements}
                  </div>
                </button>

                <button
                  type="button"
                  className="shrink-0 rounded-full border px-2 py-1 text-[10px]"
                  style={{
                    borderColor: item.checked ? 'rgba(16, 185, 129, 0.24)' : 'var(--border-light)',
                    background: item.checked ? 'rgba(16, 185, 129, 0.10)' : 'transparent',
                    color: 'var(--text-secondary)',
                  }}
                  onClick={() => setActiveReviewItemKey(item.id)}
                >
                  {isTaskActive ? '当前条目' : '查看详情'}
                </button>
              </div>

              {shouldShowTaskEditor ? (
                <div className="mt-2 md:hidden">
                  {renderActiveDetail(item, true)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="mb-2 flex min-h-0 flex-col overflow-hidden rounded-xl border p-3" style={{ ...containerStyle, ...reviewViewportStyle }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">分析结果确认</div>
          <div className="text-xs text-[var(--text-secondary)]">
            主图 {analysis.mainImageItems.length} 张，A+ 模块 {analysis.aPlusGroup.modules.length} 张
            {configuredTaskCount > 0 ? `，已挂载任务 ${configuredTaskCount} 项` : ''}
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border px-3 py-2 text-xs font-medium"
          style={{
            borderColor: 'rgba(16, 185, 129, 0.35)',
            background: 'rgba(16, 185, 129, 0.12)',
            color: 'var(--text-primary)',
          }}
          onClick={() => { void onConfirm(); }}
          disabled={isConfirming}
        >
          {isConfirming ? '建卡中…' : '确认并建卡'}
        </button>
      </div>

      {analysis.reviewWarnings.length > 0 ? (
        <div className="mb-3 rounded-lg border px-3 py-2 text-xs" style={warningStyle}>
          <div className="mb-1 flex items-center gap-2 font-medium text-[var(--text-primary)]">
            <AlertTriangle size={14} />
            需要人工确认
          </div>
          <div className="space-y-1">
            {analysis.reviewWarnings.slice(0, 4).map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div
            data-testid="ecommerce-review-item-list"
            className="min-h-0 min-w-0 flex-1 overflow-y-auto custom-scrollbar pr-1"
          >
            <div className="space-y-4">
              {renderReviewSection('主图卡', mainReviewItems, 'rgba(59, 130, 246, 0.35)')}
              {renderReviewSection('A+ 模块卡', aPlusReviewItems, 'rgba(16, 185, 129, 0.35)')}
            </div>
          </div>
        </div>

        <div className="hidden min-h-0 min-w-0 flex-col overflow-hidden md:flex">
          {activeReviewItem ? renderActiveDetail(activeReviewItem) : null}
        </div>
      </div>

      <input
        ref={manualReferenceInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (manualReferenceUploadTarget && event.target.files?.length) {
            onPickManualReferenceFiles?.(manualReferenceUploadTarget, event.target.files);
          }
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
};

export default EcommerceAnalysisReviewPanel;
