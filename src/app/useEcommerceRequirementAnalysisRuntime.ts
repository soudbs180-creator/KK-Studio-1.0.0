import { useCallback } from 'react';

import type { EcommerceGroupSlotState } from '../services/ecommerce/groupSlotState.ts';
import type { EcommerceAnalysisResult } from '../services/ecommerce/types.ts';
import type { EcommerceEditableTaskState, EcommerceGroupSheet } from '../types.ts';
import type { EcommerceManualReferenceBinding } from './useEcommerceUploadReferenceRuntime.ts';

export interface EcommerceRequirementAnalysisRuntimeState {
  requirementFile: File | null;
  productFiles: File[];
  itemReferenceFiles: Record<string, EcommerceManualReferenceBinding[]>;
  analysis: EcommerceAnalysisResult | null;
  analysisConfirmed: boolean;
  selectedItems: Record<string, boolean>;
  taskStates: Record<string, EcommerceEditableTaskState>;
  groupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
  activeGroupSheet: EcommerceGroupSheet | null;
  isAnalyzing: boolean;
  isConfirmingAnalysis: boolean;
}

export type SetEcommerceRequirementAnalysisState = (
  updater: (previousState: EcommerceRequirementAnalysisRuntimeState) => Partial<EcommerceRequirementAnalysisRuntimeState> | null
) => void;

export type BuildInitialEcommerceTaskStates = (
  analysis: EcommerceAnalysisResult
) => Record<string, EcommerceEditableTaskState>;

export interface UseEcommerceRequirementAnalysisRuntimeDeps {
  ecommerceState: Pick<EcommerceRequirementAnalysisRuntimeState, 'requirementFile' | 'productFiles'>;
  enablePromptOptimization: boolean;
  readBlobAsDataUrl: (blob: Blob) => Promise<string>;
  analyzeRequirementFile: (file: File) => Promise<EcommerceAnalysisResult>;
  buildInitialEcommerceTaskStates: BuildInitialEcommerceTaskStates;
  setEcommerceRequirementAnalysisState: SetEcommerceRequirementAnalysisState;
}

export interface UseEcommerceRequirementAnalysisRuntimeResult {
  handlePickEcommerceRequirementFile: (files: FileList | File[]) => void;
  handleClearEcommerceRequirementFile: () => void;
  handleResetEcommerceAnalysis: () => void;
  handleAnalyzeEcommerceRequirement: () => Promise<void>;
}

export type NotifyEcommerceAnalysis = (
  level: 'warning' | 'success' | 'error',
  title: string,
  message: string
) => Promise<void>;

export type EnhanceEcommerceAnalysisWithAI = (
  analysis: EcommerceAnalysisResult,
  productImageData: Array<{ mimeType: string; data: string }>
) => Promise<EcommerceAnalysisResult>;

export interface RunEcommerceRequirementAnalysisDeps {
  ecommerceState: Pick<EcommerceRequirementAnalysisRuntimeState, 'requirementFile' | 'productFiles'>;
  enablePromptOptimization: boolean;
  readBlobAsDataUrl: (blob: Blob) => Promise<string>;
  analyzeRequirementFile: (file: File) => Promise<EcommerceAnalysisResult>;
  enhanceAnalysisWithAI: EnhanceEcommerceAnalysisWithAI;
  buildInitialEcommerceTaskStates: BuildInitialEcommerceTaskStates;
  setEcommerceRequirementAnalysisState: SetEcommerceRequirementAnalysisState;
  notifyEcommerceAnalysis: NotifyEcommerceAnalysis;
}

export function createEmptyEcommerceGroupSlots(): Record<EcommerceGroupSheet, EcommerceGroupSlotState[]> {
  return {
    '\u4e3b\u56fe': [],
    'A+': [],
  };
}

export function createEcommerceAnalysisResetPatch(
  options: {
    isAnalyzing?: boolean;
    requirementFile?: File | null;
  } = {},
): Partial<EcommerceRequirementAnalysisRuntimeState> {
  const patch: Partial<EcommerceRequirementAnalysisRuntimeState> = {
    itemReferenceFiles: {},
    analysis: null,
    analysisConfirmed: false,
    selectedItems: {},
    taskStates: {},
    groupSlots: createEmptyEcommerceGroupSlots(),
    activeTaskNodeId: null,
    activeTaskState: null,
    activeGroupSheet: null,
    isConfirmingAnalysis: false,
  };

  if ('requirementFile' in options) {
    patch.requirementFile = options.requirementFile ?? null;
  }

  if ('isAnalyzing' in options) {
    patch.isAnalyzing = options.isAnalyzing ?? false;
  }

  return patch;
}

