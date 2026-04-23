import React from 'react';

import {
  GenerationConfig,
  GenerationMode,
  type EcommerceEditableTaskState,
  type EcommerceGroupSheet,
  type EcommerceTaskAssetRoleBinding,
  type ReferenceImage,
} from '../../../types';
import type {
  EcommerceAnalysisAPlusModule,
  EcommerceAnalysisMainImageItem,
  EcommerceAnalysisResult,
} from '../../../services/ecommerce/types.ts';
import type { EcommerceGroupSlotState } from '../../../services/ecommerce/groupSlotState.ts';
import EcommerceImportPanel from '../../ecommerce/EcommerceImportPanel';
import EcommerceAnalysisReviewPanel from '../../ecommerce/EcommerceAnalysisReviewPanel';
import EcommerceTaskEditorPanel, {
  type EcommerceTaskStateChangeHandler,
} from '../../ecommerce/EcommerceTaskEditorPanel';

type ManualReferenceBinding = {
  assetId: string;
  label: string;
  fileName: string;
  referenceImage: ReferenceImage;
  assetRole: EcommerceTaskAssetRoleBinding;
};

type EcommerceWorkbenchMode = 'group-overview' | 'main-card-edit' | 'module-edit';

type WorkbenchEntry = {
  sourceKey: string;
  title: string;
  subtitle: string;
  selected: boolean;
  isActive: boolean;
  currentImageId: string | null;
  history: EcommerceGroupSlotState['history'];
  currentVersionLabel: string;
  historyCount: number;
};

interface DesktopComposerEcommercePanelProps {
  config: GenerationConfig;
  requirementFileName?: string;
  productFileCount: number;
  extraReferenceCount: number;
  productFiles?: File[];
  extraReferenceFiles?: File[];
  itemReferenceFiles?: Record<string, ManualReferenceBinding[]>;
  ecommerceAnalysis?: EcommerceAnalysisResult | null;
  ecommerceSelection: Record<string, boolean>;
  taskStates?: Record<string, EcommerceEditableTaskState | undefined>;
  groupSlots?: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
  activeTaskState?: EcommerceEditableTaskState | null;
  analysisConfirmed?: boolean;
  confirmingAnalysis?: boolean;
  activeGroupSheet?: EcommerceGroupSheet | null;
  ecommerceAnalyzing: boolean;
  onPickRequirementFile?: (files: FileList | File[]) => void;
  onPickProductFiles?: (files: FileList | File[]) => void;
  onPickExtraReferenceFiles?: (files: FileList | File[]) => void;
  onClearRequirementFile?: () => void;
  onRemoveProductFile?: (index: number) => void;
  onRemoveExtraReferenceFile?: (index: number) => void;
  onPickItemReferenceFiles?: (sourceKey: string, files: FileList | File[]) => void;
  onRemoveItemReferenceFile?: (sourceKey: string, index: number) => void;
  onAnalyzeFile: () => void;
  onResetAnalysis?: () => void;
  onConfirmAnalysis?: () => void;
  onToggleSelection?: (id: string, selected: boolean) => void;
  onActivateGroupSheet?: (sheet: EcommerceGroupSheet) => void;
  onActivateTaskBySourceKey?: (sourceKey: string) => void;
  onPreviewSlotHistory?: (
    sourceSheet: EcommerceGroupSheet,
    sourceKey: string,
    preferredImageId?: string,
  ) => void;
  onTaskStateChange?: EcommerceTaskStateChangeHandler;
}

const sectionCardStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  borderColor: 'var(--border-light)',
};

const chipStyle: React.CSSProperties = {
  background: 'rgba(59, 130, 246, 0.10)',
  borderColor: 'rgba(59, 130, 246, 0.20)',
  color: 'var(--text-secondary)',
};

const actionButtonStyle: React.CSSProperties = {
  borderColor: 'var(--border-light)',
  background: 'rgba(148, 163, 184, 0.08)',
  color: 'var(--text-primary)',
};

