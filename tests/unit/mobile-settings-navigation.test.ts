import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildMobileSettingsGroups,
  resolveMobileSettingsTopbarState,
} from '../../apps/web/src/components/settings/mobileSettingsNavigation.ts';
import type { SettingsNavItem } from '../../apps/web/src/components/settings/settingsRegistry.ts';

const createItem = (id: SettingsNavItem['id'], label: string): SettingsNavItem => ({
  id,
  label,
  description: `${label} description`,
  icon: () => null,
  section: id === 'generation-mode' ? 'workspace' : 'system',
  path: id,
});

test('mobile settings home uses the shared taxonomy without rendering a duplicate overview destination', () => {
  const groups = buildMobileSettingsGroups(
    [
      createItem('dashboard', 'Overview'),
      createItem('capability-sources', 'API'),
      createItem('provider-routes', 'Capabilities'),
      createItem('ai-takeover', 'Agent'),
      createItem('data-sync', 'Data'),
      createItem('appearance-motion', 'Performance'),
      createItem('dev-diagnostics', 'Logs'),
    ],
    false,
  );

  assert.deepEqual(
    groups.map((group) => ({
      id: group.id,
      itemIds: group.items.map((item) => item.id),
    })),
    [
      { id: 'integrations', itemIds: ['capability-sources', 'provider-routes', 'ai-takeover'] },
      { id: 'system', itemIds: ['data-sync', 'appearance-motion', 'dev-diagnostics'] },
    ],
  );
});

test('mobile settings topbar left-aligns the home title and centers nested titles beside a back action', () => {
  assert.deepEqual(resolveMobileSettingsTopbarState(true, '能力来源', 'System Settings'), {
    title: 'System Settings',
    titleAlignment: 'start',
    showBackButton: false,
  });
  assert.deepEqual(resolveMobileSettingsTopbarState(false, '能力来源', 'System Settings'), {
    title: '能力来源',
    titleAlignment: 'center',
    showBackButton: true,
  });
});