export function buildEcommerceAnalysisSelectedItems(
  analysis: EcommerceAnalysisResult,
): Record<string, boolean> {
  const selectedItems: Record<string, boolean> = {};
  (analysis.mainImageItems || []).forEach((item) => {
    selectedItems[item.itemId] = true;
  });
  (analysis.aPlusGroup?.modules || []).forEach((module) => {
    selectedItems[module.moduleId] = true;
  });
  return selectedItems;
}

export function buildEcommerceAnalysisCounts(analysis: EcommerceAnalysisResult): {
  mainImageCount: number;
  aPlusModuleCount: number;
} {
  return {
    mainImageCount: (analysis.mainImageItems || []).length,
    aPlusModuleCount: (analysis.aPlusGroup?.modules || []).length,
  };
}

export function normalizeEcommerceAnalysisResult(
  analysis: EcommerceAnalysisResult,
): EcommerceAnalysisResult {
  const aPlusGroup = analysis.aPlusGroup || {
    groupId: 'aplus',
    title: 'A+',
    modules: [],
    groupWarnings: [],
  };

  return {
    ...analysis,
    assets: {
      productAssets: analysis.assets?.productAssets || [],
      referenceAssets: analysis.assets?.referenceAssets || [],
    },
    mainImageItems: analysis.mainImageItems || [],
    aPlusGroup: {
      ...aPlusGroup,
      modules: aPlusGroup.modules || [],
      groupWarnings: aPlusGroup.groupWarnings || [],
    },
    reviewWarnings: analysis.reviewWarnings || [],
  };
}

export function buildEcommerceAnalysisSuccessPatch(input: {
  analysis: EcommerceAnalysisResult;
  buildInitialEcommerceTaskStates: BuildInitialEcommerceTaskStates;
}): Partial<EcommerceRequirementAnalysisRuntimeState> {
  const analysis = normalizeEcommerceAnalysisResult(input.analysis);
  const { buildInitialEcommerceTaskStates } = input;
  return {
    analysis,
    analysisConfirmed: false,
    selectedItems: buildEcommerceAnalysisSelectedItems(analysis),
    taskStates: buildInitialEcommerceTaskStates(analysis),
    groupSlots: createEmptyEcommerceGroupSlots(),
    activeTaskNodeId: null,
    activeTaskState: null,
    activeGroupSheet: null,
    isAnalyzing: false,
    isConfirmingAnalysis: false,
  };
}

export async function buildEcommerceProductImageData(input: {
  productFiles?: File[];
  readBlobAsDataUrl: (blob: Blob) => Promise<string>;
}): Promise<Array<{ mimeType: string; data: string }>> {
  const productFiles = input.productFiles || [];
  return Promise.all(
    productFiles.map(async (file) => {
      const dataUrl = await input.readBlobAsDataUrl(file);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      return {
        mimeType: match?.[1] || file.type || 'image/png',
        data: match?.[2] || dataUrl,
      };
    }),
  );
}

async function notifyEcommerceAnalysis(
  level: 'warning' | 'success' | 'error',
  title: string,
  message: string,
): Promise<void> {
  const { notify } = await import('../services/system/notificationService');
  notify[level](title, message);
}

async function enhanceEcommerceAnalysisWithDefaultAI(
  analysis: EcommerceAnalysisResult,
  productImageData: Array<{ mimeType: string; data: string }>,
): Promise<EcommerceAnalysisResult> {
  const { enhanceAnalysisWithAI } = await import('../services/ecommerce/ecommerceAnalysisEnhancer');
  return enhanceAnalysisWithAI(analysis, productImageData);
}

