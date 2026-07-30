import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('legacy UI aliases resolve to the current semantic token system', () => {
  const tokenSource = readSource('apps/web/src/styles/tokens.css');

  assert.match(tokenSource, /--primary:\s*var\(--accent-color\);/);
  assert.match(tokenSource, /--primary-light:\s*var\(--toolbar-active\);/);
  assert.match(tokenSource, /--radius-control-lg:\s*var\(--radius-surface-md\);/);
});

test('task center uses the same inclusive 768px phone boundary as runtime detection', () => {
  const responsiveSource = readSource('apps/web/src/utils/responsiveSurface.ts');
  const uiSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  assert.match(responsiveSource, /PHONE_MAX_WIDTH\s*=\s*768/);
  assert.match(
    uiSource,
    /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.kk-task-center-host\[data-mobile='true'\]/,
  );
});

test('storage maintenance actions share the canonical touch target and caption scale', () => {
  const source = readSource('apps/web/src/components/settings/views/StorageSettingsView.localized.tsx');
  const sharedActionCount = source.match(/<SettingsActionButton/g)?.length ?? 0;

  assert.ok(sharedActionCount >= 10, 'storage actions should use the shared settings button');
  assert.match(source, /<SettingsActionButton[\s\S]*?size="sm"/);
  assert.doesNotMatch(source, /STORAGE_COMPACT_ACTION_CLASS|active:scale-/);
});

test('primary overlays share dialog semantics, focus trapping, Escape handling, and focus restoration', () => {
  const focusHookSource = readSource('apps/web/src/hooks/useOverlayFocusLifecycle.ts');
  const searchSource = readSource('apps/web/src/components/layout/SearchPalette.tsx');
  const settingsSource = readSource('apps/web/src/components/settings/SettingsWorkbenchPanel.tsx');
  const mobileSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');

  assert.match(focusHookSource, /FOCUSABLE_SELECTOR/);
  assert.match(focusHookSource, /event\.key === 'Escape'/);
  assert.match(focusHookSource, /event\.key !== 'Tab'/);
  assert.match(focusHookSource, /invokerRef\.current\?\.focus\(\)/);

  for (const source of [searchSource, settingsSource, mobileSource]) {
    assert.match(source, /useOverlayFocusLifecycle/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
  }
});
