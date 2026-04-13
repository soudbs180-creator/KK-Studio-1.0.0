import React from 'react';

import { GenerationConfig, GenerationMode } from '../../../types';
import type { EcommerceAnalysisResult } from '../../../services/ecommerce/types.ts';
import EcommerceImportPanel from '../../ecommerce/EcommerceImportPanel';
import EcommerceAnalysisReviewPanel from '../../ecommerce/EcommerceAnalysisReviewPanel';

interface DesktopComposerEcommercePanelProps {
  config: GenerationConfig;
  requirementFileName?: string;
  productFileCount: number;
  extraReferenceCount: number;
  ecommerceAnalysis?: EcommerceAnalysisResult | null;
  ecommerceSelection: Record<string, boolean>;
  ecommerceAnalyzing: boolean;
  onPickRequirementFile?: (files: FileList | File[]) => void;
  onPickProductFiles?: (files: FileList | File[]) => void;
  onPickExtraReferenceFiles?: (files: FileList | File[]) => void;
  onAnalyzeFile: () => void;
  onResetAnalysis?: () => void;
  onConfirmAnalysis?: () => void;
  onToggleSelection?: (id: string, selected: boolean) => void;
}

const DesktopComposerEcommercePanel: React.FC<DesktopComposerEcommercePanelProps> = ({
  config,
  requirementFileName,
  productFileCount,
  extraReferenceCount,
  ecommerceAnalysis,
  ecommerceSelection,
  ecommerceAnalyzing,
  onPickRequirementFile,
  onPickProductFiles,
  onPickExtraReferenceFiles,
  onAnalyzeFile,
  onResetAnalysis,
  onConfirmAnalysis,
  onToggleSelection,
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
          onToggleSelection={onToggleSelection}
          onConfirm={onConfirmAnalysis}
        />
      ) : null}
    </>
  );
};

export default DesktopComposerEcommercePanel;
