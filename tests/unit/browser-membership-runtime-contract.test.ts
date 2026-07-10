import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBrowserMembershipSetupError,
  isBrowserMembershipRoute,
} from '../../apps/web/src/core/generation/browserMembershipRoute.ts';
import { readSource } from '../support/workspacePaths.js';

test('browser membership routes are explicitly handed to Browser Assistant', () => {
  assert.equal(isBrowserMembershipRoute('user-owned-web-provider'), true);
  assert.equal(isBrowserMembershipRoute('browser-assistant-opencli'), true);
  assert.equal(isBrowserMembershipRoute('cloud-platform-key'), false);

  const error = createBrowserMembershipSetupError('browser-assistant-opencli');
  assert.equal(error.code, 'SETUP_REQUIRED');
  assert.equal(error.setupAction, 'browser-assistant');
  assert.match(error.message, /Browser Assistant/);
});

test('capability settings report the canonical Browser Bridge status instead of a hardcoded ready state', () => {
  const source = readSource('apps/web/src/components/settings/views/CapabilitySourcesView.tsx');

  assert.match(source, /toolRegistryInstance\.execute\('browser\.getStatus'/);
  assert.match(source, /browserBridgeStatus/);
  assert.doesNotMatch(source, /SettingsBadge tone="emerald">\{pick\('[^']*', 'Ready'\)\}<\/SettingsBadge>/);
});

test('first-use controls expose a clear creation action and labels for icon-only tutorial controls', () => {
  const landingSource = readSource('apps/web/src/landing/KkLandingPage.tsx');
  const tutorialSource = readSource('apps/web/src/components/common/TutorialOverlay.tsx');

  assert.match(landingSource, /zh: '开始创作'/);
  assert.match(landingSource, /className="kk-landing-work-pill"[\s\S]*?onClick=\{primaryAction\}/);
  assert.match(tutorialSource, /aria-label="关闭引导"/);
  assert.match(tutorialSource, /aria-label="上一步"/);
});
