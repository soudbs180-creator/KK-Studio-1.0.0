import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('storage and logs views are rebuilt onto the shared settings hero and section scaffold', () => {
  const storageSource = readSource('apps/web/src/components/settings/views/StorageSettingsView.localized.tsx');
  const logsSource = readSource('apps/web/src/components/settings/views/SystemLogsView.localized.tsx');

  assert.match(storageSource, /SettingsHero/);
  assert.match(storageSource, /SettingsSection/);
  assert.match(storageSource, /<SettingsHero/);
  assert.match(storageSource, /<SettingsSection/);
  assert.doesNotMatch(storageSource, /settings-reference-page-header/);

  assert.match(logsSource, /SettingsHero/);
  assert.match(logsSource, /SettingsSection/);
  assert.match(logsSource, /<SettingsHero/);
  assert.match(logsSource, /<SettingsSection/);
  assert.doesNotMatch(logsSource, /settings-reference-page-header/);
});

test('billing ledger shares the same settings hero and section rhythm as the rest of the workbench', () => {
  const billingSource = readSource('apps/web/src/pages/CostEstimation.tsx');

  assert.match(billingSource, /SettingsHero/);
  assert.match(billingSource, /SettingsSection/);
  assert.match(billingSource, /<SettingsHero/);
  assert.match(billingSource, /<SettingsSection/);
  assert.doesNotMatch(billingSource, /settings-reference-page-header/);
});

test('mobile settings opens directly on overview instead of a separate overview entry screen', () => {
  const settingsSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');

  assert.doesNotMatch(settingsSource, /MobileSettingsHome/);
  assert.doesNotMatch(settingsSource, /settingsMobileDetail/);
  assert.match(settingsSource, /activeView === 'dashboard' \? onClose\(\) : onNavigate\('dashboard'\);/);
  assert.match(registrySource, /primaryActionLabelEn: 'Open API Workspace'/);
  assert.match(dashboardSource, /dashboardPrimaryAction/);
  assert.match(dashboardSource, /dashboard-grid-container/);
});

test('settings search copy now describes navigation filtering instead of page-content search', () => {
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');

  assert.match(registrySource, /emptySearchLabel: 'No navigation entries matched\.'/);
  assert.match(registrySource, /return pickByLanguage\(language, '筛选设置导航', 'Filter settings navigation'\);/);
  assert.match(registrySource, /Filter API, provider, or platform entries/);
  assert.doesNotMatch(registrySource, /Search routes, providers, or platform entry/);
});

