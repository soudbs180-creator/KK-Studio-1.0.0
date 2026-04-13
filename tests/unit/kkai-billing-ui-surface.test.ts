import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : '';
}

test('KKAI keeps billing surfaces feature-gated and restores the desktop assistant trigger', () => {
  const appSource = readSource('src/App.tsx');
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const profileModalSource = readSource('src/components/modals/UserProfileModal.tsx');
  const settingsRoutesSource = readSource('src/routes/settingsRoutes.tsx');
  const settingsPanelSource = readSource('src/components/settings/SettingsPanel.tsx');
  const localizedSettingsPanelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');

  assert.match(appSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(appSource, /onBillingClick=\{billingUiEnabled \? \(\) => openProfileSurface\('billing'\) : undefined\}/);
  assert.match(appSource, /onRechargeClick=\{billingUiEnabled \? \(\) => setShowRechargeModal\(true\) : undefined\}/);
  assert.match(appSource, /\{!isMobile && billingUiEnabled && \(/);
  assert.match(appSource, /\{billingUiEnabled && showRechargeModal && \(/);
  assert.match(appSource, /id="chat-trigger-button"/);
  assert.doesNotMatch(appSource, /\{false\s*\?\s*\(\s*<div[\s\S]*id="chat-trigger-button"/);
  assert.doesNotMatch(appSource, /\{false\s*&&\s*<div[\s\S]*id="chat-trigger-button"/);

  assert.match(chatSidebarSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(chatSidebarSource, /const canAccessSystemCreditModels = billingUiEnabled && !!user && !isTempUser;/);

  assert.match(promptBarSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(promptBarSource, /const canAccessSystemCreditModels = billingUiEnabled && !!user && !isTempUser;/);
  assert.match(promptBarSource, /const isSystemCreditModel = billingUiEnabled && !!currentModel\?\.isSystemInternal;/);

  assert.match(profileModalSource, /const billingUiEnabled = KKAI_FEATURE_FLAGS\.billing;/);
  assert.match(profileModalSource, /requestedView === 'billing' && !billingUiEnabled/);
  assert.match(profileModalSource, /\? 'main'/);
  assert.match(profileModalSource, /\{billingUiEnabled && \(/);
  assert.match(profileModalSource, /\{view === 'billing' && billingUiEnabled && \(/);

  assert.match(settingsRoutesSource, /import \{ KKAI_FEATURE_FLAGS \} from '\.\.\/app\/kkaiFeatureFlags';/);
  assert.match(settingsRoutesSource, /\.\.\.\(KKAI_FEATURE_FLAGS\.billing \? \[/);
  assert.match(settingsRoutesSource, /path: 'consumption-records'/);
  assert.match(settingsRoutesSource, /element: <CostEstimation embedded \/>/);

  assert.match(settingsPanelSource, /export \{ default \} from '\.\/SettingsPanel\.localized';/);
  assert.match(settingsPanelSource, /export type \{ SettingsViewId \} from '\.\/settingsRegistry';/);
  assert.doesNotMatch(settingsPanelSource, /lazy\(\(\) => import\('\.\/views\/DashboardView\.localized\.tsx'\)\)/);
  assert.match(localizedSettingsPanelSource, /CostEstimation embedded/);
});
