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
  assert.match(appSource, /const init = async \(\) => \{\s*advanceTo\('session_ready'\);[\s\S]*try \{/);
  assert.match(appSource, /\} catch \(error\) \{\s*console\.error\('\[App\] Startup bootstrap failed:', error\);\s*\} finally \{/);
  assert.match(appSource, /finally \{\s*if \(!active\) return;[\s\S]*advanceTo\('workspace_ready'\);/);
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
  assert.match(appSource, /const rootMode = createAppRootMode\(\{ pathname: window\.location\.pathname \}\);/);
  assert.match(appSource, /<AuthenticatedAppShell\s+showCostEstimation=\{rootMode === 'workspace' \? showCostEstimation : false\}\s+onExitCostEstimation=\{\(\) => setShowCostEstimation\(false\)\}\s+AppContentComponent=\{rootMode === 'settings' \? SettingsPageRoot : AppContent\}\s*\/>/);
  assert.doesNotMatch(appSource, /const StartupRuntimeBanner: React\.FC = \(\) => \{/);
  assert.doesNotMatch(appSource, /const AuthenticatedAppShell: React\.FC/);
  assert.doesNotMatch(appSource, /import \{ AppStartupScreen \} from '\.\/components\/common\/AppStartupScreen';/);
  assert.doesNotMatch(appSource, /import NotificationToast from '\.\/components\/common\/NotificationToast';/);
  assert.doesNotMatch(appSource, /const CostEstimation = lazy\(\(\) => import\('\.\/pages\/CostEstimation'\)\);/);
  assert.match(authenticatedShellSource, /import NotificationToast from '\.\.\/components\/common\/NotificationToast';/);
  assert.match(authenticatedShellSource, /import \{ pickByDocumentLanguage \} from '\.\.\/utils\/localeText';/);
  assert.match(authenticatedShellSource, /const CostEstimation = lazy\(\(\) => import\('\.\.\/pages\/CostEstimation'\)\);/);
  assert.match(authenticatedShellSource, /export interface AuthenticatedAppShellProps \{/);
  assert.match(authenticatedShellSource, /AppContentComponent: React\.ComponentType;/);
  assert.match(authenticatedShellSource, /function getStartupStageMessage\(stage: string, isWorkspaceReady: boolean\)/);
  assert.match(
    authenticatedShellSource,
    /case 'workspace_ready':\s*return pickByDocumentLanguage\([\s\S]*'Workspace is ready\. Finishing background warm-up\.\.\.'\);/,
  );
  assert.doesNotMatch(
    authenticatedShellSource,
    /if \(isWorkspaceReady\) \{\s*return null;\s*\}/,
  );
  assert.match(authenticatedShellSource, /export const StartupRuntimeBanner: React\.FC = \(\) => \{/);
  assert.match(authenticatedShellSource, /const stageMessage = getStartupStageMessage\(stage, isWorkspaceReady\);/);
  assert.match(authenticatedShellSource, /const message = hostedWarning \|\| lastStartupWarning \|\| stageMessage;/);
  assert.match(
    authenticatedShellSource,
    /export const AuthenticatedAppShell: React\.FC<AuthenticatedAppShellProps> = \(\{[\s\S]*showCostEstimation,[\s\S]*onExitCostEstimation,[\s\S]*AppContentComponent,[\s\S]*\}\) =>/,
  );
  assert.match(authenticatedShellSource, /<CostEstimation onBack=\{onExitCostEstimation\} \/>/);
  assert.match(authenticatedShellSource, /<StartupRuntimeBanner \/>/);
  assert.match(authenticatedShellSource, /<NotificationToast \/>/);
  assert.match(authenticatedShellSource, /<AppContentComponent \/>/);
  assert.doesNotMatch(authenticatedShellSource, /AppStartupScreen/);
  assert.doesNotMatch(startupSource, /session\?\.access_token/);
  assert.match(appSource, /advanceTo\('background_ready'\);/);

  assert.match(appSource, /<AppStartupProvider>\s*<BillingProvider>\s*<CanvasProvider>/);
});
