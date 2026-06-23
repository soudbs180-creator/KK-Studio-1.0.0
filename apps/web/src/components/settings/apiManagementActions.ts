type ApiManagementActionDefinition = {
  uiAction: `api-management.${string}`;
};

export const API_MANAGEMENT_ACTIONS = {
  addOfficialApi: {
    uiAction: 'api-management.addOfficialApi',
  },
  addProviderRoute: {
    uiAction: 'api-management.addProviderRoute',
  },
  copyRouteId: {
    uiAction: 'api-management.copyRouteId',
  },
  toggleRoute: {
    uiAction: 'api-management.toggleRoute',
  },
  refreshRoute: {
    uiAction: 'api-management.refreshRoute',
  },
  editRoute: {
    uiAction: 'api-management.editRoute',
  },
  deleteRoute: {
    uiAction: 'api-management.deleteRoute',
  },
  switchPresetDirectoryTab: {
    uiAction: 'api-management.switchPresetDirectoryTab',
  },
  applyProviderPreset: {
    uiAction: 'api-management.applyProviderPreset',
  },
  toggleCapabilityRole: {
    uiAction: 'api-management.toggleCapabilityRole',
  },
  updateCapabilityPrimaryRoute: {
    uiAction: 'api-management.updateCapabilityPrimaryRoute',
  },
  updateCapabilityPrimaryModel: {
    uiAction: 'api-management.updateCapabilityPrimaryModel',
  },
  updateCapabilityFallbackRoute: {
    uiAction: 'api-management.updateCapabilityFallbackRoute',
  },
  updateCapabilityFallbackModel: {
    uiAction: 'api-management.updateCapabilityFallbackModel',
  },
  updateCapabilityAuxiliaryRoute: {
    uiAction: 'api-management.updateCapabilityAuxiliaryRoute',
  },
  updateCapabilityAuxiliaryModel: {
    uiAction: 'api-management.updateCapabilityAuxiliaryModel',
  },
  updateCapabilityImageRoute: {
    uiAction: 'api-management.updateCapabilityImageRoute',
  },
  updateCapabilityImageModel: {
    uiAction: 'api-management.updateCapabilityImageModel',
  },
  updateCapabilityImageFallbackRoute: {
    uiAction: 'api-management.updateCapabilityImageFallbackRoute',
  },
  updateCapabilityImageFallbackModel: {
    uiAction: 'api-management.updateCapabilityImageFallbackModel',
  },
  openCapabilityOcrConfig: {
    uiAction: 'api-management.openCapabilityOcrConfig',
  },
  syncEditorModels: {
    uiAction: 'api-management.syncEditorModels',
  },
  copyModelId: {
    uiAction: 'api-management.copyModelId',
  },
  backToModelCenter: {
    uiAction: 'api-management.backToModelCenter',
  },
  saveOfficialEndpoint: {
    uiAction: 'api-management.saveOfficialEndpoint',
  },
  resetOfficialDraft: {
    uiAction: 'api-management.resetOfficialDraft',
  },
  deleteOfficialEndpoint: {
    uiAction: 'api-management.deleteOfficialEndpoint',
  },
  syncWuyinCatalog: {
    uiAction: 'api-management.syncWuyinCatalog',
  },
  saveProviderRoute: {
    uiAction: 'api-management.saveProviderRoute',
  },
  resetProviderDraft: {
    uiAction: 'api-management.resetProviderDraft',
  },
  deleteProviderRoute: {
    uiAction: 'api-management.deleteProviderRoute',
  },
  searchModels: {
    uiAction: 'api-management.searchModels',
  },
  clearSearchQuery: {
    uiAction: 'api-management.clearSearchQuery',
  },
  clearAllFilters: {
    uiAction: 'api-management.clearAllFilters',
  },
  toggleTypeFilter: {
    uiAction: 'api-management.toggleTypeFilter',
  },
  toggleBrandFilter: {
    uiAction: 'api-management.toggleBrandFilter',
  },
  changeGroupBy: {
    uiAction: 'api-management.changeGroupBy',
  },
  toggleGroupCollapse: {
    uiAction: 'api-management.toggleGroupCollapse',
  },
} as const satisfies Record<string, ApiManagementActionDefinition>;

export type ApiManagementActionKey = keyof typeof API_MANAGEMENT_ACTIONS;
export type ApiManagementUiAction = typeof API_MANAGEMENT_ACTIONS[ApiManagementActionKey]['uiAction'];
