import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  createAppRootMode,
  createKkaiRuntimeAuthSnapshot,
} from '../../src/context/kkaiRuntimeContext.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : '';
}

test('createKkaiRuntimeAuthSnapshot produces a non-loading fixed local runtime user', () => {
  const snapshot = createKkaiRuntimeAuthSnapshot();

  assert.equal(snapshot.loading, false);
  assert.equal(snapshot.isTempUser, false);
  assert.equal(snapshot.user?.id, 'local-user');
  assert.equal(snapshot.session, null);
});

test('createAppRootMode always boots the workspace shell in local-only mode', () => {
  assert.equal(createAppRootMode({ pathname: '/' }), 'workspace');
  assert.equal(createAppRootMode({ pathname: '/auth/callback' }), 'workspace');
});

test('kkai app root bypasses login and callback routes and mounts a local runtime auth provider', () => {
  const mainSource = readSource('src/main.tsx');
  const appSource = readSource('src/App.tsx');
  const authContextSource = readSource('src/context/AuthContext.tsx');
  const startupSource = readSource('src/context/AppStartupContext.tsx');

  assert.match(mainSource, /<AuthProvider>[\s\S]*<App \/>[\s\S]*<\/AuthProvider>/);
  assert.doesNotMatch(appSource, /<LoginScreen \/>/);
  assert.doesNotMatch(appSource, /<AuthCallback \/>/);
  assert.doesNotMatch(appSource, /if \(!user\)/);
  assert.doesNotMatch(appSource, /window\.location\.pathname === '\/auth\/callback'/);
  assert.match(appSource, /if \(createAppRootMode\(\{ pathname: window\.location\.pathname \}\) !== 'workspace'\) \{/);
  assert.match(appSource, /<BillingProvider>\s*<CanvasProvider>/);
  assert.match(authContextSource, /createKkaiRuntimeAuthSnapshot/);
  assert.doesNotMatch(authContextSource, /supabase\.auth/);
  assert.match(
    startupSource,
    /const localOnlyRuntime = true|const localOnlyRuntime = !KKAI_FEATURE_FLAGS\.admin\s*&& !KKAI_FEATURE_FLAGS\.workspaceCloudSync\s*&& !KKAI_FEATURE_FLAGS\.cloudProfileFallback;/,
  );
});
