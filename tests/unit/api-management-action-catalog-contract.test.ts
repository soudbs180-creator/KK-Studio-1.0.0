import assert from 'node:assert/strict';
import { test } from 'node:test';

import { API_MANAGEMENT_ACTIONS } from '../../apps/web/src/components/settings/apiManagementActions.ts';
import { readSource } from '../support/workspacePaths.js';

const apiActionsSource = readSource('apps/web/src/components/settings/apiManagementActions.ts');
const apiSettingsSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
const apiWorkbenchSectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
const settingsUiSource = readSource('apps/web/src/components/settings/ui/index.tsx');

test('API Management exposes one stable local action catalog', () => {
  const actionValues = Object.values(API_MANAGEMENT_ACTIONS).map((action) => action.uiAction);

  assert.match(apiActionsSource, /api-management\./);
  assert.deepEqual(actionValues, Array.from(new Set(actionValues)), 'API Management action names must be unique');

  for (const action of actionValues) {
    assert.ok(action.startsWith('api-management.'), `action ${action} must stay API Management-scoped`);
  }

  for (const key of [
    'addOfficialApi',
    'addProviderRoute',
    'copyRouteId',
    'toggleRoute',
    'refreshRoute',
    'editRoute',
    'deleteRoute',
    'switchPresetDirectoryTab',
    'applyProviderPreset',
    'toggleCapabilityRole',
    'updateCapabilityPrimaryRoute',
    'updateCapabilityPrimaryModel',
    'updateCapabilityFallbackRoute',
    'updateCapabilityFallbackModel',
    'updateCapabilityAuxiliaryRoute',
    'updateCapabilityAuxiliaryModel',
    'updateCapabilityImageRoute',
    'updateCapabilityImageModel',
    'updateCapabilityImageFallbackRoute',
    'updateCapabilityImageFallbackModel',
    'openCapabilityOcrConfig',
    'syncEditorModels',
    'copyModelId',
    'backToModelCenter',
    'saveOfficialEndpoint',
    'resetOfficialDraft',
    'deleteOfficialEndpoint',
    'syncWuyinCatalog',
    'saveProviderRoute',
    'resetProviderDraft',
    'deleteProviderRoute',
    'searchModels',
    'clearSearchQuery',
    'clearAllFilters',
    'toggleTypeFilter',
    'toggleBrandFilter',
    'changeGroupBy',
    'toggleGroupCollapse',
  ] as const) {
    assert.ok(API_MANAGEMENT_ACTIONS[key], `missing API Management action ${key}`);
  }
});

test('API Management buttons and capability controls use the API action catalog', () => {
  assert.match(apiSettingsSource, /API_MANAGEMENT_ACTIONS/);
  assert.match(apiWorkbenchSectionsSource, /API_MANAGEMENT_ACTIONS/);

  for (const key of [
    'addOfficialApi',
    'addProviderRoute',
    'copyRouteId',
    'toggleRoute',
    'refreshRoute',
    'editRoute',
    'deleteRoute',
    'switchPresetDirectoryTab',
    'applyProviderPreset',
    'toggleCapabilityRole',
    'openCapabilityOcrConfig',
  ] as const) {
    assert.match(
      apiWorkbenchSectionsSource,
      new RegExp(`data-api-management-action=\\{API_MANAGEMENT_ACTIONS\\.${key}\\.uiAction\\}`),
      `apiWorkbenchSections should mark ${key}`
    );
  }

  for (const key of [
    'updateCapabilityPrimaryRoute',
    'updateCapabilityPrimaryModel',
    'updateCapabilityFallbackRoute',
    'updateCapabilityFallbackModel',
    'updateCapabilityAuxiliaryRoute',
    'updateCapabilityAuxiliaryModel',
    'updateCapabilityImageRoute',
    'updateCapabilityImageModel',
    'updateCapabilityImageFallbackRoute',
    'updateCapabilityImageFallbackModel',
  ] as const) {
    assert.match(
      apiWorkbenchSectionsSource,
      new RegExp(`API_MANAGEMENT_ACTIONS\\.${key}\\.uiAction`),
      `capability control should mark ${key}`
    );
  }
  assert.match(apiWorkbenchSectionsSource, /controlAction=/);

  for (const key of [
    'syncEditorModels',
    'copyModelId',
    'backToModelCenter',
    'saveOfficialEndpoint',
    'resetOfficialDraft',
    'deleteOfficialEndpoint',
    'syncWuyinCatalog',
    'saveProviderRoute',
    'resetProviderDraft',
    'deleteProviderRoute',
    'searchModels',
    'clearSearchQuery',
    'clearAllFilters',
    'toggleTypeFilter',
    'toggleBrandFilter',
    'changeGroupBy',
    'toggleGroupCollapse',
  ] as const) {
    assert.match(
      apiSettingsSource,
      new RegExp(`(?:data-api-management-action|controlAction)=\\{API_MANAGEMENT_ACTIONS\\.${key}\\.uiAction\\}`),
      `ApiSettingsView should mark ${key}`
    );
  }
});

test('shared settings controls can carry stable settings action metadata', () => {
  assert.match(settingsUiSource, /controlAction\?: string/);
  assert.match(settingsUiSource, /data-settings-control-action=\{controlAction\}/);
});
