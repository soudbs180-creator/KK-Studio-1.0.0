import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildApiManagementListState,
  deriveApiManagementListStateFromPath,
  readApiManagementListState,
} from '../../apps/web/src/components/settings/apiManagementRouteState.ts';

test('deriveApiManagementListStateFromPath maps official editor routes back to the official API list tab', () => {
  assert.deepEqual(
    deriveApiManagementListStateFromPath('/settings/api-management/official/google-main'),
    {
      source: 'api-management',
      activeTab: 'official',
      highlightOfficialId: 'google-main',
    },
  );
});

test('deriveApiManagementListStateFromPath maps provider create routes back to the provider tab without a highlight id', () => {
  assert.deepEqual(
    deriveApiManagementListStateFromPath('/settings/api-management/provider/new'),
    {
      source: 'api-management',
      activeTab: 'third-party',
    },
  );
});

test('buildApiManagementListState omits empty highlight ids', () => {
  assert.deepEqual(
    buildApiManagementListState('official', {
      highlightOfficialId: '   ',
      highlightProviderId: '',
    }),
    {
      source: 'api-management',
      activeTab: 'official',
    },
  );
});

test('readApiManagementListState ignores malformed location state', () => {
  assert.equal(readApiManagementListState({ source: 'other-surface', activeTab: 'official' }), null);
  assert.equal(readApiManagementListState({ source: 'api-management', activeTab: 'dashboard' }), null);
});

test('readApiManagementListState restores valid API list state', () => {
  assert.deepEqual(
    readApiManagementListState({
      source: 'api-management',
      activeTab: 'third-party',
      highlightProviderId: 'provider-7',
    }),
    {
      source: 'api-management',
      activeTab: 'third-party',
      highlightProviderId: 'provider-7',
    },
  );
});
