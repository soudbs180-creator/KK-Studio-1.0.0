import React from 'react';

import { GenerationMode, type Canvas, type EcommerceFrameworkRuntimeState } from '../types';
import type { AppPromptBarProps } from './AppPromptComposer';
import { resolveEcommerceFrameworkSummary } from '../services/ecommerce/frameworkRuntime.ts';

interface AppPromptBarEcommerceRuntimeState {
  requirementFile: File | null;
  productFiles: File[];
  extraReferenceFiles: File[];
  itemReferenceFiles: NonNullable<AppPromptBarProps['ecommerceItemReferenceFiles']>;
  analysis: AppPromptBarProps['ecommerceAnalysis'];
  selectedItems: NonNullable<AppPromptBarProps['ecommerceSelection']>;
  taskStates: NonNullable<AppPromptBarProps['ecommerceTaskStates']>;
  groupSlots: NonNullable<AppPromptBarProps['ecommerceGroupSlots']>;
  activeTaskState: AppPromptBarProps['ecommerceActiveTaskState'];
  sheetSettings: AppPromptBarProps['ecommerceSheetSettings'];
  analysisConfirmed: boolean;
  isConfirmingAnalysis: boolean;
  activeGroupSheet: AppPromptBarProps['ecommerceActiveGroupSheet'];
  activeFrameworkId: string | null;
  frameworkRuntime: Record<string, EcommerceFrameworkRuntimeState>;
  isAnalyzing: boolean;
}

type AppPromptBarCoreBindings = Pick<AppPromptBarProps,
  | 'config'
  | 'setConfig'
  | 'isGenerating'
  | 'onUiBusyChange'
  | 'onGenerate'
  | 'onCancel'
  | 'onFilesDrop'
  | 'onClearSource'
> & {
  activeCanvas: Canvas | null | undefined;
  activeSourceImageId: string | null;
  isMobile: boolean;
  ecommerceState: AppPromptBarEcommerceRuntimeState;
  ecommerceRatioOverride: AppPromptBarProps['ecommerceRatioOverride'];
  openSettingsSurface: (view: 'dashboard' | 'api-management') => void;
  handleShowMobileNav: () => void;
  handleHideMobileNav: () => void;
  setIsPromptFocused: React.Dispatch<React.SetStateAction<boolean>>;
} & Required<Pick<AppPromptBarProps,
  | 'onPickEcommerceRequirementFile'
  | 'onPickEcommerceProductFiles'
  | 'onPickEcommerceExtraReferenceFiles'
  | 'onClearEcommerceRequirementFile'
  | 'onRemoveEcommerceProductFile'
  | 'onRemoveEcommerceExtraReferenceFile'
  | 'onPickEcommerceItemReferenceFiles'
  | 'onRemoveEcommerceItemReferenceFile'
  | 'onResetEcommerceAnalysis'
  | 'onConfirmEcommerceAnalysis'
  | 'onToggleEcommerceSelection'
  | 'onActivateEcommerceGroupSheet'
  | 'onActivateEcommerceTaskBySourceKey'
  | 'onUpdateEcommerceSheetSetting'
  | 'onChangeEcommerceTaskState'
  | 'onPreviewEcommerceSlotHistory'
  | 'onAnalyzeEcommerceFile'
>>;

interface AppPromptBarPropsBundle {
  desktopPromptBarProps: AppPromptBarProps;
  mobilePromptBarProps: AppPromptBarProps;
}

