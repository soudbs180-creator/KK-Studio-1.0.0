import React, { useMemo } from 'react';
import { ArrowLeft, ShoppingBag, Landmark, Coins, CheckSquare, Square, Check, RefreshCw } from 'lucide-react';
import type { AppPromptBarProps } from '../../app/AppPromptComposer';
import type { EcommerceGroupSheet, EcommerceEditableTaskState } from '../../types';
import EcommerceImportPanel from '../ecommerce/EcommerceImportPanel';
import EcommerceAnalysisReviewPanel from '../ecommerce/EcommerceAnalysisReviewPanel';
import EcommerceTaskEditorPanel from '../ecommerce/EcommerceTaskEditorPanel';
import { useLocale } from '../../context/LocaleContext';

interface MobileEcommerceScreenProps {
  onClose: () => void;
  balance?: number;
  balanceLoading?: boolean;
  promptBarProps: AppPromptBarProps;
}

const MobileEcommerceScreen: React.FC<MobileEcommerceScreenProps> = ({
  onClose,
  balance = 0,
  balanceLoading = false,
  promptBarProps,
}) => {
  const { pick } = useLocale();

  // 从 promptBarProps 中解构所需电商属性
  const {
    ecommerceRequirementFileName,
    ecommerceProductFileCount = 0,
    ecommerceExtraReferenceCount = 0,
    ecommerceProductFiles = [],
    ecommerceExtraReferenceFiles = [],
    ecommerceItemReferenceFiles = {},
    ecommerceAnalysis,
    ecommerceSelection = {},
    ecommerceTaskStates = {},
    ecommerceGroupSlots = { '主图': [], 'A+': [] },
    ecommerceActiveTaskState = null,
    ecommerceActiveFrameworkId = null,
    ecommerceFrameworkSummary,
    ecommerceSheetSettings,
    ecommerceAnalysisConfirmed = false,
    ecommerceConfirmingAnalysis = false,
    ecommerceActiveGroupSheet = null,
    ecommerceAnalyzing = false,
    onPickEcommerceRequirementFile,
    onPickEcommerceProductFiles,
    onPickEcommerceExtraReferenceFiles,
    onClearEcommerceRequirementFile,
    onRemoveEcommerceProductFile,
    onRemoveEcommerceExtraReferenceFile,
    onPickEcommerceItemReferenceFiles,
    onRemoveEcommerceItemReferenceFile,
    onResetEcommerceAnalysis,
    onConfirmEcommerceAnalysis,
    onToggleEcommerceSelection,
    onActivateEcommerceGroupSheet,
    onActivateEcommerceTaskBySourceKey,
    onChangeEcommerceTaskState,
    onPreviewEcommerceSlotHistory,
    onAnalyzeEcommerceFile,
  } = promptBarProps;

  // 确立当前活跃分区，默认'主图'
  const resolvedGroupSheet: EcommerceGroupSheet =
    ecommerceActiveGroupSheet ||
    ecommerceFrameworkSummary?.activeSheet ||
    ecommerceActiveTaskState?.sourceSheet ||
    '主图';

  // 构建当前分区的任务项，类似 DesktopComposerEcommercePanel.tsx 中的 buildGroupEntries
  const activeEntries = useMemo(() => {
    if (!ecommerceAnalysis) return [];
    const items =
      resolvedGroupSheet === '主图'
        ? ecommerceAnalysis.mainImageItems
        : ecommerceAnalysis.aPlusGroup.modules;

    return items.map((item, index) => {
      const sourceKey = 'itemId' in item ? item.itemId : item.moduleId;
      const taskState = ecommerceTaskStates[sourceKey];
      const slotState = ecommerceGroupSlots[resolvedGroupSheet]?.find(
        (slot) => slot.sourceKey === sourceKey
      );
      const isActive = Boolean(
        ecommerceActiveTaskState &&
          (ecommerceActiveTaskState.sourceRowKey === sourceKey ||
            ecommerceActiveTaskState.taskId === sourceKey ||
            (taskState && ecommerceActiveTaskState.taskId === taskState.taskId))
      );

      const isSelected = ecommerceSelection[sourceKey] !== false;

      // 确定版本状态
      let versionLabel = pick('待生成', 'Pending');
      if (slotState?.currentSource === 'redraw') {
        versionLabel = pick('已重绘', 'Redraw');
      } else if (slotState?.currentSource === 'generated') {
        versionLabel = pick('已生成', 'Generated');
      }

      return {
        sourceKey,
        title: 'moduleName' in item ? item.moduleName : `${index + 1}. ${item.theme || item.type}`,
        subtitle:
          'declaredSizeText' in item && item.declaredSizeText
            ? `${item.declaredSizeText} · ${item.designRequirements}`
            : item.designRequirements,
        selected: isSelected,
        isActive,
        currentImageId: slotState?.currentImageId || null,
        historyCount: slotState?.history?.length || 0,
        versionLabel,
      };
    });
  }, [
    ecommerceAnalysis,
    resolvedGroupSheet,
    ecommerceTaskStates,
    ecommerceGroupSlots,
    ecommerceActiveTaskState,
    ecommerceSelection,
    pick,
  ]);

  // 全屏毛玻璃背景样式
  const containerStyle: React.CSSProperties = {
    background: 'var(--mobile-clay-shell-bg)',
    WebkitBackdropFilter: 'blur(30px) saturate(1.2)',
    backdropFilter: 'blur(30px) saturate(1.2)',
  };

  return (
    <div
      style={containerStyle}
      className="fixed inset-0 z-[1010] flex flex-col overflow-hidden text-[var(--text-primary)]"
      data-testid="mobile-ecommerce-screen"
    >
      {/* 顶部 Header：磨砂毛玻璃常驻 */}
      <header
        className="safe-top shrink-0 border-b border-[var(--mobile-clay-border)] px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(var(--bg-primary-rgb, 15, 15, 20), 0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/80 text-[var(--text-primary)] transition active:scale-95"
            aria-label="关闭电商控制"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-semibold leading-none flex items-center gap-1.5">
              <ShoppingBag size={16} className="text-[var(--accent-color)]" />
              {pick('智能电商工作区', 'E-commerce Space')}
            </h1>
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)] leading-none">
              {pick('移动端高级控制台', 'Mobile Premium Console')}
            </p>
          </div>
        </div>

        {/* 顶部余额胶囊：微金尊贵质感 */}
        <div
          className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-yellow-600/15 px-3 py-1.5 shadow-sm shadow-amber-500/5"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <Coins size={12} className="text-amber-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-amber-200 tracking-wider">
            {balanceLoading ? (
              <span className="opacity-50">...</span>
            ) : (
              `${balance} ${pick('金币', 'Credits')}`
            )}
          </span>
        </div>
      </header>

      {/* 主滚动区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar pb-[calc(env(safe-area-inset-bottom)+24px)]">
        
        {/* 步骤一：导入面板 */}
        {onPickEcommerceRequirementFile &&
          onPickEcommerceProductFiles &&
          onPickEcommerceExtraReferenceFiles &&
          onClearEcommerceRequirementFile &&
          onRemoveEcommerceProductFile &&
          onRemoveEcommerceExtraReferenceFile && (
            <div className="rounded-[22px] overflow-hidden">
              <EcommerceImportPanel
                requirementFileName={ecommerceRequirementFileName}
                productFileCount={ecommerceProductFileCount}
                extraReferenceCount={ecommerceExtraReferenceCount}
                productFiles={ecommerceProductFiles}
                extraReferenceFiles={ecommerceExtraReferenceFiles}
                analyzedProductName={ecommerceAnalysis?.projectMeta?.productName}
                isAnalyzing={ecommerceAnalyzing}
                hasAnalysis={!!ecommerceAnalysis}
                onPickRequirementFile={onPickEcommerceRequirementFile}
                onPickProductFiles={onPickEcommerceProductFiles}
                onPickExtraReferenceFiles={onPickEcommerceExtraReferenceFiles}
                onClearRequirementFile={onClearEcommerceRequirementFile}
                onRemoveProductFile={onRemoveEcommerceProductFile}
                onRemoveExtraReferenceFile={onRemoveEcommerceExtraReferenceFile}
                onAnalyzeFile={onAnalyzeEcommerceFile || (() => {})}
                onResetAnalysis={onResetEcommerceAnalysis}
              />
            </div>
          )}

        {/* 步骤二：分析预览及确认面板 */}
        {ecommerceAnalysis && !ecommerceAnalysisConfirmed && onConfirmEcommerceAnalysis && onToggleEcommerceSelection && (
          <div className="rounded-[22px] overflow-hidden border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/30 p-1">
            <EcommerceAnalysisReviewPanel
              analysis={ecommerceAnalysis}
              selection={ecommerceSelection}
              taskStates={ecommerceTaskStates}
              activeTaskState={ecommerceActiveTaskState}
              globalProductFiles={ecommerceProductFiles}
              globalExtraReferenceFiles={ecommerceExtraReferenceFiles}
              manualReferenceFilesByItem={ecommerceItemReferenceFiles}
              onPickManualReferenceFiles={onPickEcommerceItemReferenceFiles}
              onRemoveManualReferenceFile={onRemoveEcommerceItemReferenceFile}
              onToggleSelection={onToggleEcommerceSelection}
              onTaskStateChange={onChangeEcommerceTaskState}
              isConfirming={ecommerceConfirmingAnalysis}
              onConfirm={onConfirmEcommerceAnalysis}
            />
          </div>
        )}

        {/* 步骤三：同步确认后的分区任务编辑及管理 */}
        {(ecommerceAnalysisConfirmed || ecommerceActiveTaskState) && (
          <div className="space-y-4">
            {/* 分区切换卡片与任务状态 */}
            <div className="rounded-[22px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/40 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold">{pick('框架分区同步', 'Framework Sync')}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--mobile-clay-border)] text-[var(--text-tertiary)] bg-[var(--mobile-clay-surface-bg)]">
                  {ecommerceFrameworkSummary?.frameworkLabel || pick('已同步', 'Synced')}
                </span>
              </div>

              {/* 分区切换 Tabs */}
              {onActivateEcommerceGroupSheet && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(['主图', 'A+'] as EcommerceGroupSheet[]).map((sheet) => {
                    const isActive = resolvedGroupSheet === sheet;
                    return (
                      <button
                        key={sheet}
                        type="button"
                        onClick={() => onActivateEcommerceGroupSheet(sheet)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isActive
                            ? 'border-[var(--mobile-clay-active-border)] bg-[var(--mobile-clay-active-bg)] text-[var(--text-primary)] shadow-sm'
                            : 'border-transparent bg-[var(--mobile-clay-surface-bg)]/60 text-[var(--text-secondary)]'
                        }`}
                      >
                        {sheet} ({sheet === '主图' ? pick('5张主图', '5 main images') : pick('A+图', 'A+ modules')})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 任务列表流 */}
              {activeEntries.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                  {activeEntries.map((entry) => (
                    <div
                      key={entry.sourceKey}
                      onClick={() => onActivateEcommerceTaskBySourceKey?.(entry.sourceKey)}
                      className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition active:scale-[0.99] cursor-pointer ${
                        entry.isActive
                          ? 'border-[var(--mobile-clay-active-border)] bg-[var(--mobile-clay-active-bg)]/80'
                          : 'border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {/* 复选框勾选，决定是否批量生成 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleEcommerceSelection?.(entry.sourceKey, !entry.selected);
                            }}
                            className="shrink-0 text-[var(--text-secondary)] active:scale-90 transition"
                          >
                            {entry.selected ? (
                              <CheckSquare size={16} className="text-[var(--accent-color)]" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                          <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                            {entry.title}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[10px] text-[var(--text-secondary)]">
                          {entry.subtitle}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-[var(--text-tertiary)]">
                          <span>{entry.versionLabel}</span>
                          <span>•</span>
                          <span>{pick('历史', 'History')} {entry.historyCount}</span>
                        </div>
                      </div>

                      {/* 定位或激活状态小标 */}
                      <div className="flex items-center gap-1">
                        {entry.isActive ? (
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                            {pick('编辑中', 'Editing')}
                          </span>
                        ) : (
                          <span className="text-[9px] text-[var(--text-tertiary)] opacity-60">
                            {pick('点击编辑', 'Edit')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)] text-center py-4">
                  {pick('该分区暂无对应电商生成任务', 'No task in this section')}
                </p>
              )}
            </div>

            {/* 核心面板：当前激活的任务编辑 */}
            {ecommerceActiveTaskState && onChangeEcommerceTaskState && (
              <div className="rounded-[22px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-[var(--mobile-clay-border)] pb-2.5">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {pick('正在编辑分区任务', 'Active Task Editor')}
                    </h3>
                    <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                      {ecommerceActiveTaskState.displayLabel ||
                        ecommerceActiveTaskState.outputTypeLabel ||
                        ecommerceActiveTaskState.theme}
                      {ecommerceActiveTaskState.sourceRowKey
                        ? ` (${ecommerceActiveTaskState.sourceRowKey})`
                        : ''}
                    </p>
                  </div>
                  {onPreviewEcommerceSlotHistory &&
                    ecommerceGroupSlots[ecommerceActiveTaskState.sourceSheet]?.find(
                      (s) => s.sourceKey === ecommerceActiveTaskState.sourceRowKey
                    )?.currentImageId && (
                      <button
                        type="button"
                        onClick={() =>
                          onPreviewEcommerceSlotHistory(
                            ecommerceActiveTaskState.sourceSheet,
                            ecommerceActiveTaskState.sourceRowKey,
                            ecommerceGroupSlots[ecommerceActiveTaskState.sourceSheet]?.find(
                              (s) => s.sourceKey === ecommerceActiveTaskState.sourceRowKey
                            )?.currentImageId || undefined
                          )
                        }
                        className="inline-flex h-8 items-center justify-center rounded-xl border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/60 px-3 text-[10px] font-semibold text-[var(--text-secondary)] transition active:scale-95"
                      >
                        {pick('预览当前版本', 'Preview')}
                      </button>
                    )}
                </div>

                <div className="mobile-task-editor-wrapper">
                  <EcommerceTaskEditorPanel
                    taskState={ecommerceActiveTaskState}
                    onTaskStateChange={onChangeEcommerceTaskState}
                    collapsible={false}
                    defaultExpanded={true}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileEcommerceScreen;
