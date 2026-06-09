import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  createAppRootMode,
  createKkaiRuntimeAuthSnapshot,
} from '../../apps/web/src/context/kkaiRuntimeContext.ts';

const ROOT_DIR = process.cwd();



test('createKkaiRuntimeAuthSnapshot produces a non-loading fixed local runtime user', () => {
  const snapshot = createKkaiRuntimeAuthSnapshot();

  assert.equal(snapshot.loading, false);
  assert.equal(snapshot.isTempUser, false);
  assert.equal(snapshot.user?.id, 'local-user');
  assert.equal(snapshot.session, null);
});

test('createAppRootMode routes workspace paths to the workspace shell and /settings* paths to the settings shell', () => {
  assert.equal(createAppRootMode({ pathname: '/' }), 'workspace');
  assert.equal(createAppRootMode({ pathname: '/auth/callback' }), 'workspace');
  assert.equal(createAppRootMode({ pathname: '/settings' }), 'settings');
  assert.equal(createAppRootMode({ pathname: '/settings/api-management' }), 'settings');
});

test('kkai app root bypasses login and callback routes and mounts a local runtime auth provider', () => {
  const mainSource = readSource('apps/web/src/main.tsx');
  const appSource = readSource('apps/web/src/App.tsx');
  const authContextSource = readSource('apps/web/src/context/AuthContext.tsx');
  const startupSource = readSource('apps/web/src/context/AppStartupContext.tsx');

  assert.match(mainSource, /<AuthProvider>[\s\S]*<App \/>[\s\S]*<\/AuthProvider>/);
  assert.doesNotMatch(appSource, /<LoginScreen \/>/);
  assert.doesNotMatch(appSource, /<AuthCallback \/>/);
  assert.doesNotMatch(appSource, /if \(!user\)/);
  assert.doesNotMatch(appSource, /window\.location\.pathname === '\/auth\/callback'/);
  assert.match(appSource, /const rootMode = createAppRootMode\(\{ pathname: window\.location\.pathname \}\);/);
  assert.match(appSource, /const AdminLayoutSuspended: React\.FC<any> = \(props\) => \([\s\S]*?<AdminLayout \{\.\.\.props\} \/>[\s\S]*?\);/);
  assert.match(appSource, /const SettingsPageRootSuspended: React\.FC<any> = \(props\) => \([\s\S]*?<SettingsPageRoot \{\.\.\.props\} \/>[\s\S]*?\);/);
  assert.match(
    appSource,
    /AppContentComponent=\{\s*rootMode === 'admin'[\s\S]*?\? AdminLayoutSuspended[\s\S]*?: rootMode === 'settings'[\s\S]*?\? SettingsPageRootSuspended[\s\S]*?: AppContent\s*\}/
  );
  assert.doesNotMatch(appSource, /if \(createAppRootMode\(\{ pathname: window\.location\.pathname \}\) !== 'workspace'\) \{/);
  assert.match(appSource, /<BillingProvider>\s*<CanvasProvider>/);
  assert.match(authContextSource, /createKkaiRuntimeAuthSnapshot/);
  assert.doesNotMatch(authContextSource, /supabase\.auth/);
  assert.match(
    startupSource,
    /const localOnlyRuntime = true|const localOnlyRuntime = !KKAI_FEATURE_FLAGS\.admin\s*&& !KKAI_FEATURE_FLAGS\.workspaceCloudSync\s*&& !KKAI_FEATURE_FLAGS\.cloudProfileFallback;/,
  );
});
