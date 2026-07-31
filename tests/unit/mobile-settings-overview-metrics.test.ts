import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveMobileSettingsOverviewMetrics } from '../../apps/web/src/components/settings/mobileSettingsOverviewMetrics.ts';
import { readSource } from '../support/workspacePaths.js';

type MetricsInput = Parameters<typeof deriveMobileSettingsOverviewMetrics>[0];

test('mobile settings overview derives billing, provider, OAuth, token, and latency metrics from runtime data', () => {
  const metrics = deriveMobileSettingsOverviewMetrics({
    now: new Date('2026-07-11T12:00:00+08:00'),
    slots: [
      {
        id: 'provider-1',
        name: 'Provider mirror',
        provider: 'provider-1',
        status: 'valid',
        successCount: 3,
        failCount: 1,
        usedTokens: 200,
      },
      {
        id: 'standalone',
        name: 'Recent API',
        provider: 'openai',
        status: 'valid',
        disabled: false,
        successCount: 4,
        failCount: 2,
        usedTokens: 100,
        lastResponseTime: 720,
        lastUsed: 2_000,
      },
      {
        id: 'invalid',
        name: 'Invalid API',
        provider: 'openai',
        status: 'invalid',
        avgResponseTime: 180,
      },
    ],
    providers: [{
      id: 'provider-1',
      legacyIds: [],
      name: 'Cloud route',
      isActive: true,
      status: 'connected',
      usage: { totalTokens: 500 },
      activitySummary: { lastLatencyMs: 1_200, updatedAt: 1_000 },
    }],
    usageLogs: [
      { created_at: '2026-07-11T08:00:00+08:00', type: 'debit', status: 'completed', amount: -12 },
      { created_at: '2026-07-11T09:00:00+08:00', type: 'consumption', status: 'completed', amount: 3 },
      { created_at: '2026-07-11T10:00:00+08:00', type: 'debit', status: 'failed', amount: -9 },
      { created_at: '2026-07-10T09:00:00+08:00', type: 'debit', status: 'completed', amount: -5 },
    ],
    todayTokens: 300,
    browserStatus: {
      daemonStatus: 'connected',
      extensionStatus: 'connected',
      sessions: [
        { id: 'signed-in', status: 'logged_in', enabled: true },
        { id: 'disabled', status: 'ready', enabled: false },
        { id: 'signed-out', status: 'logged_out', enabled: true },
      ],
    },
  } as unknown as MetricsInput);

  assert.deepEqual(metrics, {
    availableRoutes: 2,
    failedRoutes: 1,
    successfulApiCalls: 7,
    failedApiCalls: 3,
    totalTokens: 600,
    todayCreditSpend: 15,
    authenticatedBrowserAccounts: 1,
    latencyMs: 720,
    latencySourceName: 'Recent API',
    latencySource: 'recent',
  });
});

test('mobile settings overview hides OAuth sessions when the bridge is disconnected and falls back to fastest latency', () => {
  const metrics = deriveMobileSettingsOverviewMetrics({
    slots: [{
      id: 'slow',
      name: 'Slow API',
      provider: 'openai',
      status: 'valid',
      avgResponseTime: 900,
    }],
    providers: [{
      id: 'fast',
      name: 'Fast API',
      isActive: true,
      status: 'connected',
      activitySummary: { lastLatencyMs: 400 },
    }],
    usageLogs: [],
    todayTokens: 0,
    browserStatus: {
      daemonStatus: 'disconnected',
      extensionStatus: 'connected',
      sessions: [{ id: 'signed-in', status: 'logged_in', enabled: true }],
    },
  } as unknown as MetricsInput);

  assert.equal(metrics.authenticatedBrowserAccounts, 0);
  assert.equal(metrics.latencyMs, 400);
  assert.equal(metrics.latencySourceName, 'Fast API');
  assert.equal(metrics.latencySource, 'fastest');
});

test('mobile settings dashboard exposes four judgment metrics, focused strategy controls, modules, and balance', () => {
  const dashboardSource = readSource('apps/web/src/components/settings/SettingsMobileDashboard.tsx');
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const navigationSource = readSource('apps/web/src/components/settings/mobileSettingsNavigation.ts');
  const appearanceSource = readSource('apps/web/src/components/settings/views/AppearanceMotionView.tsx');
  const appearanceContextSource = readSource('apps/web/src/context/AppearanceMotionContext.tsx');
  const settingsStylesSource = readSource('apps/web/src/styles/settings.css');

  assert.match(dashboardSource, /data-testid="settings-mobile-dashboard"/);
  assert.match(dashboardSource, /创作系统状态/);
  assert.match(dashboardSource, /剩余额度/);
  assert.match(dashboardSource, /今日消耗/);
  assert.match(dashboardSource, /网页登录/);
  assert.match(dashboardSource, /可用路由/);
  assert.doesNotMatch(dashboardSource, /id: 'calls'/);
  assert.doesNotMatch(dashboardSource, /id: 'tokens'/);
  assert.doesNotMatch(dashboardSource, /id: 'latency'/);
  assert.doesNotMatch(dashboardSource, /id: 'performance'/);
  assert.match(dashboardSource, /默认执行位置/);
  assert.match(dashboardSource, /本地优先/);
  assert.match(dashboardSource, /服务器优先/);
  assert.match(dashboardSource, /快速/);
  assert.match(dashboardSource, /正常/);
  assert.match(dashboardSource, /性能/);
  assert.match(dashboardSource, /settings-mobile-module-list/);
  assert.match(dashboardSource, /getSettingsNavItems/);
  assert.match(dashboardSource, /创作与能力/);
  assert.match(dashboardSource, /自动化与系统/);
  assert.match(dashboardSource, /剩余金额/);
  assert.match(dashboardSource, /data-ai-settings-target/);
  assert.doesNotMatch(dashboardSource, /SettingsHero/);
  assert.doesNotMatch(dashboardSource, /42%/);
  assert.doesNotMatch(shellSource, /SettingsHero/);
  assert.match(shellSource, /SettingsMobileDashboard/);
  assert.match(navigationSource, /Capabilities/);
  assert.match(navigationSource, /'capability-sources'/);
  assert.match(navigationSource, /System/);
  assert.match(shellSource, /<SettingsMobileDashboard\s/);

  assert.match(appearanceSource, /role="radiogroup"/);
  assert.match(appearanceSource, /role="radio"/);
  assert.match(appearanceSource, /'fast'/);
  assert.match(appearanceSource, /'balanced'/);
  assert.match(appearanceSource, /'visual'/);
  assert.match(appearanceContextSource, /data(set)?\.kkWebPerformance|dataset\.kkWebPerformance/);
  assert.match(settingsStylesSource, /\.settings-mobile-module-card[\s\S]*min-height:\s*68px/);
  assert.match(settingsStylesSource, /\.settings-mobile-account-card[\s\S]*min-height:\s*64px/);
  assert.doesNotMatch(dashboardSource, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(dashboardSource, /z-\[/);
});
