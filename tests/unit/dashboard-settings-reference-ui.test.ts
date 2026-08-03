import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('settings overview uses the compact reference surface and stable dashboard grid', () => {
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchPanel.tsx');
  const styles = readSource('apps/web/src/styles/settings-dashboard-refit.css');

  assert.match(dashboardSource, /SettingsViewShell className="settings-dashboard-refit"/);
  assert.match(shellSource, /settings-dashboard-refit\.css/);
  assert.match(styles, /dashboard-console-metrics[\s\S]*grid-auto-rows:\s*78px/);
  assert.match(styles, /dashboard-command-center[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /dashboard-panel__icon[\s\S]*width:\s*28px[\s\S]*height:\s*28px/);
  assert.match(styles, /dashboard-preference-stack[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 759px\)/);
});
