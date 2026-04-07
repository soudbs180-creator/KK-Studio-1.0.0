import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : '';
}

test('app startup coordinator drives staged post-login bootstrapping', () => {
  const startupSource = readSource('src/context/AppStartupContext.tsx');
  const appSource = readSource('src/App.tsx');
  const authenticatedShellSource = readSource('src/app/AuthenticatedAppShell.tsx');
  const startupServiceSource = readSource('src/services/system/appStartup.ts');
  const healthSource = readSource('src/services/api/kkApiServerHealth.ts');
  const startupScreenSource = readSource('src/components/common/AppStartupScreen.tsx');

  assert.match(startupServiceSource, /export const APP_STARTUP_STAGES = \[/);
  assert.match(startupServiceSource, /'session_ready'/);
  assert.match(startupServiceSource, /'profile_ready'/);
  assert.match(startupServiceSource, /'workspace_ready'/);
  assert.match(startupServiceSource, /'background_ready'/);
  assert.match(startupServiceSource, /export function setLatestStartupSnapshot\(/);

  assert.match(startupSource, /export const AppStartupProvider: React\.FC<\{ children: React\.ReactNode \}> = \(\{ children \}\) => \{/);
  assert.match(startupSource, /void getKkApiServerHealth\(\{ forceRefresh: true \}\)/);
  assert.match(startupSource, /applyServiceStage\('session_ready'\);/);
  assert.match(startupSource, /setStageSafely\('profile_ready'\);/);
  assert.match(startupSource, /setStageSafely\('workspace_ready'\);/);
  assert.match(startupSource, /keyManager\.setStartupStage\(nextStage\);/);
  assert.match(startupSource, /adminModelService\.setStartupStage\(nextStage\);/);
  assert.match(healthSource, /export function isKkApiCanonicalCloudReadyFromHealth\(/);
  assert.match(startupSource, /isKkApiCanonicalCloudReadyFromHealth\(health\)/);
  assert.match(startupSource, /KK API canonical billing\/model persistence is not fully configured\./);
  assert.doesNotMatch(
    startupSource,
    /return \(\) => \{\s*cancelled = true;\s*clearScheduledWork\(\);\s*applyServiceStage\('signed_out'\);\s*\};/,
  );
  assert.match(startupSource, /legacyFallbackEnabled: legacyFallbackState\.enabled/);
  assert.match(startupSource, /isStageReady: \(requiredStage: AppStartupStage\) => boolean;/);
  assert.match(startupScreenSource, /export const AppStartupScreen/);
  assert.match(appSource, /import \{ AppStartupProvider, useAppStartup \} from '\.\/context\/AppStartupContext';/);
  assert.match(appSource, /import \{ AuthenticatedAppShell \} from '\.\/app\/AuthenticatedAppShell';/);
  assert.match(appSource, /<AuthenticatedAppShell\s+showCostEstimation=\{showCostEstimation\}\s+onExitCostEstimation=\{\(\) => setShowCostEstimation\(false\)\}\s+AppContentComponent=\{AppContent\}\s*\/>/);
  assert.doesNotMatch(appSource, /const StartupRuntimeBanner: React\.FC = \(\) => \{/);
  assert.doesNotMatch(appSource, /const AuthenticatedAppShell: React\.FC/);
  assert.doesNotMatch(appSource, /import \{ AppStartupScreen \} from '\.\/components\/common\/AppStartupScreen';/);
  assert.doesNotMatch(appSource, /import NotificationToast from '\.\/components\/common\/NotificationToast';/);
  assert.doesNotMatch(appSource, /const CostEstimation = lazy\(\(\) => import\('\.\/pages\/CostEstimation'\)\);/);
  assert.match(authenticatedShellSource, /import \{ AppStartupScreen \} from '\.\.\/components\/common\/AppStartupScreen';/);
  assert.match(authenticatedShellSource, /import NotificationToast from '\.\.\/components\/common\/NotificationToast';/);
  assert.match(authenticatedShellSource, /const CostEstimation = lazy\(\(\) => import\('\.\.\/pages\/CostEstimation'\)\);/);
  assert.match(authenticatedShellSource, /export interface AuthenticatedAppShellProps \{/);
  assert.match(authenticatedShellSource, /AppContentComponent: React\.ComponentType;/);
  assert.match(authenticatedShellSource, /export const StartupRuntimeBanner: React\.FC = \(\) => \{/);
  assert.match(authenticatedShellSource, /const message = legacyFallbackEnabled && isHostedRuntime/);
  assert.match(authenticatedShellSource, /export const AuthenticatedAppShell: React\.FC<AuthenticatedAppShellProps> = \(\{ showCostEstimation, onExitCostEstimation, AppContentComponent \}\) => \{/);
  assert.match(authenticatedShellSource, /<CostEstimation onBack=\{onExitCostEstimation\} \/>/);
  assert.match(authenticatedShellSource, /<StartupRuntimeBanner \/>/);
  assert.match(authenticatedShellSource, /<NotificationToast \/>/);
  assert.match(authenticatedShellSource, /<AppContentComponent \/>/);
  assert.match(authenticatedShellSource, /\{!isBackgroundReady \? <AppStartupScreen stage=\{stage\} warning=\{lastStartupWarning\} \/> : null\}/);
  assert.match(appSource, /advanceTo\('background_ready'\);/);

  assert.match(appSource, /<AppStartupProvider>\s*<BillingProvider>\s*<CanvasProvider>/);
});
