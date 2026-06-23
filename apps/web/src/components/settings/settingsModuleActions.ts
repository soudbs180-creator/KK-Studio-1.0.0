type SettingsModuleActionDefinition<TPrefix extends string> = {
  uiAction: `${TPrefix}.${string}`;
};

export const SETTINGS_DASHBOARD_ACTIONS = {
  openPrimaryModule: {
    uiAction: 'settings-dashboard.openPrimaryModule',
  },
  openConsumptionRecords: {
    uiAction: 'settings-dashboard.openConsumptionRecords',
  },
  openApiManagement: {
    uiAction: 'settings-dashboard.openApiManagement',
  },
  openBrowserAssistant: {
    uiAction: 'settings-dashboard.openBrowserAssistant',
  },
  openStorageSettings: {
    uiAction: 'settings-dashboard.openStorageSettings',
  },
  openSystemLogs: {
    uiAction: 'settings-dashboard.openSystemLogs',
  },
  openAiManagement: {
    uiAction: 'settings-dashboard.openAiManagement',
  },
} as const satisfies Record<string, SettingsModuleActionDefinition<'settings-dashboard'>>;

export const STORAGE_SETTINGS_ACTIONS = {
  switchToLocalMode: {
    uiAction: 'storage-settings.switchToLocalMode',
  },
  switchToBrowserMode: {
    uiAction: 'storage-settings.switchToBrowserMode',
  },
  refreshUsage: {
    uiAction: 'storage-settings.refreshUsage',
  },
  cleanBrokenCards: {
    uiAction: 'storage-settings.cleanBrokenCards',
  },
  applyRetention30Days: {
    uiAction: 'storage-settings.applyRetention30Days',
  },
  applyRetention7Days: {
    uiAction: 'storage-settings.applyRetention7Days',
  },
  clearAllData: {
    uiAction: 'storage-settings.clearAllData',
  },
  selectMergeSource: {
    uiAction: 'storage-settings.selectMergeSource',
  },
  mergeProject: {
    uiAction: 'storage-settings.mergeProject',
  },
  cleanProjectCards: {
    uiAction: 'storage-settings.cleanProjectCards',
  },
} as const satisfies Record<string, SettingsModuleActionDefinition<'storage-settings'>>;

export const SYSTEM_LOGS_ACTIONS = {
  changeLevelFilter: {
    uiAction: 'system-logs.changeLevelFilter',
  },
  changeSourceFilter: {
    uiAction: 'system-logs.changeSourceFilter',
  },
  toggleStream: {
    uiAction: 'system-logs.toggleStream',
  },
  exportLogs: {
    uiAction: 'system-logs.exportLogs',
  },
  clearFilters: {
    uiAction: 'system-logs.clearFilters',
  },
  toggleConsoleOption: {
    uiAction: 'system-logs.toggleConsoleOption',
  },
  clearLogCache: {
    uiAction: 'system-logs.clearLogCache',
  },
} as const satisfies Record<string, SettingsModuleActionDefinition<'system-logs'>>;

export const SETTINGS_SHELL_ACTIONS = {
  refreshCurrentView: {
    uiAction: 'settings-shell.refreshCurrentView',
  },
  closeWorkbench: {
    uiAction: 'settings-shell.closeWorkbench',
  },
  navigateModule: {
    uiAction: 'settings-shell.navigateModule',
  },
  filterNavigation: {
    uiAction: 'settings-shell.filterNavigation',
  },
} as const satisfies Record<string, SettingsModuleActionDefinition<'settings-shell'>>;


