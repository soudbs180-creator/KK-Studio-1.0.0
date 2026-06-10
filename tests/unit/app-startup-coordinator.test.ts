import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { isKkApiSelfHostedCoreReadyFromHealth } from '../../apps/web/src/services/api/kkApiServerHealth.ts';

const ROOT_DIR = process.cwd();



test('app startup coordinator drives staged post-login bootstrapping', () => {
  const startupSource = readSource('apps/web/src/context/AppStartupContext.tsx');
  const appSource = readSource('apps/web/src/App.tsx');
  const authenticatedShellSource = readSource('apps/web/src/app/AuthenticatedAppShell.tsx');
  const startupServiceSource = readSource('apps/web/src/services/system/appStartup.ts');
  const healthSource = readSource('apps/web/src/services/api/kkApiServerHealth.ts');
  const startupScreenSource = readSource('apps/web/src/components/common/AppStartupScreen.tsx');

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
  assert.match(appSource, /const startupAuthenticatedUserId = user && !isTempUser \? user\.id : null;/);
  assert.match(appSource, /\}, \[advanceTo, authLoading, startupAuthenticatedUserId\]\);/);
  assert.doesNotMatch(appSource, /\}, \[advanceTo, authLoading, isTempUser, user\]\);/);
  assert.match(appSource, /\} catch \(error\) \{\s*console\.error\('\[App\] Startup bootstrap failed:', error\);\s*\} finally \{/);
  assert.match(appSource, /finally \{\s*if \(!active\) return;[\s\S]*advanceTo\('workspace_ready'\);/);
  assert.match(healthSource, /export function isKkApiSelfHostedCoreReadyFromHealth\(/);
  assert.match(startupSource, /isKkApiSelfHostedCoreReadyFromHealth\(health\)/);
  assert.match(startupSource, /KK API self-hosted core persistence is not fully configured\./);
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
  assert.match(appSource, /<AuthenticatedAppShell/);
  assert.match(appSource, /showCostEstimation=\{rootMode === 'workspace' \? showCostEstimation : false\}/);
  assert.match(appSource, /onExitCostEstimation=\{\(\) => setShowCostEstimation\(false\)\}/);
  assert.match(appSource, /showStartupBanner=\{rootMode === 'workspace'\}/);
  const switchSource = readSource('apps/web/src/app/AppRootContentSwitch.tsx');
  assert.match(appSource, /import AppRootContentSwitch from '\.\/app\/AppRootContentSwitch';/);
  assert.match(appSource, /AppContentComponent=\{AppRootContentSwitch\}/);
  assert.match(switchSource, /const AdminLayoutSuspended: React\.FC<any> = \(props\) => \([\s\S]*?<AdminLayout \{\.\.\.props\} \/>[\s\S]*?\);/);
  assert.match(switchSource, /const SettingsPageRootSuspended: React\.FC<any> = \(props\) => \([\s\S]*?<SettingsPageRoot \{\.\.\.props\} \/>[\s\S]*?\);/);
  assert.match(switchSource, /if \(rootMode === 'admin'\) \{\s*return <AdminLayoutSuspended \/>;\s*\}/);
  assert.match(switchSource, /if \(rootMode === 'settings'\) \{\s*return <SettingsPageRootSuspended \/>;\s*\}/);
  assert.match(switchSource, /return <AppContent \/>;/);
  assert.doesNotMatch(appSource, /const StartupRuntimeBanner: React\.FC = \(\) => \{/);
  assert.doesNotMatch(appSource, /const AuthenticatedAppShell: React\.FC/);
  assert.doesNotMatch(appSource, /import \{ AppStartupScreen \} from '\.\/components\/common\/AppStartupScreen';/);
  assert.doesNotMatch(appSource, /import NotificationToast from '\.\/components\/common\/NotificationToast';/);
  assert.doesNotMatch(appSource, /const CostEstimation = lazy\(\(\) => import\('\.\/pages\/CostEstimation'\)\);/);
  assert.match(authenticatedShellSource, /import NotificationToast from '\.\.\/components\/common\/NotificationToast';/);
  assert.match(authenticatedShellSource, /import \{ pickByDocumentLanguage \} from '\.\.\/utils\/localeText';/);
  assert.match(authenticatedShellSource, /const CostEstimation = (lazy|lazyWithRetry)\(\(\) => import\('\.\.\/pages\/CostEstimation'\)\);/);
  assert.match(authenticatedShellSource, /export interface AuthenticatedAppShellProps \{/);
  assert.match(authenticatedShellSource, /AppContentComponent: React\.ComponentType;/);
  assert.match(authenticatedShellSource, /showStartupBanner\?: boolean;/);
  assert.match(authenticatedShellSource, /function getStartupStageMessage\(stage: string, isWorkspaceReady: boolean, healthState: 'idle' \| 'checking' \| 'ready'\)/);
  assert.match(
    authenticatedShellSource,
    /case 'profile_ready':\s*return isWorkspaceReady \|\| healthState !== 'checking'\s*\?\s*null\s*:\s*pickByDocumentLanguage\(/,
  );
  assert.match(
    authenticatedShellSource,
    /case 'workspace_ready':\s*return pickByDocumentLanguage\([\s\S]*'Workspace is ready\. Finishing background warm-up\.\.\.'\);/,
  );
  assert.doesNotMatch(
    authenticatedShellSource,
    /if \(isWorkspaceReady\) \{\s*return null;\s*\}/,
  );
  assert.match(authenticatedShellSource, /export const StartupRuntimeBanner: React\.FC = \(\) => \{/);
  assert.match(authenticatedShellSource, /const stageMessage = getStartupStageMessage\(stage, isWorkspaceReady, healthState\);/);
  assert.match(authenticatedShellSource, /const message = hostedWarning \|\| lastStartupWarning \|\| stageMessage;/);
  assert.match(
    authenticatedShellSource,
    /export const AuthenticatedAppShell: React\.FC<AuthenticatedAppShellProps> = \(\{[\s\S]*showCostEstimation,[\s\S]*onExitCostEstimation,[\s\S]*AppContentComponent,[\s\S]*showStartupBanner = true,[\s\S]*\}\) =>/,
  );
  assert.match(authenticatedShellSource, /if \(loading\) \{\s*\/\/ 简体中文注释：登录态检测期间直接显示纯黑占位，不使用大型进度条，秒进登录页面\s*return <div className="fixed inset-0 bg-\[(?:#09090b|var\(--bg-base\))\]" \/>;\s*\}/);
  assert.match(authenticatedShellSource, /<CostEstimation onBack=\{onExitCostEstimation\} \/>/);
  assert.doesNotMatch(authenticatedShellSource, /showWorkspaceStartupSkeleton/);
  assert.match(authenticatedShellSource, /const showStartupRuntimeBanner = showStartupBanner && !isBackgroundReady;/);
  assert.match(authenticatedShellSource, /showStartupRuntimeBanner \? <StartupRuntimeBanner \/> : null/);
  assert.match(authenticatedShellSource, /<NotificationToast \/>/);
  assert.match(authenticatedShellSource, /<AppContentComponent \/>/);
  assert.doesNotMatch(authenticatedShellSource, /WorkspaceStartupSkeleton/);
  assert.doesNotMatch(startupSource, /session\?\.access_token/);
  assert.match(appSource, /advanceTo\('background_ready'\);/);

  assert.match(appSource, /<AppStartupProvider>\s*<BillingProvider>\s*<CanvasProvider>/);
});

test('self-hosted core readiness ignores missing phase-2 billing persistence', () => {
  assert.equal(isKkApiSelfHostedCoreReadyFromHealth({
    reachable: true,
    verified: true,
    status: 'degraded',
    selfHostedCoreReady: true,
    repositories: {
      adminConsole: 'postgres',
      authData: 'postgres',
      creditAccounts: 'memory',
      creditProviders: 'memory',
      workspaceLayout: 'postgres',
    },
    persistence: {
      userApiKeys: true,
      keyManager: true,
      authData: true,
      authSessions: true,
      tempUsers: true,
      credits: false,
      creditProviders: false,
      workspaceLayout: true,
    },
  } as any), true);
});
