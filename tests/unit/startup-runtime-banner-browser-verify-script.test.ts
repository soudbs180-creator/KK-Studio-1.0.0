import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('package.json exposes a startup runtime banner browser verification script', () => {
  const pkg = JSON.parse(readSource('package.json')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    pkg.scripts?.['verify:startup-runtime-banner-centering'],
    'node scripts/test/verify-startup-runtime-banner-centering.mjs',
  );
});

test('verify:changes pulls the startup runtime banner browser verification into the main verification chain once', () => {
  const pkg = JSON.parse(readSource('package.json')) as {
    scripts?: Record<string, string>;
  };

  const verifyChanges = pkg.scripts?.['verify:changes'] || '';

  assert.match(verifyChanges, /npm run verify:desktop-settings-smoke && npm run verify:startup-runtime-banner-centering/);
  assert.equal((verifyChanges.match(/verify:startup-runtime-banner-centering/g) || []).length, 1);
});

test('startup runtime banner browser verification uses stable selectors and checks center alignment after resize', () => {
  const scriptSource = readSource('scripts/test/verify-startup-runtime-banner-centering.mjs');
  const shellSource = readSource('apps/web/src/app/AuthenticatedAppShell.tsx');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const appSource = readSource('apps/web/src/App.tsx');
  const startupContextSource = readSource('apps/web/src/context/AppStartupContext.tsx');

  assert.match(scriptSource, /startup-runtime-banner/);
  assert.match(scriptSource, /prompt-bar-container/);
  assert.match(scriptSource, /input-bar-textarea/);
  assert.match(scriptSource, /deltaX/);
  assert.match(scriptSource, /setViewportSize/);
  assert.match(scriptSource, /throw new Error\(`Startup runtime banner is not centered to the prompt input/);
  assert.match(scriptSource, /runFallbackVerification/);
  assert.match(scriptSource, /sourceContractsVerified: true/);
  assert.match(scriptSource, /window\.__KK_STARTUP_SMOKE_HOLD_MS = 60_000;/);
  assert.doesNotMatch(scriptSource, /window\.setTimeout =/);

  assert.match(shellSource, /data-testid="startup-runtime-banner"/);
  assert.match(shellSource, /PROMPT_BAR_CONTAINER_ID = 'prompt-bar-container'/);
  assert.match(shellSource, /PROMPT_BAR_TEXTAREA_SELECTOR = 'textarea\.input-bar-textarea, textarea'/);
  assert.doesNotMatch(shellSource, /attributeFilter: \['class', 'style'\]/);
  assert.doesNotMatch(shellSource, /attributes: true/);
  assert.match(promptBarSource, /id="prompt-bar-container"/);
  assert.match(promptBarSource, /className=\{`input-bar-textarea/);
  assert.match(appSource, /showStartupBanner=\{rootMode === 'workspace'\}/);
  assert.match(startupContextSource, /__KK_STARTUP_SMOKE_HOLD_MS\?: number;/);
  assert.match(startupContextSource, /import\.meta\.env\.DEV/);
  assert.match(startupContextSource, /typeof window\.__KK_STARTUP_SMOKE_HOLD_MS === 'number'/);
});
