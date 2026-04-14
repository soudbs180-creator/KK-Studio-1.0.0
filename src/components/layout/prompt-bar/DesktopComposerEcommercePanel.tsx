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
import EcommerceTaskEditorPanel from '../../ecommerce/EcommerceTaskEditorPanel';

type EcommerceWorkbenchMode = 'group-overview' | 'main-card-edit' | 'module-edit';

interface DesktopComposerEcommercePanelProps {
  config: GenerationConfig;
  requirementFileName?: string;
  productFileCount: number;
  extraReferenceCount: number;
  productFiles?: File[];
  extraReferenceFiles?: File[];
  itemReferenceFiles?: Record<string, Array<{
    assetId: string;
    label: string;
    fileName: string;
    referenceImage: ReferenceImage;
    assetRole: EcommerceTaskAssetRoleBinding;
  }>>;
  ecommerceAnalysis?: EcommerceAnalysisResult | null;
  ecommerceSelection: Record<string, boolean>;
  taskStates?: Record<string, EcommerceEditableTaskState | undefined>;
  groupSlots?: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
  activeTaskState?: EcommerceEditableTaskState | null;
  analysisConfirmed?: boolean;
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
  onTaskStateChange?: (
    taskId: string,
    updater:
      | EcommerceEditableTaskState
      | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState),
  ) => void;
}

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

const shellStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  borderColor: 'var(--border-light)',
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
  groupSlots = { 主图: [], 'A+': [] },
  activeTaskState = null,
  analysisConfirmed = false,
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
  ) {
    return null;
  }

  const workbenchMode = resolveWorkbenchMode(activeTaskState);
  const resolvedGroupSheet: EcommerceGroupSheet = activeGroupSheet ?? activeTaskState?.sourceSheet ?? '主图';
  const activeEntries = ecommerceAnalysis
    ? buildGroupEntries({
      groupSheet: resolvedGroupSheet,
      analysis: ecommerceAnalysis,
      selection: ecommerceSelection,
      taskStates,
      groupSlots,
      activeTaskState,
    })
    : [];
  const selectedCount = activeEntries.filter((entry) => entry.selected).length;
  const skippedCount = activeEntries.length - selectedCount;
  const [expandedHistorySourceKey, setExpandedHistorySourceKey] = React.useState<string | null>(null);

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
          manualReferenceFilesByItem={itemReferenceFiles}
          onPickManualReferenceFiles={onPickItemReferenceFiles}
          onRemoveManualReferenceFile={onRemoveItemReferenceFile}
          onToggleSelection={onToggleSelection}
          onTaskStateChange={onTaskStateChange}
          onConfirm={onConfirmAnalysis}
        />
      ) : null}

      {ecommerceAnalysis && analysisConfirmed ? (
        <div className="mb-2 rounded-xl border p-3" style={shellStyle} data-ecommerce-workbench-mode={workbenchMode}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                电商工作台
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                {workbenchMode === 'group-overview'
                  ? '组总览'
                  : workbenchMode === 'main-card-edit'
                    ? '主卡编辑'
                    : '模块编辑'}
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                当前组：{resolvedGroupSheet === '主图' ? '主图组' : 'A+组'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['主图', 'A+'] as EcommerceGroupSheet[]).map((sheet) => (
                <button
                  key={sheet}
                  type="button"
                  className="rounded-lg border px-3 py-2 text-xs font-medium"
                  style={{
                    borderColor: resolvedGroupSheet === sheet ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-light)',
                    background: resolvedGroupSheet === sheet ? 'rgba(59, 130, 246, 0.10)' : 'transparent',
                    color: 'var(--text-primary)',
                  }}
                  onClick={() => onActivateGroupSheet?.(sheet)}
                >
                  {sheet === '主图' ? '主图组' : 'A+组'}
                </button>
              ))}
            </div>
          </div>

          {workbenchMode === 'group-overview' ? (
            <div className="space-y-3" data-testid="ecommerce-group-overview-workbench">
              <div className="text-xs text-[var(--text-secondary)]">
                点击模块进入编辑，也可以直接预览当前版本或历史版本。
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border px-3 py-2" style={shellStyle}>
                  <div className="text-[11px] text-[var(--text-tertiary)]">已确认生成</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{selectedCount}</div>
                </div>
                <div className="rounded-lg border px-3 py-2" style={shellStyle}>
                  <div className="text-[11px] text-[var(--text-tertiary)]">已跳过</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{skippedCount}</div>
                </div>
                <div className="rounded-lg border px-3 py-2" style={shellStyle}>
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
                          <span className="rounded-full border px-2 py-1 text-[10px] text-[var(--text-secondary)]" style={shellStyle}>
                            {entry.selected ? '已确认生成' : '已跳过'}
                          </span>
                          {onPreviewSlotHistory && entry.currentImageId ? (
                            <button
                              type="button"
                              data-testid="ecommerce-slot-history-open-current"
                              className="rounded-md border px-2 py-1 text-[10px] text-[var(--text-primary)]"
                              style={shellStyle}
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
                              style={shellStyle}
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
                              style={shellStyle}
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
          ) : (
            <div className="space-y-3" data-testid={workbenchMode === 'main-card-edit' ? 'ecommerce-main-card-edit-workbench' : 'ecommerce-module-edit-workbench'}>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-xs font-medium"
                style={shellStyle}
                onClick={() => onActivateGroupSheet?.(resolvedGroupSheet)}
              >
                返回组总览
              </button>
              {activeTaskState && onTaskStateChange ? (
                <EcommerceTaskEditorPanel
                  taskState={activeTaskState}
                  onTaskStateChange={onTaskStateChange}
                />
              ) : null}
            </div>
          )}
        </div>
      ) : activeTaskState && onTaskStateChange ? (
        <div className="mb-2 rounded-xl border p-3" style={shellStyle} data-ecommerce-workbench-mode={workbenchMode}>
          <div className="mb-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              电商工作台
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {workbenchMode === 'main-card-edit' ? '主卡编辑' : '模块编辑'}
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              当前分析结果未保留在内存中，仍可直接编辑当前任务。
            </div>
          </div>
          <div className="space-y-3" data-testid={workbenchMode === 'main-card-edit' ? 'ecommerce-main-card-edit-workbench' : 'ecommerce-module-edit-workbench'}>
            <EcommerceTaskEditorPanel
              taskState={activeTaskState}
              onTaskStateChange={onTaskStateChange}
            />
          </div>
        </div>
      ) : null}
    </>
  );
};

export default DesktopComposerEcommercePanel;