const workbenchViewportStyle: React.CSSProperties = {
  maxHeight: 'min(70vh, 720px)',
};

const sectionLabelMap: Record<EcommerceGroupSheet, string> = {
  '主图': '主图',
  'A+': 'A+',
};

function resolveWorkbenchMode(
  activeTaskState: EcommerceEditableTaskState | null,
): EcommerceWorkbenchMode {
  if (!activeTaskState) {
    return 'group-overview';
  }

  return activeTaskState.sourceKind === 'main-image' ? 'main-card-edit' : 'module-edit';
}

function resolveVersionLabel(source: 'generated' | 'redraw' | null): string {
  if (source === 'redraw') {
    return '重绘版';
  }
  if (source === 'generated') {
    return '生成版';
  }
  return '未生成';
}

function buildGroupEntries(params: {
  groupSheet: EcommerceGroupSheet;
  analysis: EcommerceAnalysisResult;
  selection: Record<string, boolean>;
  taskStates: Record<string, EcommerceEditableTaskState | undefined>;
  groupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
  activeTaskState: EcommerceEditableTaskState | null;
}): WorkbenchEntry[] {
  const items: Array<EcommerceAnalysisMainImageItem | EcommerceAnalysisAPlusModule> =
    params.groupSheet === '主图'
      ? params.analysis.mainImageItems
      : params.analysis.aPlusGroup.modules;

  return items.map((item, index) => {
    const sourceKey = 'itemId' in item ? item.itemId : item.moduleId;
    const taskState = params.taskStates[sourceKey];
    const slotState = params.groupSlots[params.groupSheet].find((slot) => slot.sourceKey === sourceKey);
    const isActive = Boolean(
      params.activeTaskState
      && (
        params.activeTaskState.sourceRowKey === sourceKey
        || params.activeTaskState.taskId === sourceKey
        || (taskState && params.activeTaskState.taskId === taskState.taskId)
      ),
    );

    return {
      sourceKey,
      title: 'moduleName' in item ? item.moduleName : `${index + 1}. ${item.theme || item.type}`,
      subtitle: 'declaredSizeText' in item && item.declaredSizeText
        ? `尺寸 ${item.declaredSizeText} · ${item.designRequirements}`
        : item.designRequirements,
      selected: params.selection[sourceKey] !== false,
      isActive,
      currentImageId: slotState?.currentImageId || null,
      history: slotState?.history || [],
      currentVersionLabel: resolveVersionLabel(slotState?.currentSource || null),
      historyCount: slotState?.history.length || 0,
    };
  });
}

