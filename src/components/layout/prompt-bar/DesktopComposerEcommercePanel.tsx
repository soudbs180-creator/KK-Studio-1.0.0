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

type EcommerceFrameworkSummary = {
  frameworkId: string;
  activeSheet: EcommerceGroupSheet;
  paused: boolean;
  frameworkLabel: string;
  queued: number;
  dispatching: number;
  running: number;
  completed: number;
  failed: number;
  pausedItems: number;
  total: number;
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
  activeFrameworkId?: string | null;
  frameworkSummary?: EcommerceFrameworkSummary;
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

const shellSurfaceStyle: React.CSSProperties = {
  background: 'var(--frost-card-framework-bg)',
  borderColor: 'var(--frost-card-framework-border)',
  boxShadow: 'var(--frost-card-framework-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
  backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
};

const panelSurfaceStyle: React.CSSProperties = {
  background: 'var(--frost-card-main-bg)',
  borderColor: 'var(--frost-card-main-border)',
  boxShadow: 'var(--frost-card-main-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-main-blur)) saturate(1.12)',
  backdropFilter: 'blur(var(--frost-card-main-blur)) saturate(1.12)',
};

const subSurfaceStyle: React.CSSProperties = {
  background: 'var(--frost-card-sub-bg)',
  borderColor: 'var(--frost-card-sub-border)',
  boxShadow: 'var(--frost-card-sub-shadow)',
  WebkitBackdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(1.08)',
  backdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(1.08)',
  color: 'var(--text-secondary)',
};

const chipStyle: React.CSSProperties = {
  ...subSurfaceStyle,
};

const actionButtonStyle: React.CSSProperties = {
  ...subSurfaceStyle,
  color: 'var(--text-primary)',
};

const workbenchViewportStyle: React.CSSProperties = {
  maxHeight: 'min(calc(100vh - 220px), 720px)',
};

const ecommercePanelViewportStyle: React.CSSProperties = {
  maxHeight: 'min(calc(100vh - 170px), 980px)',
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
    return 'Redraw';
  }
  if (source === 'generated') {
    return 'Generated';
  }
  return 'Pending';
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
        ? `${item.declaredSizeText} · ${item.designRequirements}`
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

const FrameworkQueueCards: React.FC<{ frameworkSummary?: EcommerceFrameworkSummary }> = ({ frameworkSummary }) => {
  const cards = frameworkSummary
    ? [
      { label: 'Queued', value: frameworkSummary.queued },
      { label: 'Dispatching', value: frameworkSummary.dispatching },
      { label: 'Running', value: frameworkSummary.running },
      { label: 'Completed', value: frameworkSummary.completed },
      { label: 'Failed', value: frameworkSummary.failed },
    ]
    : [
      { label: 'Queued', value: 0 },
      { label: 'Dispatching', value: 0 },
      { label: 'Running', value: 0 },
      { label: 'Completed', value: 0 },
      { label: 'Failed', value: 0 },
    ];

  return (
    <div className="grid gap-2 md:grid-cols-5" data-testid="ecommerce-framework-summary-card">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border px-3 py-2" style={subSurfaceStyle}>
          <div className="text-[11px] text-[var(--text-tertiary)]">{card.label}</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{card.value}</div>
        </div>
      ))}
    </div>
  );
};

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
  activeFrameworkId = null,
  frameworkSummary,
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

  const resolvedGroupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]> = groupSlots ?? { '主图': [], 'A+': [] };
  const workbenchMode = resolveWorkbenchMode(activeTaskState);
  const resolvedGroupSheet: EcommerceGroupSheet = activeGroupSheet
    ?? frameworkSummary?.activeSheet
    ?? activeTaskState?.sourceSheet
    ?? '主图';
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
  const previewEntries = activeEntries.slice(0, 3);
  const currentTaskSlot = activeTaskState
    ? resolvedGroupSlots[activeTaskState.sourceSheet]?.find((slot) => slot.sourceKey === activeTaskState.sourceRowKey) || null
    : null;
  const currentHistoricalVersions = currentTaskSlot
    ? currentTaskSlot.history
      .slice(0, currentTaskSlot.currentImageId ? -1 : currentTaskSlot.history.length)
      .reverse()
    : [];
  const [expandedHistorySourceKey, setExpandedHistorySourceKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    setExpandedHistorySourceKey(null);
  }, [activeTaskState?.sourceRowKey, resolvedGroupSheet, workbenchMode]);

  const renderActiveTaskCompanion = () => {
    if (!activeTaskState || !onTaskStateChange) {
      return null;
    }

    return (
      <div
        className="mb-2 flex min-h-0 flex-col overflow-hidden rounded-xl border p-3"
        style={{ ...shellSurfaceStyle, ...workbenchViewportStyle }}
        data-testid={workbenchMode === 'main-card-edit' ? 'ecommerce-main-card-edit-workbench' : 'ecommerce-module-edit-workbench'}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Focused task</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              {activeTaskState.displayLabel || activeTaskState.outputTypeLabel || activeTaskState.theme}
              {activeTaskState.sourceRowKey ? ` · ${activeTaskState.sourceRowKey}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
              {sectionLabelMap[activeTaskState.sourceSheet]}
            </span>
            {frameworkSummary ? (
              <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                {frameworkSummary.paused ? 'Paused' : 'Synced'}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {onActivateGroupSheet ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-[var(--toolbar-hover)]"
              style={actionButtonStyle}
              onClick={() => onActivateGroupSheet(activeTaskState.sourceSheet)}
            >
              Sync section
            </button>
          ) : null}
          {onActivateTaskBySourceKey ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-[var(--toolbar-hover)]"
              style={actionButtonStyle}
              onClick={() => onActivateTaskBySourceKey(activeTaskState.sourceRowKey)}
            >
              Focus on canvas
            </button>
          ) : null}
          {currentTaskSlot?.currentImageId && onPreviewSlotHistory ? (
            <>
              <button
                type="button"
                data-testid="ecommerce-slot-history-open-current"
                className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-[var(--toolbar-hover)]"
                style={actionButtonStyle}
                onClick={() => onPreviewSlotHistory(
                  activeTaskState.sourceSheet,
                  activeTaskState.sourceRowKey,
                  currentTaskSlot.currentImageId || undefined,
                )}
              >
                Preview current
              </button>
              {currentHistoricalVersions.length > 0 ? (
                <button
                  type="button"
                  data-testid="ecommerce-slot-history-open-all"
                  className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-[var(--toolbar-hover)]"
                  style={actionButtonStyle}
                  onClick={() => setExpandedHistorySourceKey((previous) => (
                    previous === activeTaskState.sourceRowKey ? null : activeTaskState.sourceRowKey
                  ))}
                >
                  History {currentHistoricalVersions.length}
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {onPreviewSlotHistory && expandedHistorySourceKey === activeTaskState.sourceRowKey && currentHistoricalVersions.length > 0 ? (
          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto custom-scrollbar pr-1" data-testid="ecommerce-slot-history-panel">
            {currentHistoricalVersions.map((historyEntry, index) => (
              <button
                key={`${activeTaskState.sourceRowKey}-${historyEntry.imageId}-${index}`}
                type="button"
                className="flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-[10px]"
                style={subSurfaceStyle}
                onClick={() => onPreviewSlotHistory(
                  activeTaskState.sourceSheet,
                  activeTaskState.sourceRowKey,
                  historyEntry.imageId,
                )}
              >
                <span className="text-[var(--text-primary)]">
                  {resolveVersionLabel(historyEntry.source)} {currentHistoricalVersions.length - index}
                </span>
                <span className="text-[var(--text-tertiary)]">Preview</span>
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
    );
  };

  return (
    <div
      className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1"
      style={ecommercePanelViewportStyle}
    >
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

      {(analysisConfirmed || activeTaskState) ? (
        <>
          <div
            className="rounded-xl border p-3"
            style={shellSurfaceStyle}
            data-testid="ecommerce-framework-companion-panel"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Canvas framework</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  Batch queue control stays on the canvas framework card. PromptBar mirrors framework progress, focused task details, and slot history.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                  {frameworkSummary?.frameworkLabel || (activeFrameworkId ? 'Framework linked' : 'No framework focus')}
                </span>
                <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                  Section {sectionLabelMap[resolvedGroupSheet]}
                </span>
                {frameworkSummary ? (
                  <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                    {frameworkSummary.paused ? 'Paused' : (frameworkSummary.running > 0 ? 'Running' : 'Idle')}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-3">
              <FrameworkQueueCards frameworkSummary={frameworkSummary} />
            </div>
          </div>

          <div
            className="flex min-h-0 flex-col overflow-hidden rounded-xl border p-3"
            style={{ ...shellSurfaceStyle, ...workbenchViewportStyle }}
            data-testid="ecommerce-group-overview-workbench"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)]">PromptBar companion</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  Use the canvas framework card for batch start, pause, resume, and section switching. Use PromptBar for lightweight task review and parameter follow-up.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {onActivateGroupSheet ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-[var(--toolbar-hover)]"
                    style={actionButtonStyle}
                    onClick={() => onActivateGroupSheet(resolvedGroupSheet)}
                  >
                    Sync section
                  </button>
                ) : null}
                {activeTaskState && onActivateTaskBySourceKey ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-[11px] font-medium transition-all duration-200 hover:bg-[var(--toolbar-hover)]"
                    style={actionButtonStyle}
                    onClick={() => onActivateTaskBySourceKey(activeTaskState.sourceRowKey)}
                  >
                    Focus active task
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <div className="rounded-lg border px-3 py-2" style={subSurfaceStyle}>
                <div className="text-[11px] text-[var(--text-tertiary)]">Selected</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{selectedCount}</div>
              </div>
              <div className="rounded-lg border px-3 py-2" style={subSurfaceStyle}>
                <div className="text-[11px] text-[var(--text-tertiary)]">Skipped</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{skippedCount}</div>
              </div>
              <div className="rounded-lg border px-3 py-2" style={subSurfaceStyle}>
                <div className="text-[11px] text-[var(--text-tertiary)]">Section items</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{activeEntries.length}</div>
              </div>
              <div className="rounded-lg border px-3 py-2" style={subSurfaceStyle}>
                <div className="text-[11px] text-[var(--text-tertiary)]">Focused task</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {activeTaskState?.displayLabel || activeTaskState?.outputTypeLabel || 'Canvas selection'}
                </div>
              </div>
            </div>

            {previewEntries.length > 0 ? (
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {previewEntries.map((entry) => (
                  <div
                    key={entry.sourceKey}
                    className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                    style={entry.isActive ? {
                      ...panelSurfaceStyle,
                      borderColor: 'var(--clay-brand-pink)',
                      background: 'var(--frost-card-main-bg)',
                      boxShadow: 'inset 0 0 0 1px var(--prompt-bar-shell-border-strong), var(--frost-card-main-shadow)',
                    } : subSurfaceStyle}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{entry.title}</div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">{entry.subtitle}</div>
                      <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                        {entry.currentVersionLabel} · History {entry.historyCount}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border px-2 py-0.5 text-[10px]" style={chipStyle}>
                        {entry.selected ? 'Selected' : 'Skipped'}
                      </span>
                      {onActivateTaskBySourceKey ? (
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-[10px]"
                          style={actionButtonStyle}
                          onClick={() => onActivateTaskBySourceKey(entry.sourceKey)}
                        >
                          Focus
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {activeEntries.length > previewEntries.length ? (
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    {activeEntries.length - previewEntries.length} more tasks remain on the canvas framework card.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 min-h-0 flex-1 text-xs text-[var(--text-secondary)]">
                Select a framework card or task card on the canvas to continue editing here.
              </div>
            )}
          </div>

          {renderActiveTaskCompanion()}
        </>
      ) : null}
    </div>
  );
};

export default DesktopComposerEcommercePanel;
