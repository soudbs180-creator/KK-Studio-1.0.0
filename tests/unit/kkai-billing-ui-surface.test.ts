import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('KKAI keeps billing surfaces feature-gated and restores the desktop assistant trigger', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const desktopChromeSource = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const mobileWorkspaceSource = readSource('apps/web/src/app/AppMobileWorkspace.tsx');
  const globalModalsSource = readSource('apps/web/src/app/AppGlobalModals.tsx');
  const chatSidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const profileModalSource = readSource('apps/web/src/components/modals/UserProfileModal.tsx');
  const settingsRoutesSource = readSource('apps/web/src/routes/settingsRoutes.tsx');
  const settingsPanelSource = readSource('apps/web/src/components/settings/SettingsPanel.tsx');
  const localizedSettingsPanelSource = readSource('apps/web/src/components/settings/SettingsPanel.localized.tsx');

  assert.match(appSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(appSource, /<AppDesktopChrome[\s\S]*billingUiEnabled=\{billingUiEnabled\}/);
  assert.match(appSource, /<AppMobileWorkspace[\s\S]*billingUiEnabled=\{billingUiEnabled\}/);
  assert.match(appSource, /rechargeModal:\s*\{\s*enabled:\s*billingUiEnabled,\s*isOpen:\s*showRechargeModal,/);

  assert.match(desktopChromeSource, /\{billingUiEnabled && \(/);
  assert.match(desktopChromeSource, /onOpenProfile\('main'\)/);
  assert.match(desktopChromeSource, /onClick=\{onRecharge\}/);


  assert.match(mobileWorkspaceSource, /onBillingClick=\{billingUiEnabled \? \(\) => openProfileSurface\('main'\) : undefined\}/);
  assert.match(mobileWorkspaceSource, /onRechargeClick=\{billingUiEnabled \? onShowRecharge : undefined\}/);
  assert.match(globalModalsSource, /rechargeModal\.enabled && rechargeModal\.isOpen/);

  assert.match(chatSidebarSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(chatSidebarSource, /const canAccessSystemCreditModels = billingUiEnabled && !!user && !isTempUser;/);

  assert.match(promptBarSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(promptBarSource, /const canAccessSystemCreditModels = billingUiEnabled && !!user && !isTempUser;/);
  assert.match(promptBarSource, /const isSystemCreditModel = billingUiEnabled && !!currentModel\?\.isSystemInternal;/);

  assert.match(profileModalSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(profileModalSource, /\{billingUiEnabled && \(/);

  assert.match(settingsRoutesSource, /import \{ KKAI_FEATURE_FLAGS \} from '\.\.\/app\/kkaiFeatureFlags';/);
  assert.match(settingsRoutesSource, /\.\.\.\(KKAI_FEATURE_FLAGS\.billing \? \[/);
  assert.match(settingsRoutesSource, /path: 'consumption-records'/);
  assert.match(settingsRoutesSource, /element: <CostEstimation embedded \/>/);

  assert.match(settingsPanelSource, /export \{ default \} from '\.\/SettingsPanel\.localized';/);
  assert.match(settingsPanelSource, /export type \{ SettingsViewId \} from '\.\/settingsRegistry';/);
  assert.doesNotMatch(settingsPanelSource, /lazy\(\(\) => import\('\.\/views\/DashboardView\.localized\.tsx'\)\)/);
  assert.doesNotMatch(localizedSettingsPanelSource, /CostEstimation embedded/);
});

test('manual recharge UI exposes reserved dynamic channels and admin paid-order handling surface', () => {
  const rechargeModalSource = readSource('apps/web/src/components/modals/RechargeModal.tsx');
  const floatingPanelSource = readSource('apps/web/src/components/admin/AdminRechargeFloatingPanel.tsx');
  const authenticatedShellSource = readSource('apps/web/src/app/AuthenticatedAppShell.tsx');

  assert.match(rechargeModalSource, /支付宝静态码/);
  assert.match(rechargeModalSource, /微信静态码/);
  assert.match(rechargeModalSource, /国际卡\/Stripe/);
  assert.match(rechargeModalSource, /人工客服/);
  assert.match(rechargeModalSource, /通道未配置/);
  assert.match(rechargeModalSource, /我已支付/);
  assert.match(rechargeModalSource, /人工充值较慢/);
  assert.match(rechargeModalSource, /支付成功但积分未到账/);
  assert.match(rechargeModalSource, /markRechargeSubmissionPaid/);

  assert.match(floatingPanelSource, /useAdminRole/);
  assert.match(floatingPanelSource, /paymentMarkedAt/);
  assert.match(floatingPanelSource, /直接处理/);
  assert.match(floatingPanelSource, /进入处理/);
  assert.match(floatingPanelSource, /slice\(0,\s*10\)/);
  assert.match(authenticatedShellSource, /AdminRechargeFloatingPanel/);
});
