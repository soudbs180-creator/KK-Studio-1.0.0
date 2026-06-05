import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { shouldShowLoginForAuthGate } from '../../apps/web/src/app/authGate.ts';
import {
  createDefaultRuntimeAuthState,
  createFixedLocalRuntimeAuthState,
} from '../../apps/web/src/services/auth/runtimeAuthState.ts';

const ROOT_DIR = process.cwd();



test('default runtime auth state starts signed out until a server session exists', () => {
  const state = createDefaultRuntimeAuthState();

  assert.equal(state.user, null);
  assert.equal(state.isTempUser, false);
  assert.equal(state.tempUserExpiry, null);
});

test('AuthenticatedAppShell routes only fully signed-out users back to LoginScreen before the workspace renders', () => {
  const source = readSource('apps/web/src/app/AuthenticatedAppShell.tsx');

  assert.match(source, /import LoginScreen from '\.\.\/components\/auth\/LoginScreen';/);
  assert.match(source, /import \{ AppStartupScreen \} from '\.\.\/components\/common\/AppStartupScreen';/);
  assert.match(source, /import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
  assert.match(source, /import \{ shouldShowLoginForAuthGate \} from '\.\/authGate';/);
  assert.match(source, /const \{ session, user, isTempUser, loading, sessionRecoveryWarning \} = useAuth\(\);/);
  assert.match(source, /if \(loading\) \{\s*\/\/ 简体中文注释：登录态检测期间直接显示纯黑占位，不使用大型进度条，秒进登录页面\s*return <div className="fixed inset-0 bg-\[(?:#09090b|var\(--bg-base\))\]" \/>;\s*\}/);
  assert.match(source, /if \(shouldShowLoginForAuthGate\(\{ user, session, isTempUser \}\)\) \{\s*return <LoginScreen \/>\s*;\s*\}/);
  assert.doesNotMatch(source, /if \(!user \|\| \(!session && !isTempUser\)\) \{\s*return <LoginScreen \/>\s*;\s*\}/);
  assert.doesNotMatch(source, /if \(!session \|\| !user \|\| isTempUser\) \{\s*return <LoginScreen \/>\s*;\s*\}/);
});

test('fixed local runtime user can open the workspace without a KK API session token', () => {
  const localState = createFixedLocalRuntimeAuthState();

  assert.equal(
    shouldShowLoginForAuthGate({
      user: localState.user,
      session: null,
      isTempUser: false,
    }),
    false,
  );
});

test('AuthContext attempts to rehydrate a stored KK API session before falling back to signed-out runtime state', () => {
  const source = readSource('apps/web/src/context/AuthContext.tsx');

  assert.match(source, /import \{ isHostedRuntime, kkWebApiClient, shouldUseLegacyWebApiFallback \} from ["']\.\.\/services\/api\/kkApiClient["'];/);
  assert.match(source, /function shouldRecoverSessionOnMount\(runtimeState: RuntimeAuthState\): boolean/);
  assert.match(source, /sessionRecoveryLoading: shouldRecoverSessionOnMount\(runtimeState\)/);
  assert.match(source, /const \[sessionRecoveryWarning, setSessionRecoveryWarning\] = useState<string \| null>\(null\);/);
  assert.match(source, /kkWebApiClient\.getProfile\(\{ accessToken, signal: abortScope\.signal \}\)/);
  assert.match(source, /const retryableWarning = "Checking your sign-in status\. Please try again in a moment\.";/);
  assert.match(source, /const SESSION_RECOVERY_TIMEOUT_MS = 8000;/);
  assert.match(source, /setSessionRecoveryWarning\(retryableWarning\)/);
  assert.match(
    source,
    /setSessionRecoveryWarning\(retryableWarning\);\s*setSessionRecoveryLoading\(false\);\s*scheduleRetry\(\);/,
  );
});

test('AuthContext does not poll hosted cookie recovery forever for signed-out local runtimes', () => {
  const source = readSource('apps/web/src/context/AuthContext.tsx');

  assert.match(
    source,
    /if \(hostedRuntime\) \{[\s\S]*const restoredHostedSession = await tryRestoreHostedSession\(\);[\s\S]*storedToken = getStoredKkApiAccessToken\(\) \|\| storedToken;[\s\S]*\}\s*if \(!storedToken\) \{\s*clearHostedSession\(\);\s*return;\s*\}/,
  );
});

test('AuthContext retries hosted cookie recovery failures without pinning the startup screen', () => {
  const source = readSource('apps/web/src/context/AuthContext.tsx');

  assert.match(
    source,
    /fetchHostedSessionFromServer\(\{ signal: abortScope\.signal \}\)\.finally\(abortScope\.dispose\)/,
  );
  assert.match(
    source,
    /setSessionRecoveryWarning\(retryableWarning\);\s*setSessionRecoveryLoading\(false\);\s*scheduleRetry\(\);\s*return true;/,
  );
});

test('AuthContext does not create a fixed local workspace user before the user chooses temporary local access', () => {
  const source = readSource('apps/web/src/context/AuthContext.tsx');

  assert.doesNotMatch(
    source,
    /return localOnlyRuntime \? createFixedLocalRuntimeAuthState\(\) : createDefaultRuntimeAuthState\(\);/,
  );
  assert.match(
    source,
    /loginAsTempUser: async \(\) => \{[\s\S]*const tempSession = await tempUserService\.getOrCreateTempUser/,
  );
});

test('explicit user logout blocks hosted session recovery until a new runtime user appears', () => {
  const source = readSource('apps/web/src/context/AuthContext.tsx');

  assert.match(source, /const \[sessionRecoveryBlockedBySignOut, setSessionRecoveryBlockedBySignOut\] = useState\(false\);/);
  assert.match(
    source,
    /subscribeRuntimeAuthState\(\(nextState\) => \{[\s\S]*if \(nextState\.user \|\| nextState\.isTempUser\) \{[\s\S]*setSessionRecoveryBlockedBySignOut\(false\);/,
  );
  assert.match(
    source,
    /if \(runtimeState\.user \|\| runtimeState\.isTempUser\) \{[\s\S]*setSessionRecoveryLoading\(false\);[\s\S]*return;/,
  );
  assert.doesNotMatch(
    source,
    /if \(runtimeState\.user \|\| runtimeState\.isTempUser\) \{[\s\S]{0,160}setSessionRecoveryBlockedBySignOut\(false\);/,
  );
  assert.match(
    source,
    /if \(sessionRecoveryBlockedBySignOut\) \{[\s\S]*setSessionRecoveryWarning\(null\);[\s\S]*setSessionRecoveryLoading\(false\);[\s\S]*return;/,
  );
  assert.match(
    source,
    /signOut: async \(\) => \{[\s\S]*setSessionRecoveryBlockedBySignOut\(true\);[\s\S]*await logoutHostedSessionFromServer/,
  );
  assert.match(
    source,
    /loginAsTempUser: async \(\) => \{[\s\S]*setSessionRecoveryBlockedBySignOut\(false\);[\s\S]*const tempSession = await tempUserService\.getOrCreateTempUser/,
  );
});
