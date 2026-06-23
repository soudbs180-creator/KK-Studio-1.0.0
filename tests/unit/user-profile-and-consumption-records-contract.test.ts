import assert from 'node:assert/strict';
import { test } from 'node:test';

import { USER_PROFILE_ACTIONS, CONSUMPTION_RECORDS_ACTIONS } from '../../apps/web/src/components/settings/settingsModuleActions.ts';
import { readSource } from '../support/workspacePaths.js';

const userProfileSource = readSource('apps/web/src/components/settings/views/UserProfileView.tsx');
const costEstimationSource = readSource('apps/web/src/pages/CostEstimation.tsx');

test('User Profile exposes stable actions and targets elements correctly', () => {
  const profileActions = Object.values(USER_PROFILE_ACTIONS).map((action) => action.uiAction);
  assert.deepEqual(profileActions, Array.from(new Set(profileActions)), 'user profile action names must be unique');

  for (const action of profileActions) {
    assert.ok(action.startsWith('user-profile.'), `action ${action} must stay user-profile-scoped`);
  }

  for (const key of ['copyUserId', 'switchToUsageLogs', 'switchToRechargeLogs'] as const) {
    assert.ok(USER_PROFILE_ACTIONS[key], `missing user profile action ${key}`);
    assert.match(
      userProfileSource,
      new RegExp(`data-user-profile-action=\\{USER_PROFILE_ACTIONS\\.${key}\\.uiAction\\}`),
      `UserProfileView should mark ${key}`
    );
  }
});

test('Consumption Records exposes stable actions and targets elements correctly', () => {
  const consumptionActions = Object.values(CONSUMPTION_RECORDS_ACTIONS).map((action) => action.uiAction);
  assert.deepEqual(consumptionActions, Array.from(new Set(consumptionActions)), 'consumption records action names must be unique');

  for (const action of consumptionActions) {
    assert.ok(action.startsWith('consumption-records.'), `action ${action} must stay consumption-records-scoped`);
  }

  for (const key of [
    'switchToApiLedger',
    'switchToCreditsLedger',
    'refreshLedger',
    'loadAdminRecharge',
    'approveRecharge',
    'rejectRecharge',
  ] as const) {
    assert.ok(CONSUMPTION_RECORDS_ACTIONS[key], `missing consumption records action ${key}`);
    assert.match(
      costEstimationSource,
      new RegExp(`data-consumption-records-action=\\{CONSUMPTION_RECORDS_ACTIONS\\.${key}\\.uiAction\\}`),
      `CostEstimation should mark ${key}`
    );
  }
});