export const PROJECT_MANAGER_ACTIONS = {
  openProjectMenu: {
    uiAction: 'project-manager.openProjectMenu',
  },
  selectProject: {
    uiAction: 'project-manager.selectProject',
  },
  renameProject: {
    uiAction: 'project-manager.renameProject',
  },
  requestDeleteProject: {
    uiAction: 'project-manager.requestDeleteProject',
  },
  createProject: {
    uiAction: 'project-manager.createProject',
  },
  downloadProjectOriginals: {
    uiAction: 'project-manager.downloadProjectOriginals',
  },
  openMergeModal: {
    uiAction: 'project-manager.openMergeModal',
  },
  cleanupInvalidCards: {
    uiAction: 'project-manager.cleanupInvalidCards',
  },
  clearCurrentProjectData: {
    uiAction: 'project-manager.clearCurrentProjectData',
  },
  cancelDeleteProject: {
    uiAction: 'project-manager.cancelDeleteProject',
  },
  confirmDeleteProject: {
    uiAction: 'project-manager.confirmDeleteProject',
  },
  closeMergeModal: {
    uiAction: 'project-manager.closeMergeModal',
  },
  mergeIntoCurrentProject: {
    uiAction: 'project-manager.mergeIntoCurrentProject',
  },
  expandToolbar: {
    uiAction: 'project-manager.expandToolbar',
  },
  collapseToolbar: {
    uiAction: 'project-manager.collapseToolbar',
  },
  openSearch: {
    uiAction: 'project-manager.openSearch',
  },
  openFavorites: {
    uiAction: 'project-manager.openFavorites',
  },
  fitToAll: {
    uiAction: 'project-manager.fitToAll',
  },
  resetView: {
    uiAction: 'project-manager.resetView',
  },
  toggleCanvasMode: {
    uiAction: 'project-manager.toggleCanvasMode',
  },
  toggleSnapToGrid: {
    uiAction: 'project-manager.toggleSnapToGrid',
  },
  autoArrange: {
    uiAction: 'project-manager.autoArrange',
  },
  toggleWorkflowMenu: {
    uiAction: 'project-manager.toggleWorkflowMenu',
  },
  addWorkflowPreviewCard: {
    uiAction: 'project-manager.addWorkflowPreviewCard',
  },
  addWorkflowSaveCard: {
    uiAction: 'project-manager.addWorkflowSaveCard',
  },
  addWorkflowAgentCard: {
    uiAction: 'project-manager.addWorkflowAgentCard',
  },
  applyWorkflowTemplate: {
    uiAction: 'project-manager.applyWorkflowTemplate',
  },
  toggleTheme: {
    uiAction: 'project-manager.toggleTheme',
  },
} as const satisfies Record<string, SettingsModuleActionDefinition<'project-manager'>>;

export const USER_PROFILE_ACTIONS = {
  copyUserId: {
    uiAction: 'user-profile.copyUserId',
  },
  switchToUsageLogs: {
    uiAction: 'user-profile.switchToUsageLogs',
  },
  switchToRechargeLogs: {
    uiAction: 'user-profile.switchToRechargeLogs',
  },
} as const satisfies Record<string, SettingsModuleActionDefinition<'user-profile'>>;

export const CONSUMPTION_RECORDS_ACTIONS = {
  switchToApiLedger: {
    uiAction: 'consumption-records.switchToApiLedger',
  },
  switchToCreditsLedger: {
    uiAction: 'consumption-records.switchToCreditsLedger',
  },
  refreshLedger: {
    uiAction: 'consumption-records.refreshLedger',
  },
  loadAdminRecharge: {
    uiAction: 'consumption-records.loadAdminRecharge',
  },
  approveRecharge: {
    uiAction: 'consumption-records.approveRecharge',
  },
  rejectRecharge: {
    uiAction: 'consumption-records.rejectRecharge',
  },
} as const satisfies Record<string, SettingsModuleActionDefinition<'consumption-records'>>;

export type SettingsDashboardActionKey = keyof typeof SETTINGS_DASHBOARD_ACTIONS;
export type StorageSettingsActionKey = keyof typeof STORAGE_SETTINGS_ACTIONS;
export type SystemLogsActionKey = keyof typeof SYSTEM_LOGS_ACTIONS;
export type SettingsShellActionKey = keyof typeof SETTINGS_SHELL_ACTIONS;
export type ProjectManagerActionKey = keyof typeof PROJECT_MANAGER_ACTIONS;
export type UserProfileActionKey = keyof typeof USER_PROFILE_ACTIONS;
export type ConsumptionRecordsActionKey = keyof typeof CONSUMPTION_RECORDS_ACTIONS;