const DesktopComposerEcommercePanel: React.FC<DesktopComposerEcommercePanelProps> = ({
  config,
  requirementFileName,
  productFileCount,
  extraReferenceCount,
  productFiles = [],
  extraReferenceFiles = [],
  itemReferenceFiles = {},
  ecommerceAnalysis,
  ecommerceSelection,
  taskStates = {},
  groupSlots,
  activeTaskState = null,
  analysisConfirmed = false,
  confirmingAnalysis = false,
  activeGroupSheet = null,
  ecommerceAnalyzing,
  onPickRequirementFile,
  onPickProductFiles,
  onPickExtraReferenceFiles,
  onClearRequirementFile,
  onRemoveProductFile,
  onRemoveExtraReferenceFile,
  onPickItemReferenceFiles,
  onRemoveItemReferenceFile,
  onAnalyzeFile,
  onResetAnalysis,
  onConfirmAnalysis,
  onToggleSelection,
  onActivateGroupSheet,
  onActivateTaskBySourceKey,
  onPreviewSlotHistory,
  onTaskStateChange,
}) => {
  if (
    config.mode !== GenerationMode.ECOMMERCE
    || !onPickRequirementFile
    || !onPickProductFiles
    || !onPickExtraReferenceFiles
    || !onClearRequirementFile
    || !onRemoveProductFile
    || !onRemoveExtraReferenceFile
  ) {
    return null;
  }

  const resolvedGroupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]> = groupSlots ?? { 主图: [], 'A+': [] };
  const workbenchMode = resolveWorkbenchMode(activeTaskState);
  const resolvedGroupSheet: EcommerceGroupSheet = activeGroupSheet ?? activeTaskState?.sourceSheet ?? '主图';
  const activeEntries = ecommerceAnalysis
    ? buildGroupEntries({
      groupSheet: resolvedGroupSheet,
      analysis: ecommerceAnalysis,
      selection: ecommerceSelection,
      taskStates,
      groupSlots: resolvedGroupSlots,
      activeTaskState,
    })
    : [];
  const selectedCount = activeEntries.filter((entry) => entry.selected).length;
  const skippedCount = activeEntries.length - selectedCount;
  const [expandedHistorySourceKey, setExpandedHistorySourceKey] = React.useState<string | null>(null);
  const [isWorkbenchMinimized, setIsWorkbenchMinimized] = React.useState(true);
  const currentTaskSlot = activeTaskState
    ? resolvedGroupSlots[activeTaskState.sourceSheet]?.find((slot) => slot.sourceKey === activeTaskState.sourceRowKey) || null
    : null;
  const currentHistoricalVersions = currentTaskSlot
    ? currentTaskSlot.history.slice(0, currentTaskSlot.currentImageId ? -1 : currentTaskSlot.history.length).reverse()
    : [];

  React.useEffect(() => {
    setExpandedHistorySourceKey(null);
  }, [resolvedGroupSheet, workbenchMode]);

  return (
    <>
      <EcommerceImportPanel
        requirementFileName={requirementFileName}
        productFileCount={productFileCount}
        extraReferenceCount={extraReferenceCount}
        productFiles={productFiles}
        extraReferenceFiles={extraReferenceFiles}
        analyzedProductName={ecommerceAnalysis?.projectMeta.productName}
        isAnalyzing={ecommerceAnalyzing}
        hasAnalysis={!!ecommerceAnalysis}
        onPickRequirementFile={onPickRequirementFile}
        onPickProductFiles={onPickProductFiles}
        onPickExtraReferenceFiles={onPickExtraReferenceFiles}
        onClearRequirementFile={() => onClearRequirementFile?.()}
        onRemoveProductFile={(index) => onRemoveProductFile?.(index)}
        onRemoveExtraReferenceFile={(index) => onRemoveExtraReferenceFile?.(index)}
        onAnalyzeFile={onAnalyzeFile}
        onResetAnalysis={() => onResetAnalysis?.()}
      />

      {ecommerceAnalysis && !analysisConfirmed && onConfirmAnalysis && onToggleSelection ? (
        <EcommerceAnalysisReviewPanel
          analysis={ecommerceAnalysis}
          selection={ecommerceSelection}
          taskStates={taskStates}
          activeTaskState={activeTaskState}
          globalProductFiles={productFiles}
          globalExtraReferenceFiles={extraReferenceFiles}
          manualReferenceFilesByItem={itemReferenceFiles}
          onPickManualReferenceFiles={onPickItemReferenceFiles}
          onRemoveManualReferenceFile={onRemoveItemReferenceFile}
          onToggleSelection={onToggleSelection}
          onTaskStateChange={onTaskStateChange}
          isConfirming={confirmingAnalysis}
          onConfirm={onConfirmAnalysis}
        />
      ) : null}

      {ecommerceAnalysis && analysisConfirmed ? (
        isWorkbenchMinimized ? (
          <div
            className="mb-2 flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 transition-colors hover:bg-white/5"
            style={sectionCardStyle}
            onClick={() => setIsWorkbenchMinimized(false)}
          >
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                {sectionLabelMap[resolvedGroupSheet]}
              </span>
              <span>已确认 {selectedCount} 项</span>
              {skippedCount > 0 ? <span>· 跳过 {skippedCount} 项</span> : null}
            </div>
            <button
              type="button"
              className="rounded-lg border px-2.5 py-1 text-[11px] text-[var(--text-primary)] transition-colors hover:bg-white/5"
              style={sectionCardStyle}
            >
              展开工作台
            </button>
          </div>
        ) : (
        <div
          className="mb-2 flex min-h-0 flex-col overflow-hidden rounded-xl border p-3"
          style={{ ...sectionCardStyle, ...workbenchViewportStyle }}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {activeTaskState ? '当前电商任务' : '电商工作台'}
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {activeTaskState
                  ? `${activeTaskState.displayLabel || activeTaskState.outputTypeLabel || activeTaskState.theme}${activeTaskState.sourceRowKey ? ` · ${activeTaskState.sourceRowKey}` : ''}`
                  : `${sectionLabelMap[resolvedGroupSheet]}组已确认，可从总览进入编辑`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="rounded-full border px-2 py-0.5 text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-white/5"
                style={sectionCardStyle}
                onClick={() => setIsWorkbenchMinimized(true)}
              >
                收起
              </button>
              <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                {sectionLabelMap[activeTaskState?.sourceSheet ?? resolvedGroupSheet]}
              </span>
              {activeGroupSheet ? (
                <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                  当前分组 {sectionLabelMap[activeGroupSheet]}
                </span>
              ) : null}
              {analysisConfirmed ? (
                <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                  已确认建卡
                </span>
              ) : null}
            </div>
          </div>

          {workbenchMode === 'group-overview' ? (
            <div className="min-h-0 overflow-y-auto custom-scrollbar pr-1" style={{ flex: 1 }} data-testid="ecommerce-group-overview-workbench">
              <div className="space-y-3">
                <div className="text-xs text-[var(--text-secondary)]">
                  点击模块进入编辑，也可以直接预览当前版本或历史版本。
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border px-3 py-2" style={sectionCardStyle}>
                    <div className="text-[11px] text-[var(--text-tertiary)]">已确认生成</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{selectedCount}</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2" style={sectionCardStyle}>
                    <div className="text-[11px] text-[var(--text-tertiary)]">已跳过</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{skippedCount}</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2" style={sectionCardStyle}>
                    <div className="text-[11px] text-[var(--text-tertiary)]">模块总数</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{activeEntries.length}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {activeEntries.map((entry) => {
                    const historicalVersions = entry.history
                      .slice(0, entry.currentImageId ? -1 : entry.history.length)
                      .reverse();

                    return (
                      <div
                        key={entry.sourceKey}
                        className="rounded-lg border px-3 py-2"
                        style={{
                          borderColor: entry.isActive ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-light)',
                          background: entry.isActive ? 'rgba(59, 130, 246, 0.10)' : 'transparent',
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => onActivateTaskBySourceKey?.(entry.sourceKey)}
                          >
                            <div className="text-sm font-medium text-[var(--text-primary)]">{entry.title}</div>
                            <div className="mt-1 text-xs text-[var(--text-secondary)]">{entry.subtitle}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
                              <span>当前版本 {entry.currentVersionLabel}</span>
                              <span>历史版本 {entry.historyCount}</span>
                            </div>
                          </button>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="rounded-full border px-2 py-1 text-[10px] text-[var(--text-secondary)]" style={sectionCardStyle}>
                              {entry.selected ? '已确认生成' : '已跳过'}
                            </span>
                            {onPreviewSlotHistory && entry.currentImageId ? (
                              <button
                                type="button"
                                data-testid="ecommerce-slot-history-open-current"
                                className="rounded-md border px-2 py-1 text-[10px] text-[var(--text-primary)]"
                                style={sectionCardStyle}
                                onClick={() => onPreviewSlotHistory(resolvedGroupSheet, entry.sourceKey, entry.currentImageId || undefined)}
                              >
                                预览当前版本
                              </button>
                            ) : null}
                            {onPreviewSlotHistory && historicalVersions.length > 0 ? (
                              <button
                                type="button"
                                data-testid="ecommerce-slot-history-open-all"
                                className="rounded-md border px-2 py-1 text-[10px] text-[var(--text-secondary)]"
                                style={sectionCardStyle}
                                onClick={() => setExpandedHistorySourceKey((previous) => (
                                  previous === entry.sourceKey ? null : entry.sourceKey
                                ))}
                              >
                                查看历史版本 {historicalVersions.length}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {onPreviewSlotHistory && expandedHistorySourceKey === entry.sourceKey && historicalVersions.length > 0 ? (
                          <div className="mt-3 space-y-2" data-testid="ecommerce-slot-history-panel">
                            {historicalVersions.map((historyEntry, index) => (
                              <button
                                key={`${entry.sourceKey}-${historyEntry.imageId}-${index}`}
                                type="button"
                                className="flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-[10px]"
                                style={sectionCardStyle}
                                onClick={() => onPreviewSlotHistory(resolvedGroupSheet, entry.sourceKey, historyEntry.imageId)}
                              >
                                <span className="text-[var(--text-primary)]">
                                  {resolveVersionLabel(historyEntry.source)} {historicalVersions.length - index}
                                </span>
                                <span className="text-[var(--text-tertiary)]">点击预览</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="min-h-0 overflow-y-auto custom-scrollbar pr-1"
              style={{ flex: 1 }}
              data-testid={workbenchMode === 'main-card-edit' ? 'ecommerce-main-card-edit-workbench' : 'ecommerce-module-edit-workbench'}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {onActivateGroupSheet ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                      style={actionButtonStyle}
                      onClick={() => onActivateGroupSheet(resolvedGroupSheet)}
                    >
                      返回组总览
                    </button>
                  ) : null}
                  {onActivateTaskBySourceKey ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                      style={actionButtonStyle}
                      onClick={() => onActivateTaskBySourceKey(activeTaskState?.sourceRowKey || '')}
                    >
                      回到任务卡片
                    </button>
                  ) : null}
                  {currentTaskSlot?.currentImageId && onPreviewSlotHistory ? (
                    <>
                      <button
                        type="button"
                        data-testid="ecommerce-slot-history-open-current"
                        className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                        style={actionButtonStyle}
                        onClick={() => onPreviewSlotHistory(
                          activeTaskState?.sourceSheet || resolvedGroupSheet,
                          activeTaskState?.sourceRowKey || '',
                          currentTaskSlot.currentImageId || undefined,
                        )}
                      >
                        查看当前版本
                      </button>
                      {currentHistoricalVersions.length > 0 ? (
                        <button
                          type="button"
                          data-testid="ecommerce-slot-history-open-all"
                          className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                          style={actionButtonStyle}
                          onClick={() => setExpandedHistorySourceKey((previous) => (
                            previous === (activeTaskState?.sourceRowKey || '') ? null : (activeTaskState?.sourceRowKey || '')
                          ))}
                        >
                          查看历史版本 {currentHistoricalVersions.length}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {onPreviewSlotHistory && expandedHistorySourceKey === (activeTaskState?.sourceRowKey || '') && currentHistoricalVersions.length > 0 ? (
                  <div className="space-y-2" data-testid="ecommerce-slot-history-panel">
                    {currentHistoricalVersions.map((historyEntry, index) => (
                      <button
                        key={`${activeTaskState?.sourceRowKey || 'active'}-${historyEntry.imageId}-${index}`}
                        type="button"
                        className="flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-[10px]"
                        style={sectionCardStyle}
                        onClick={() => onPreviewSlotHistory(
                          activeTaskState?.sourceSheet || resolvedGroupSheet,
                          activeTaskState?.sourceRowKey || '',
                          historyEntry.imageId,
                        )}
                      >
                        <span className="text-[var(--text-primary)]">
                          {resolveVersionLabel(historyEntry.source)} {currentHistoricalVersions.length - index}
                        </span>
                        <span className="text-[var(--text-tertiary)]">点击预览</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {activeTaskState && onTaskStateChange ? (
                  <EcommerceTaskEditorPanel
                    taskState={activeTaskState}
                    onTaskStateChange={onTaskStateChange}
                    collapsible
                    defaultExpanded={false}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
        )
      ) : !ecommerceAnalysis && activeTaskState && onTaskStateChange ? (
        <div
          className="mb-2 flex min-h-0 flex-col overflow-hidden rounded-xl border p-3"
          style={{ ...sectionCardStyle, ...workbenchViewportStyle }}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--text-primary)]">当前电商任务</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {activeTaskState.displayLabel || activeTaskState.outputTypeLabel || activeTaskState.theme}
                {activeTaskState.sourceRowKey ? ` · ${activeTaskState.sourceRowKey}` : ''}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                {sectionLabelMap[activeTaskState.sourceSheet]}
              </span>
              {activeGroupSheet ? (
                <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                  当前分组 {sectionLabelMap[activeGroupSheet]}
                </span>
              ) : null}
            </div>
          </div>

          <div
            className="min-h-0 overflow-y-auto custom-scrollbar pr-1"
            style={{ flex: 1 }}
            data-testid={workbenchMode === 'main-card-edit' ? 'ecommerce-main-card-edit-workbench' : 'ecommerce-module-edit-workbench'}
          >
            <div className="space-y-3">
              <div className="mb-3 flex flex-wrap gap-2">
                {onActivateGroupSheet ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                    style={actionButtonStyle}
                    onClick={() => onActivateGroupSheet(activeTaskState.sourceSheet)}
                  >
                    聚焦 {sectionLabelMap[activeTaskState.sourceSheet]} 组
                  </button>
                ) : null}
                {onActivateTaskBySourceKey ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                    style={actionButtonStyle}
                    onClick={() => onActivateTaskBySourceKey(activeTaskState.sourceRowKey)}
                  >
                    回到任务卡片
                  </button>
                ) : null}
                {currentTaskSlot?.currentImageId && onPreviewSlotHistory ? (
                  <>
                    <button
                      type="button"
                      data-testid="ecommerce-slot-history-open-current"
                      className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                      style={actionButtonStyle}
                      onClick={() => onPreviewSlotHistory(
                        activeTaskState.sourceSheet,
                        activeTaskState.sourceRowKey,
                        currentTaskSlot.currentImageId || undefined,
                      )}
                    >
                      查看当前版本
                    </button>
                    {currentHistoricalVersions.length > 0 ? (
                      <button
                        type="button"
                        data-testid="ecommerce-slot-history-open-all"
                        className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
                        style={actionButtonStyle}
                        onClick={() => setExpandedHistorySourceKey((previous) => (
                          previous === activeTaskState.sourceRowKey ? null : activeTaskState.sourceRowKey
                        ))}
                      >
                        查看历史版本 {currentHistoricalVersions.length}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>

              {onPreviewSlotHistory && expandedHistorySourceKey === activeTaskState.sourceRowKey && currentHistoricalVersions.length > 0 ? (
                <div className="space-y-2" data-testid="ecommerce-slot-history-panel">
                  {currentHistoricalVersions.map((historyEntry, index) => (
                    <button
                      key={`${activeTaskState.sourceRowKey}-${historyEntry.imageId}-${index}`}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-[10px]"
                      style={sectionCardStyle}
                      onClick={() => onPreviewSlotHistory(
                        activeTaskState.sourceSheet,
                        activeTaskState.sourceRowKey,
                        historyEntry.imageId,
                      )}
                    >
                      <span className="text-[var(--text-primary)]">
                        {resolveVersionLabel(historyEntry.source)} {currentHistoricalVersions.length - index}
                      </span>
                      <span className="text-[var(--text-tertiary)]">点击预览</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <EcommerceTaskEditorPanel
                taskState={activeTaskState}
                onTaskStateChange={onTaskStateChange}
                collapsible
                defaultExpanded={false}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default DesktopComposerEcommercePanel;
