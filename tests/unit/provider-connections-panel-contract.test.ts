import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const PANEL_PATH = 'apps/web/src/components/settings/ProviderConnectionsPanel.tsx';

test('Provider Connections panel is feature-gated and uses the authenticated client boundary', () => {
  const source = fs.readFileSync(PANEL_PATH, 'utf8');

  assert.match(source, /getCapabilityGraphSnapshot/);
  assert.match(source, /createProviderConnection/);
  assert.match(source, /verifyProviderConnection/);
  assert.match(source, /type="password"/);
  assert.match(source, /FEATURE_DISABLED/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