export function useAppPromptBarProps({
  config,
  setConfig,
  isGenerating,
  onUiBusyChange,
  onGenerate,
  onCancel,
  onFilesDrop,
  activeCanvas,
  activeSourceImageId,
  onClearSource,
  isMobile,
  ecommerceState,
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
  onUpdateEcommerceSheetSetting,
  onChangeEcommerceTaskState,
  onPreviewEcommerceSlotHistory,
  ecommerceRatioOverride,
  onAnalyzeEcommerceFile,
  openSettingsSurface,
  handleShowMobileNav,
  handleHideMobileNav,
  setIsPromptFocused,
}: AppPromptBarCoreBindings): AppPromptBarPropsBundle {
  const promptBarSourceImage = React.useMemo<AppPromptBarProps['activeSourceImage']>(() => {
    if (!activeSourceImageId) {
      return null;
    }

    const sourceNode = activeCanvas?.imageNodes.find((node) => node.id === activeSourceImageId);
    if (!sourceNode) {
      return null;
    }

    return {
      id: activeSourceImageId,
      url: sourceNode.url,
      prompt: sourceNode.prompt,
    };
  }, [activeCanvas, activeSourceImageId]);

  const ecommerceFrameworkSummary = React.useMemo(() => {
    if (!activeCanvas || !ecommerceState.activeFrameworkId) {
      return undefined;
    }

    return resolveEcommerceFrameworkSummary(
      activeCanvas.promptNodes || [],
      ecommerceState.activeFrameworkId,
      ecommerceState.frameworkRuntime[ecommerceState.activeFrameworkId],
    );
  }, [activeCanvas, ecommerceState.activeFrameworkId, ecommerceState.frameworkRuntime]);

  const commonPromptBarProps = React.useMemo(() => ({
    config,
    setConfig,
    isGenerating,
    onUiBusyChange,
    onGenerate,
    onCancel,
    onFilesDrop,
    activeSourceImage: promptBarSourceImage,
    onClearSource,
    isMobile,
    sendLabel: config.mode === GenerationMode.ECOMMERCE ? '确认' : '发送',
    ecommerceRequirementFileName: ecommerceState.requirementFile?.name,
    ecommerceProductFileCount: ecommerceState.productFiles.length,
    ecommerceExtraReferenceCount: ecommerceState.extraReferenceFiles.length,
    ecommerceProductFiles: ecommerceState.productFiles,
    ecommerceExtraReferenceFiles: ecommerceState.extraReferenceFiles,
    ecommerceItemReferenceFiles: ecommerceState.itemReferenceFiles,
    ecommerceAnalysis: ecommerceState.analysis,
    ecommerceSelection: ecommerceState.selectedItems,
    ecommerceTaskStates: ecommerceState.taskStates,
    ecommerceGroupSlots: ecommerceState.groupSlots,
    ecommerceActiveTaskState: ecommerceState.activeTaskState,
    ecommerceActiveFrameworkId: ecommerceState.activeFrameworkId,
    ecommerceFrameworkSummary,
    ecommerceSheetSettings: ecommerceState.sheetSettings,
    ecommerceAnalysisConfirmed: ecommerceState.analysisConfirmed,
    ecommerceConfirmingAnalysis: ecommerceState.isConfirmingAnalysis,
    ecommerceActiveGroupSheet: ecommerceState.activeGroupSheet,
    ecommerceAnalyzing: ecommerceState.isAnalyzing,
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
    onUpdateEcommerceSheetSetting,
    onChangeEcommerceTaskState,
    onPreviewEcommerceSlotHistory,
    ecommerceRatioOverride,
    onAnalyzeEcommerceFile,
  }) satisfies AppPromptBarProps, [
    config,
    setConfig,
    isGenerating,
    onUiBusyChange,
    onGenerate,
    onCancel,
    onFilesDrop,
    promptBarSourceImage,
    onClearSource,
    isMobile,
    ecommerceState,
    ecommerceFrameworkSummary,
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
    onUpdateEcommerceSheetSetting,
    onChangeEcommerceTaskState,
    onPreviewEcommerceSlotHistory,
    ecommerceRatioOverride,
    onAnalyzeEcommerceFile,
  ]);

  const mobilePromptBarProps = React.useMemo(() => ({
    ...commonPromptBarProps,
    mobileShellMode: 'embedded',
    onOpenSettings: (view) => {
      openSettingsSurface(view === 'api-management' ? 'api-management' : 'dashboard');
    },
    onFocus: () => setIsPromptFocused(true),
    onBlur: () => setIsPromptFocused(false),
  }) satisfies AppPromptBarProps, [
    commonPromptBarProps,
    openSettingsSurface,
    setIsPromptFocused,
  ]);

  const desktopPromptBarProps = React.useMemo(() => ({
    ...commonPromptBarProps,
    onOpenSettings: (view) => {
      openSettingsSurface(view || 'api-management');
      handleHideMobileNav();
    },
    onInteract: handleShowMobileNav,
    onFocus: () => {
      console.log('[PromptBar] onFocus - 设置isPromptFocused=true');
      setIsPromptFocused(true);
    },
    onBlur: () => {
      console.log('[PromptBar] onBlur - 设置isPromptFocused=false');
      setIsPromptFocused(false);
      setTimeout(() => handleShowMobileNav(), 0);
    },
  }) satisfies AppPromptBarProps, [
    commonPromptBarProps,
    openSettingsSurface,
    handleHideMobileNav,
    handleShowMobileNav,
    setIsPromptFocused,
  ]);

  return {
    desktopPromptBarProps,
    mobilePromptBarProps,
  };
}
