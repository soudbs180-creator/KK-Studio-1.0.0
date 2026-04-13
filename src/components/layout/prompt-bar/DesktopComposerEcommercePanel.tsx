import React from 'react';

import {
  GenerationConfig,
  GenerationMode,
  type EcommerceEditableTaskState,
} from '../../../types';
import type { EcommerceAnalysisResult } from '../../../services/ecommerce/types.ts';
import EcommerceImportPanel from '../../ecommerce/EcommerceImportPanel';
import EcommerceAnalysisReviewPanel from '../../ecommerce/EcommerceAnalysisReviewPanel';
import EcommerceTaskEditorPanel from '../../ecommerce/EcommerceTaskEditorPanel';

interface DesktopComposerEcommercePanelProps {
  config: GenerationConfig;
  requirementFileName?: string;
  productFileCount: number;
  extraReferenceCount: number;
  ecommerceAnalysis?: EcommerceAnalysisResult | null;
  ecommerceSelection: Record<string, boolean>;
  taskStates?: Record<string, EcommerceEditableTaskState | undefined>;
  activeTaskState?: EcommerceEditableTaskState | null;
  ecommerceAnalyzing: boolean;
  onPickRequirementFile?: (files: FileList | File[]) => void;
  onPickProductFiles?: (files: FileList | File[]) => void;
  onPickExtraReferenceFiles?: (files: FileList | File[]) => void;
  onAnalyzeFile: () => void;
  onResetAnalysis?: () => void;
  onConfirmAnalysis?: () => void;
  onToggleSelection?: (id: string, selected: boolean) => void;
  onTaskStateChange?: (
    taskId: string,
    updater:
      | EcommerceEditableTaskState
      | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState),
  ) => void;
}

const DesktopComposerEcommercePanel: React.FC<DesktopComposerEcommercePanelProps> = ({
  config,
  requirementFileName,
  productFileCount,
  extraReferenceCount,
  ecommerceAnalysis,
  ecommerceSelection,
  taskStates = {},
  activeTaskState = null,
  ecommerceAnalyzing,
  onPickRequirementFile,
  onPickProductFiles,
  onPickExtraReferenceFiles,
  onAnalyzeFile,
  onResetAnalysis,
  onConfirmAnalysis,
  onToggleSelection,
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

  return (
    <>
      <EcommerceImportPanel
        requirementFileName={requirementFileName}
        productFileCount={productFileCount}
        extraReferenceCount={extraReferenceCount}
        isAnalyzing={ecommerceAnalyzing}
        hasAnalysis={!!ecommerceAnalysis}
        onPickRequirementFile={onPickRequirementFile}
        onPickProductFiles={onPickProductFiles}
        onPickExtraReferenceFiles={onPickExtraReferenceFiles}
        onAnalyzeFile={onAnalyzeFile}
        onResetAnalysis={() => onResetAnalysis?.()}
      />

      {ecommerceAnalysis && onConfirmAnalysis && onToggleSelection ? (
        <EcommerceAnalysisReviewPanel
          analysis={ecommerceAnalysis}
          selection={ecommerceSelection}
          taskStates={taskStates}
          activeTaskState={activeTaskState}
          onToggleSelection={onToggleSelection}
          onTaskStateChange={onTaskStateChange}
          onConfirm={onConfirmAnalysis}
        />
      ) : null}

      {!ecommerceAnalysis && activeTaskState && onTaskStateChange ? (
        <div className="mb-2 rounded-xl border p-3" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)' }}>
          <div className="mb-2">
            <div className="text-sm font-semibold text-[var(--text-primary)]">当前电商任务</div>
            <div className="text-xs text-[var(--text-secondary)]">
              修改少量字段后，直接回到卡片点击“生成主图”或“生成模块”即可按当前任务状态重跑。
            </div>
          </div>
          <EcommerceTaskEditorPanel
            taskState={activeTaskState}
            onTaskStateChange={onTaskStateChange}
          />
        </div>
      ) : null}
    </>
  );
};

export default DesktopComposerEcommercePanel;
