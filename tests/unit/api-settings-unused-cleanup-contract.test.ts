import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ApiSettingsView does not retain compiler-proven unused bindings', () => {
  const source = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');

  assert.doesNotMatch(source, /isKkApiUserDataPersistedInCloudFromHealth/);
  const formattersSource = readSource('apps/web/src/components/settings/apiSettingsFormatters.ts');
  assert.match(formattersSource, /export const UI_TOKEN_UNIT_LABEL = '词元';/);
  assert.match(formattersSource, /export const UI_BUDGET_OPTIONS = \['不限额', '金额预算', UI_TOKEN_LIMIT_LABEL\] as const;/);
  assert.doesNotMatch(source, /const TOKEN_UNIT_LABEL =/);
  assert.doesNotMatch(source, /const LEGACY_TOKEN_LIMIT_LABEL =/);
  assert.doesNotMatch(source, /const BUDGET_OPTIONS =/);
  assert.doesNotMatch(source, /const getProviderUsageSummary =/);
  assert.doesNotMatch(source, /const getProviderActivityLine =/);
  assert.doesNotMatch(source, /const shouldUseReadonlyProfileFallback =/);
  assert.doesNotMatch(source, /const userApiReadOnlyHelper =/);
  assert.match(source, /const shouldUseReadonlySnapshotForDisplay = userApiViewState\.shouldUseReadonlySnapshotForDisplay;/);
  assert.match(source, /const userApiEditorReadOnlyHelper = userApiEditorReadOnly/);
  assert.match(source, /const providerEditorReadOnlyHelper = providerEditorReadOnly/);
});
