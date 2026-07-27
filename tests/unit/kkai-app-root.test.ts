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

test('kkai app root bypasses the auth gate for OAuth callbacks and mounts a local runtime auth provider', () => {
  const mainSource = readSource('apps/web/src/main.tsx');
  const appSource = readSource('apps/web/src/App.tsx');
  const authContextSource = readSource('apps/web/src/context/AuthContext.tsx');
  const startupSource = readSource('apps/web/src/context/AppStartupContext.tsx');

  assert.match(mainSource, /<AuthProvider>[\s\S]*<App \/>[\s\S]*<\/AuthProvider>/);
  assert.doesNotMatch(appSource, /<LoginScreen \/>/);
  assert.match(appSource, /const AuthCallback = lazyWithRetry\(\(\) => import\('\.\/pages\/AuthCallback'\)\);/);
  assert.match(appSource, /isAuthCallback \? \([\s\S]*<AuthCallback \/>/);
  assert.doesNotMatch(appSource, /if \(!user\)/);
  assert.match(appSource, /const isAuthCallback = window\.location\.pathname === '\/auth\/callback';/);
  assert.match(appSource, /const rootMode = createAppRootMode\(\{ pathname: window\.location\.pathname \}\);/);
  const switchSource = readSource('apps/web/src/app/AppRootContentSwitch.tsx');
  assert.match(appSource, /import AppRootContentSwitch from '\.\/app\/AppRootContentSwitch';/);
  assert.match(appSource, /AppContentComponent=\{AppRootContentSwitch\}/);
  assert.match(switchSource, /const AdminLayoutSuspended: React\.FC<any> = \(props\) => \([\s\S]*?<AdminLayout \{\.\.\.props\} \/>[\s\S]*?\);/);
  assert.match(switchSource, /const SettingsPageRootSuspended: React\.FC<any> = \(props\) => \([\s\S]*?<SettingsPageRoot \{\.\.\.props\} \/>[\s\S]*?\);/);
  assert.match(switchSource, /if \(rootMode === 'admin'\) \{\s*return <AdminLayoutSuspended \/>;\s*\}/);
  assert.match(switchSource, /if \(rootMode === 'settings'\) \{\s*return <SettingsPageRootSuspended \/>;\s*\}/);
  assert.match(switchSource, /return <AppContent \/>;/);
  assert.doesNotMatch(appSource, /if \(createAppRootMode\(\{ pathname: window\.location\.pathname \}\) !== 'workspace'\) \{/);
  assert.match(appSource, /<BillingProvider>\s*<CanvasProvider>/);
  assert.match(authContextSource, /createKkaiRuntimeAuthSnapshot/);
  assert.doesNotMatch(authContextSource, /supabase\.auth/);
  assert.match(
    startupSource,
    /const localOnlyRuntime = true|const localOnlyRuntime = !KKAI_FEATURE_FLAGS\.admin\s*&& !KKAI_FEATURE_FLAGS\.workspaceCloudSync\s*&& !KKAI_FEATURE_FLAGS\.cloudProfileFallback;/,
  );
});
