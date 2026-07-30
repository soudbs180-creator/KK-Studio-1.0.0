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

test('mobile settings home is the overview and does not render a duplicate overview destination', () => {
  const groups = buildMobileSettingsGroups(
    [
      createItem('dashboard', 'Overview'),
      createItem('generation-mode', 'Generation'),
      createItem('appearance-motion', 'Performance'),
    ],
    false,
  );

  assert.deepEqual(
    groups.map((group) => ({
      id: group.id,
      itemIds: group.items.map((item) => item.id),
    })),
    [
      { id: 'workspace', itemIds: ['generation-mode'] },
      { id: 'system', itemIds: ['appearance-motion'] },
    ],
  );
});

test('mobile settings topbar exposes home and nested navigation states without an extra back action', () => {
  assert.deepEqual(resolveMobileSettingsTopbarState(true, '能力来源', 'System Settings'), {
    title: 'System Settings',
    titleAlignment: 'center',
    showBackButton: false,
  });
  assert.deepEqual(resolveMobileSettingsTopbarState(false, '能力来源', 'System Settings'), {
    title: '能力来源',
    titleAlignment: 'start',
    showBackButton: true,
  });
});
