// 简体中文：PromptBar / 生成输入栏按钮与 ToolRegistry 工具的稳定动作目录。
type PromptComposerActionDefinition = {
  uiAction: string;
  toolName?: string;
};

export const PROMPT_COMPOSER_ACTIONS = {
  expandMobileComposer: {
    uiAction: 'prompt-composer-expand-mobile',
    toolName: undefined,
  },
  collapseMobileComposer: {
    uiAction: 'prompt-composer-collapse-mobile',
    toolName: undefined,
  },
  openModelLibrary: {
    uiAction: 'prompt-composer-open-model-library',
    toolName: undefined,
  },
  selectModel: {
    uiAction: 'prompt-composer-select-model',
    toolName: undefined,
  },
  toggleModelPin: {
    uiAction: 'prompt-composer-toggle-model-pin',
    toolName: undefined,
  },
  openModelCustomization: {
    uiAction: 'prompt-composer-open-model-customization',
    toolName: undefined,
  },
  closeModelCustomization: {
    uiAction: 'prompt-composer-close-model-customization',
    toolName: undefined,
  },
  cancelModelCustomization: {
    uiAction: 'prompt-composer-cancel-model-customization',
    toolName: undefined,
  },
  saveModelCustomization: {
    uiAction: 'prompt-composer-save-model-customization',
    toolName: undefined,
  },
  clearModelSearch: {
    uiAction: 'prompt-composer-clear-model-search',
    toolName: undefined,
  },
  openProviderModels: {
    uiAction: 'prompt-composer-open-provider-models',
    toolName: undefined,
  },
  closeProviderModels: {
    uiAction: 'prompt-composer-close-provider-models',
    toolName: undefined,
  },
  toggleMode: {
    uiAction: 'prompt-composer-toggle-mode',
    toolName: undefined,
  },
  selectMobileMode: {
    uiAction: 'prompt-composer-select-mobile-mode',
    toolName: undefined,
  },
  toggleAdvancedOptions: {
    uiAction: 'prompt-composer-toggle-advanced-options',
    toolName: undefined,
  },
  toggleGrounding: {
    uiAction: 'prompt-composer-toggle-grounding',
    toolName: undefined,
  },
  toggleImageSearch: {
    uiAction: 'prompt-composer-toggle-image-search',
    toolName: undefined,
  },
  selectAudioDuration: {
    uiAction: 'prompt-composer-select-audio-duration',
    toolName: undefined,
  },
  selectParallelCount: {
    uiAction: 'prompt-composer-select-parallel-count',
    toolName: undefined,
  },
  toggleParallelCountMenu: {
    uiAction: 'prompt-composer-toggle-parallel-count-menu',
    toolName: undefined,
  },
  togglePromptOptimization: {
    uiAction: 'prompt-composer-toggle-prompt-optimization',
    toolName: undefined,
  },
  selectPromptOptimizerArchetype: {
    uiAction: 'prompt-composer-select-prompt-optimizer-archetype',
    toolName: undefined,
  },
  togglePptOutline: {
    uiAction: 'prompt-composer-toggle-ppt-outline',
    toolName: undefined,
  },
  togglePptStyleLock: {
    uiAction: 'prompt-composer-toggle-ppt-style-lock',
    toolName: undefined,
  },
  appendPptTemplateSlide: {
    uiAction: 'prompt-composer-append-ppt-template-slide',
    toolName: undefined,
  },
  movePptSlide: {
    uiAction: 'prompt-composer-move-ppt-slide',
    toolName: undefined,
  },
  removePptSlide: {
    uiAction: 'prompt-composer-remove-ppt-slide',
    toolName: undefined,
  },
  insertPptSlide: {
    uiAction: 'prompt-composer-insert-ppt-slide',
    toolName: undefined,
  },
  importPptOutline: {
    uiAction: 'prompt-composer-import-ppt-outline',
    toolName: undefined,
  },
  generatePptOutline: {
    uiAction: 'prompt-composer-generate-ppt-outline',
    toolName: undefined,
  },
  exportPptOutline: {
    uiAction: 'prompt-composer-export-ppt-outline',
    toolName: undefined,
  },
  clearPptOutline: {
    uiAction: 'prompt-composer-clear-ppt-outline',
    toolName: undefined,
  },
  applyPptOutline: {
    uiAction: 'prompt-composer-apply-ppt-outline',
    toolName: undefined,
  },
  refinePptOutline: {
    uiAction: 'prompt-composer-refine-ppt-outline',
    toolName: undefined,
  },
  clearSource: {
    uiAction: 'prompt-composer-clear-source',
    toolName: undefined,
  },
  removeReferenceImage: {
    uiAction: 'prompt-composer-remove-reference-image',
    toolName: undefined,
  },
  addReferenceImage: {
    uiAction: 'prompt-composer-add-reference-image',
    toolName: undefined,
  },
  submitGeneration: {
    uiAction: 'prompt-composer-submit-generation',
    toolName: 'generation.submitComposer',
  },
} as const satisfies Record<string, PromptComposerActionDefinition>;

export type PromptComposerActionKey = keyof typeof PROMPT_COMPOSER_ACTIONS;
export type PromptComposerUiAction = typeof PROMPT_COMPOSER_ACTIONS[PromptComposerActionKey]['uiAction'];
type PromptComposerActionWithTool = Extract<typeof PROMPT_COMPOSER_ACTIONS[PromptComposerActionKey], { toolName: string }>;
export type PromptComposerToolName = PromptComposerActionWithTool extends never ? never : PromptComposerActionWithTool['toolName'];
