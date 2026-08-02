import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { readSource } from '../support/workspacePaths.js';

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'config/release-manifest.json'), 'utf8'),
) as { appName: string; version: string; displayVersion?: string };
const displayVersion = manifest.displayVersion || `v${manifest.version}`;

test('mobile app metadata follows the release manifest and product name', () => {
  const appConfig = JSON.parse(
    fs.readFileSync(path.join(root, 'apps/mobile/app.json'), 'utf8'),
  ) as { expo?: { name?: string; version?: string } };

  assert.equal(appConfig.expo?.version, manifest.version);
  assert.match(appConfig.expo?.name || '', new RegExp(manifest.appName));
});

test('the API proxy forwards the current release version', () => {
  const require = createRequire(import.meta.url);
  const adapter = require(
    path.join(root, 'services/api/lib/gateway/cliProxyApiAdapter.js'),
  ) as { buildSanitizedProxyHeaders: (headers?: Record<string, string>) => Record<string, string> };

  const headers = adapter.buildSanitizedProxyHeaders();
  assert.equal(headers['X-KK-Studio-Version'], manifest.version);
});

test('current web and mobile surfaces consume runtime version sources', () => {
  const webConsoleSource = readSource('apps/web/src/components/canvas/NewInfiniteCanvasConsole.tsx');
  const knowledgeStoreSource = readSource(
    'apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts',
  );
  const mobileHomeSource = readSource('apps/mobile/src/app/index.tsx');
  const mobileSettingsSource = readSource('apps/mobile/src/app/settings.tsx');

  assert.match(webConsoleSource, /APP_DISPLAY_VERSION/);
  assert.match(knowledgeStoreSource, /APP_DISPLAY_VERSION/);
  assert.match(mobileHomeSource, /MOBILE_APP_DISPLAY_VERSION/);
  assert.match(mobileSettingsSource, /MOBILE_APP_DISPLAY_VERSION/);
  assert.doesNotMatch(webConsoleSource, /v1\.6\.0 Pro/);
  assert.doesNotMatch(knowledgeStoreSource, /KK Studio v1\.6\.0/);
  assert.doesNotMatch(mobileHomeSource, /v1\.6\.0/);
  assert.doesNotMatch(mobileSettingsSource, /v1\.6\.0/);
});

test('current API references use the release version', () => {
  const openApiSource = readSource('docs/specs/openapi-full.yaml');
  const clientDocsSource = readSource('docs/api/typescript-client.md');
  const capabilityBaselineSource = readSource('AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md');

  assert.match(openApiSource, new RegExp(`^  version: ${manifest.version}$`, 'm'));
  const escapedDisplayVersion = displayVersion.replace(/\./g, '\\.');
  assert.match(clientDocsSource, new RegExp(`KK Studio ${escapedDisplayVersion}`));
  assert.match(capabilityBaselineSource, new RegExp(`KK Studio ${escapedDisplayVersion}`));
});
