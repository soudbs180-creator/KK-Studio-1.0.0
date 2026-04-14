import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

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
  const shellSource = readSource('src/app/AuthenticatedAppShell.tsx');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.match(scriptSource, /startup-runtime-banner/);
  assert.match(scriptSource, /prompt-bar-container/);
  assert.match(scriptSource, /input-bar-textarea/);
  assert.match(scriptSource, /deltaX/);
  assert.match(scriptSource, /setViewportSize/);
  assert.match(scriptSource, /throw new Error\(`Startup runtime banner is not centered to the prompt input/);

  assert.match(shellSource, /data-testid="startup-runtime-banner"/);
  assert.match(shellSource, /PROMPT_BAR_CONTAINER_ID = 'prompt-bar-container'/);
  assert.match(shellSource, /PROMPT_BAR_TEXTAREA_SELECTOR = 'textarea\.input-bar-textarea, textarea'/);
  assert.match(promptBarSource, /id="prompt-bar-container"/);
  assert.match(promptBarSource, /className=\{`input-bar-textarea/);
});