test('logs filter controls stay as a plain toolbar instead of a large nested card', () => {
  const logsSource = readSource('apps/web/src/components/settings/views/SystemLogsView.localized.tsx');

  assert.match(
    logsSource,
    /<SettingsSection[\s\S]*title=\{pick\([^,]+, 'Filters and stream control'\)\}[\s\S]*surface="plain"[\s\S]*>\s*<div className="settings-reference-toolbar settings-reference-toolbar--flat">/,
  );

  const filterSectionMatch = logsSource.match(
    /<SettingsSection[\s\S]*title=\{pick\([^,]+, 'Filters and stream control'\)\}[\s\S]*?<\/SettingsSection>/,
  );

  assert.ok(filterSectionMatch);
  assert.doesNotMatch(filterSectionMatch[0], /settings-reference-card|settings-section-card|rounded-\[|border p-/);
});

test('dashboard overview uses card-based grid layout', () => {
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');

  assert.match(dashboardSource, /dashboard-grid-container/);
  assert.match(dashboardSource, /dashboard-grid-card/);
  assert.match(dashboardSource, /ProgressBar/);
  assert.match(dashboardSource, /capability-sources/);
  assert.match(dashboardSource, /data-sync/);
});

test('destructive settings maintenance actions require confirmation before mutating local data', () => {
  const storageSource = readSource('apps/web/src/components/settings/views/StorageSettingsView.localized.tsx');
  const logsSource = readSource('apps/web/src/components/settings/views/SystemLogsView.localized.tsx');

  assert.match(storageSource, /window\.confirm\(/);
  assert.match(storageSource, /Apply the \$\{days\}-day retention policy\?/);
  assert.match(storageSource, /Merge "\$\{sourceCanvas\.name\}" into "\$\{activeCanvas\.name\}"\?/);
  assert.match(logsSource, /window\.confirm\(/);
  assert.match(logsSource, /Clear today's log cache\?/);
});

test('platform entry is clearly disabled until the real flow is wired in', () => {
  const apiWorkbenchSectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(apiWorkbenchSectionsSource, /entryActionDisabled\?: boolean;/);
  assert.match(apiWorkbenchSectionsSource, /disabled=\{entryActionDisabled\}/);
  assert.match(apiWorkbenchSectionsSource, /entryActionLabel=\{pick\('即将接入', 'Coming soon'\)\}/);
  assert.doesNotMatch(apiWorkbenchSectionsSource, /entryActionLabel=\{pick\('查看平台入口', 'View platform entry'\)\}/);
});

test('dedicated settings pages suppress the workspace startup banner so the shell header stays unobstructed', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const shellSource = readSource('apps/web/src/app/AuthenticatedAppShell.tsx');

  assert.match(appSource, /showStartupBanner=\{rootMode === 'workspace'\}/);
  assert.match(shellSource, /showStartupBanner\?: boolean;/);
  assert.match(shellSource, /showStartupBanner = true/);
  assert.match(shellSource, /const showStartupRuntimeBanner = showStartupBanner && !isBackgroundReady;/);
  assert.match(shellSource, /\{showStartupRuntimeBanner \? <StartupRuntimeBanner \/> : null\}/);
});

test('storage workbench avoids duplicate success toasts and disables merge when no source canvas is available', () => {
  const storageSource = readSource('apps/web/src/components/settings/views/StorageSettingsView.localized.tsx');
  const canvasSource = readSource('apps/web/src/context/CanvasContext.tsx');

  assert.doesNotMatch(storageSource, /notify\.success\(\s*pick\([^)]*'Switched'/);
  assert.match(
    storageSource,
    /disabled=\{!activeCanvas \|\| mergeCandidates\.length === 0 \|\| !mergeSourceId\}/
  );
  assert.match(
    canvasSource,
    /if \(stateRef\.current\.fileSystemHandle \|\| stateRef\.current\.folderName\) \{/
  );
});

test('api workbench copy stays concise and local-first', () => {
  const apiWorkbenchSectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(apiWorkbenchSectionsSource, /先看链路、状态和预算。/);
  assert.match(apiWorkbenchSectionsSource, /只看当前视图里的链路和延迟。/);
  assert.match(apiWorkbenchSectionsSource, /可从列表创建、编辑、刷新和启停。/);
  assert.match(apiWorkbenchSectionsSource, /这里只保留一个主动作。/);
  assert.match(apiWorkbenchSectionsSource, /平台入口单独保留。/);
  assert.match(apiWorkbenchSectionsSource, /当前不提供可点击流程。/);

  assert.doesNotMatch(apiWorkbenchSectionsSource, /在进入任意卡片前，先在这里查看当前服务健康、持久化状态和预算压力。/);
  assert.doesNotMatch(apiWorkbenchSectionsSource, /先决定你当前要看的是本地 API 还是第三方供应商，再进入对应卡片和编辑器。/);
  assert.doesNotMatch(apiWorkbenchSectionsSource, /允许从列表进入创建、编辑、刷新与启停操作。/);
  assert.doesNotMatch(apiWorkbenchSectionsSource, /保持一个最重要动作，其它操作继续留在对应卡片或工具位。/);
  assert.doesNotMatch(apiWorkbenchSectionsSource, /当前不提供可点击流程，避免和可用按钮混淆。/);
});
