import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { createDefaultRuntimeAuthState } from '../../src/services/auth/runtimeAuthState.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
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
  assert.match(source, /const \{ session, user, isTempUser, loading, sessionRecoveryWarning \} = useAuth\(\);/);
  assert.match(source, /if \(loading\) \{\s*return <AppStartupScreen stage="session_ready" warning=\{sessionRecoveryWarning\} \/>\s*;\s*\}/);
  assert.match(source, /if \(!user \|\| \(!session && !isTempUser\)\) \{\s*return <LoginScreen \/>\s*;\s*\}/);
  assert.doesNotMatch(source, /if \(!session \|\| !user \|\| isTempUser\) \{\s*return <LoginScreen \/>\s*;\s*\}/);
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
