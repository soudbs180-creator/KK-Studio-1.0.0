import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PROJECT_MANAGER_ACTIONS,
  SETTINGS_DASHBOARD_ACTIONS,
  SETTINGS_SHELL_ACTIONS,
  STORAGE_SETTINGS_ACTIONS,
  SYSTEM_LOGS_ACTIONS,
  USER_PROFILE_ACTIONS,
  CONSUMPTION_RECORDS_ACTIONS,
} from '../../apps/web/src/components/settings/settingsModuleActions.ts';
import { readSource } from '../support/workspacePaths.js';

const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');
const storageSource = readSource('apps/web/src/components/settings/views/StorageSettingsView.localized.tsx');
const logsSource = readSource('apps/web/src/components/settings/views/SystemLogsView.localized.tsx');
const headerSource = readSource('apps/web/src/components/settings/desktop/SettingsDesktopWorkbenchHeader.tsx');
const sidebarSource = readSource('apps/web/src/components/settings/desktop/SettingsDesktopSidebar.tsx');
const settingsUiSource = readSource('apps/web/src/components/settings/ui/index.tsx');
const profileSource = readSource('apps/web/src/components/settings/views/UserProfileView.tsx');
const consumptionSource = readSource('apps/web/src/pages/CostEstimation.tsx');

test('settings module action catalogs use separate namespaces', () => {
  const catalogs = [
    SETTINGS_DASHBOARD_ACTIONS,
    STORAGE_SETTINGS_ACTIONS,
    SYSTEM_LOGS_ACTIONS,
    SETTINGS_SHELL_ACTIONS,
    PROJECT_MANAGER_ACTIONS,
    USER_PROFILE_ACTIONS,
    CONSUMPTION_RECORDS_ACTIONS,
  ];
  const values = catalogs.flatMap((catalog) => Object.values(catalog).map((action) => action.uiAction));

  assert.deepEqual(values, Array.from(new Set(values)), 'settings module action names must be unique');

  for (const action of Object.values(SETTINGS_DASHBOARD_ACTIONS)) {
    assert.ok(action.uiAction.startsWith('settings-dashboard.'), `${action.uiAction} must stay dashboard-scoped`);
  }
  for (const action of Object.values(STORAGE_SETTINGS_ACTIONS)) {
    assert.ok(action.uiAction.startsWith('storage-settings.'), `${action.uiAction} must stay storage-scoped`);
  }
  for (const action of Object.values(SYSTEM_LOGS_ACTIONS)) {
    assert.ok(action.uiAction.startsWith('system-logs.'), `${action.uiAction} must stay logs-scoped`);
  }
  for (const action of Object.values(SETTINGS_SHELL_ACTIONS)) {
    assert.ok(action.uiAction.startsWith('settings-shell.'), `${action.uiAction} must stay shell-scoped`);
  }
  for (const action of Object.values(PROJECT_MANAGER_ACTIONS)) {
    assert.ok(action.uiAction.startsWith('project-manager.'), `${action.uiAction} must stay project-scoped`);
  }
  for (const action of Object.values(USER_PROFILE_ACTIONS)) {
    assert.ok(action.uiAction.startsWith('user-profile.'), `${action.uiAction} must stay profile-scoped`);
  }
  for (const action of Object.values(CONSUMPTION_RECORDS_ACTIONS)) {
    assert.ok(action.uiAction.startsWith('consumption-records.'), `${action.uiAction} must stay consumption-scoped`);
  }
});

test('settings dashboard navigation panels expose dashboard action metadata', () => {
  assert.match(dashboardSource, /SETTINGS_DASHBOARD_ACTIONS/);
  assert.match(dashboardSource, /data-settings-dashboard-action=\{uiAction\}/);

  for (const key of [
    'openPrimaryModule',
    'openConsumptionRecords',
    'openApiManagement',
    'openBrowserAssistant',
    'openStorageSettings',
    'openSystemLogs',
    'openAiManagement',
  ] as const) {
    assert.match(
      dashboardSource,
      new RegExp(`SETTINGS_DASHBOARD_ACTIONS\\.${key}\\.uiAction`),
      `Dashboard should mark ${key}`
    );
  }
});

test('storage settings maintenance buttons expose storage action metadata', () => {
  assert.match(storageSource, /STORAGE_SETTINGS_ACTIONS/);

  for (const key of [
    'switchToLocalMode',
    'switchToBrowserMode',
    'refreshUsage',
    'cleanBrokenCards',
    'applyRetention30Days',
    'applyRetention7Days',
    'clearAllData',
    'selectMergeSource',
    'mergeProject',
    'cleanProjectCards',
  ] as const) {
    assert.match(
      storageSource,
      new RegExp(`(?:data-storage-settings-action|controlAction)=\\{STORAGE_SETTINGS_ACTIONS\\.${key}\\.uiAction\\}`),
      `Storage settings should mark ${key}`
    );
  }
});

test('system logs controls expose system log action metadata', () => {
  assert.match(logsSource, /SYSTEM_LOGS_ACTIONS/);

  for (const key of [
    'changeLevelFilter',
    'changeSourceFilter',
    'toggleStream',
    'exportLogs',
    'clearFilters',
    'toggleConsoleOption',
    'clearLogCache',
  ] as const) {
    assert.match(
      logsSource,
      new RegExp(`(?:data-system-logs-action|controlAction)=\\{SYSTEM_LOGS_ACTIONS\\.${key}\\.uiAction\\}`),
      `System logs should mark ${key}`
    );
  }
});

test('desktop settings shell buttons expose shell action metadata', () => {
  assert.match(headerSource, /SETTINGS_SHELL_ACTIONS/);
  assert.match(sidebarSource, /SETTINGS_SHELL_ACTIONS/);
  assert.match(headerSource, /data-settings-shell-action=\{SETTINGS_SHELL_ACTIONS\.refreshCurrentView\.uiAction\}/);
  assert.match(headerSource, /data-settings-shell-action=\{SETTINGS_SHELL_ACTIONS\.closeWorkbench\.uiAction\}/);
  assert.match(sidebarSource, /data-settings-shell-action=\{SETTINGS_SHELL_ACTIONS\.navigateModule\.uiAction\}/);
  assert.match(sidebarSource, /data-settings-shell-action=\{SETTINGS_SHELL_ACTIONS\.filterNavigation\.uiAction\}/);
});

test('segmented settings controls can carry stable settings action metadata', () => {
  assert.match(settingsUiSource, /SegmentedControlMulti[\s\S]*controlAction\?: string/);
  assert.match(settingsUiSource, /data-settings-control-action=\{controlAction\}/);
});

test('user profile controls expose profile action metadata', () => {
  assert.match(profileSource, /USER_PROFILE_ACTIONS/);

  for (const key of [
    'copyUserId',
    'switchToUsageLogs',
    'switchToRechargeLogs',
  ] as const) {
    assert.match(
      profileSource,
      new RegExp(`data-user-profile-action=\\{USER_PROFILE_ACTIONS\\.${key}\\.uiAction\\}`),
      `User profile should mark ${key}`
    );
  }
});

test('consumption records controls expose consumption action metadata', () => {
  assert.match(consumptionSource, /CONSUMPTION_RECORDS_ACTIONS/);

  for (const key of [
    'switchToApiLedger',
    'switchToCreditsLedger',
    'refreshLedger',
  ] as const) {
    assert.match(
      consumptionSource,
      new RegExp(`data-consumption-records-action=\\{CONSUMPTION_RECORDS_ACTIONS\\.${key}\\.uiAction\\}`),
      `Consumption records should mark ${key}`
    );
  }
});
