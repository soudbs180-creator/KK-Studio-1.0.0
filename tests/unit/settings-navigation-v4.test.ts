import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolveCurrentSettingsDestination,
  SETTINGS_NAVIGATION_GROUPS,
} from '../../apps/web/src/components/settings/settingsNavigationRegistry.ts';
import { readSource } from '../support/workspacePaths.js';

test('desktop and mobile settings navigation share the approved three-part information architecture', () => {
  assert.deepEqual(
    SETTINGS_NAVIGATION_GROUPS.map((group) => ({
      id: group.id,
      label: group.labelZh,
      items: group.items.map((item) => ({ id: item.id, label: item.labelZh })),
    })),
    [
      {
        id: 'overview',
        label: '',
        items: [{ id: 'dashboard', label: '总览' }],
      },
      {
        id: 'integrations',
        label: '集成',
        items: [
          { id: 'capability-sources', label: 'API 配置' },
          { id: 'provider-routes', label: '能力配置' },
          { id: 'ai-takeover', label: 'AI 代理' },
        ],
      },
      {
        id: 'system',
        label: '系统维护',
        items: [
          { id: 'data-sync', label: '数据与安全' },
          { id: 'appearance-motion', label: '性能配置' },
          { id: 'dev-diagnostics', label: '系统日志' },
        ],
      },
    ],
  );
});

test('desktop and mobile render the same navigation group builder', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const dashboardSource = readSource('apps/web/src/components/settings/SettingsMobileDashboard.tsx');

  assert.match(shellSource, /getSettingsNavigationGroups/);
  assert.match(dashboardSource, /getSettingsNavigationGroups/);
  assert.doesNotMatch(shellSource, /const GROUPS/);
  assert.doesNotMatch(dashboardSource, /const navigationGroups = useMemo\(\(\) => \{/);
});

test('retired settings routes resolve to their merged destinations for one-version compatibility', () => {
  assert.equal(resolveCurrentSettingsDestination('generation-mode'), 'provider-routes');
  assert.equal(resolveCurrentSettingsDestination('browser-assistant'), 'provider-routes');
  assert.equal(resolveCurrentSettingsDestination('canvas-performance'), 'appearance-motion');
  assert.equal(resolveCurrentSettingsDestination('capability-sources'), 'capability-sources');
});

test('merged destination metadata uses the new product language', () => {
  const registrySource = readSource('apps/web/src/components/settings/settingsRegistry.ts');

  assert.match(registrySource, /'provider-routes':\s*\{[\s\S]*titleZh:\s*'能力配置'/);
  assert.match(registrySource, /'ai-takeover':\s*\{[\s\S]*titleZh:\s*'AI 代理'/);
  assert.match(registrySource, /'data-sync':\s*\{[\s\S]*titleZh:\s*'数据与安全'/);
  assert.match(registrySource, /'dev-diagnostics':\s*\{[\s\S]*titleZh:\s*'系统日志'/);
  assert.match(registrySource, /'appearance-motion':\s*\{[\s\S]*titleZh:\s*'性能配置'/);
});
