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

function readSource(relativePath: string): string {
  const actualPath = relativePath.startsWith('src/') ? 'apps/web/' + relativePath : relativePath; return readFileSync(path.join(ROOT_DIR, actualPath), 'utf-8');
}

test('default runtime auth state starts signed out until a server session exists', () => {
  const state = createDefaultRuntimeAuthState();

  assert.equal(state.user, null);
  assert.equal(state.isTempUser, false);
  assert.equal(state.tempUserExpiry, null);
});

test('AuthenticatedAppShell routes only fully signed-out users back to LoginScreen before the workspace renders', () => {
  const source = readSource('src/app/AuthenticatedAppShell.tsx');

  assert.match(source, /import LoginScreen from '\.\.\/components\/auth\/LoginScreen';/);
  assert.match(source, /import \{ AppStartupScreen \} from '\.\.\/components\/common\/AppStartupScreen';/);
  assert.match(source, /import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
  assert.match(source, /import \{ shouldShowLoginForAuthGate \} from '\.\/authGate';/);
  assert.match(source, /const \{ session, user, isTempUser, loading, sessionRecoveryWarning \} = useAuth\(\);/);
  assert.match(source, /if \(loading\) \{\s*return <AppStartupScreen stage="session_ready" warning=\{sessionRecoveryWarning\} \/>\s*;\s*\}/);
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
  const source = readSource('src/context/AuthContext.tsx');

  assert.match(source, /import \{ isHostedRuntime, kkWebApiClient, shouldUseLegacyWebApiFallback \} from ["']\.\.\/services\/api\/kkApiClient["'];/);
  assert.match(source, /const \[sessionRecoveryWarning, setSessionRecoveryWarning\] = useState<string \| null>\(null\);/);
  assert.match(source, /kkWebApiClient\.getProfile\(\{ accessToken \}\)/);
  assert.match(source, /const retryableWarning = "Checking your sign-in status\. Please try again in a moment\.";/);
  assert.match(source, /setSessionRecoveryWarning\(retryableWarning\)/);
});

test('AuthContext does not poll hosted cookie recovery forever for signed-out local runtimes', () => {
  const source = readSource('src/context/AuthContext.tsx');

  assert.match(
    source,
    /if \(!hostedRuntime && !storedToken\) \{\s*clearHostedSession\(\);\s*return;\s*\}/,
  );
});

test('AuthContext does not leave hosted signed-out visitors on the startup screen after cookie recovery fails', () => {
  const source = readSource('src/context/AuthContext.tsx');

  assert.match(
    source,
    /if \(!storedToken\) \{\s*clearHostedSession\(\);\s*return;\s*\}/,
  );
  assert.doesNotMatch(
    source,
    /if \(!storedToken\) \{\s*setSessionRecoveryWarning\(retryableWarning\);\s*scheduleRetry\(\);\s*return;\s*\}/,
  );
});

test('AuthContext does not create a fixed local workspace user before the user chooses temporary local access', () => {
  const source = readSource('src/context/AuthContext.tsx');

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
  const source = readSource('src/context/AuthContext.tsx');

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