export async function runEcommerceRequirementAnalysis({
  ecommerceState,
  enablePromptOptimization,
  readBlobAsDataUrl,
  analyzeRequirementFile,
  enhanceAnalysisWithAI,
  buildInitialEcommerceTaskStates,
  setEcommerceRequirementAnalysisState,
  notifyEcommerceAnalysis: notifyAnalysis,
}: RunEcommerceRequirementAnalysisDeps): Promise<void> {
  const requirementFile = ecommerceState.requirementFile;
  if (!requirementFile) {
    await notifyAnalysis('warning', '\u7f3a\u5c11\u9700\u6c42\u5355', '\u8bf7\u5148\u4e0a\u4f20\u8fd0\u8425\u9700\u6c42\u6587\u4ef6\u3002');
    return;
  }

  setEcommerceRequirementAnalysisState(() => ({ isAnalyzing: true }));
  try {
    let analysis = normalizeEcommerceAnalysisResult(await analyzeRequirementFile(requirementFile));

    if (enablePromptOptimization && (ecommerceState.productFiles || []).length > 0) {
      try {
        const productImageData = await buildEcommerceProductImageData({
          productFiles: ecommerceState.productFiles,
          readBlobAsDataUrl,
        });
        analysis = normalizeEcommerceAnalysisResult(await enhanceAnalysisWithAI(analysis, productImageData));
      } catch (enhanceError) {
        console.warn('[ecommerce] AI enhancement failed, using template analysis', enhanceError);
      }
    }

    setEcommerceRequirementAnalysisState(() => buildEcommerceAnalysisSuccessPatch({
      analysis,
      buildInitialEcommerceTaskStates,
    }));
    const counts = buildEcommerceAnalysisCounts(analysis);
    await notifyAnalysis(
      'success',
      '\u5206\u6790\u5b8c\u6210',
      `\u5df2\u89e3\u6790\u4e3b\u56fe ${counts.mainImageCount} \u6761\uff0cA+ ${counts.aPlusModuleCount} \u6761\u3002`,
    );
  } catch (error: unknown) {
    setEcommerceRequirementAnalysisState(() => ({
      isAnalyzing: false,
      isConfirmingAnalysis: false,
    }));
    await notifyAnalysis(
      'error',
      '\u5206\u6790\u5931\u8d25',
      error instanceof Error ? error.message : '\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
    );
  }
}

export function useEcommerceRequirementAnalysisRuntime({
  ecommerceState,
  enablePromptOptimization,
  readBlobAsDataUrl,
  analyzeRequirementFile,
  buildInitialEcommerceTaskStates,
  setEcommerceRequirementAnalysisState,
}: UseEcommerceRequirementAnalysisRuntimeDeps): UseEcommerceRequirementAnalysisRuntimeResult {
  const handlePickEcommerceRequirementFile = useCallback((files: FileList | File[]): void => {
    const [file] = Array.from(files || []);
    if (!file) return;
    setEcommerceRequirementAnalysisState(() => createEcommerceAnalysisResetPatch({ requirementFile: file }));
  }, [setEcommerceRequirementAnalysisState]);

  const handleClearEcommerceRequirementFile = useCallback((): void => {
    setEcommerceRequirementAnalysisState(() => createEcommerceAnalysisResetPatch({
      requirementFile: null,
      isAnalyzing: false,
    }));
  }, [setEcommerceRequirementAnalysisState]);

  const handleResetEcommerceAnalysis = useCallback((): void => {
    setEcommerceRequirementAnalysisState(() => createEcommerceAnalysisResetPatch({ isAnalyzing: false }));
  }, [setEcommerceRequirementAnalysisState]);

  const handleAnalyzeEcommerceRequirement = useCallback(async (): Promise<void> => {
    await runEcommerceRequirementAnalysis({
      ecommerceState,
      enablePromptOptimization,
      readBlobAsDataUrl,
      analyzeRequirementFile,
      enhanceAnalysisWithAI: enhanceEcommerceAnalysisWithDefaultAI,
      buildInitialEcommerceTaskStates,
      setEcommerceRequirementAnalysisState,
      notifyEcommerceAnalysis,
    });
  }, [
    buildInitialEcommerceTaskStates,
    ecommerceState.productFiles,
    ecommerceState.requirementFile,
    enablePromptOptimization,
    analyzeRequirementFile,
    readBlobAsDataUrl,
    setEcommerceRequirementAnalysisState,
  ]);

  return {
    handlePickEcommerceRequirementFile,
    handleClearEcommerceRequirementFile,
    handleResetEcommerceAnalysis,
    handleAnalyzeEcommerceRequirement,
  };
}
