import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { PlatformRuntimeCapabilitySnapshotDtoSchema } from '../../packages/shared/src/index.ts';
import {
  BrowserPlatformRuntimeAdapter,
  type BrowserPlatformRuntimeAdapterOptions,
} from '../../apps/web/src/platform/runtime/BrowserPlatformRuntimeAdapter.ts';
import type { PlatformRuntimeOperation } from '../../apps/web/src/platform/runtime/PlatformRuntimePort.ts';
import { readSource, workspacePath } from '../support/workspacePaths.js';

const FIXED_NOW = '2026-08-13T12:00:00.000Z';
const TEST_APP_INFO = {
  name: 'KK Studio',
  version: '1.6.1',
  displayVersion: 'v1.6.1',
  releaseTarget: '1.7.0',
  releasePhase: 'development',
  releaseSequence: 0,
  artifactVersion: '1.7.0-alpha.0.0',
} as const;

function createAdapter(
  overrides: Partial<BrowserPlatformRuntimeAdapterOptions> = {},
): BrowserPlatformRuntimeAdapter {
  return new BrowserPlatformRuntimeAdapter({
    appInfo: TEST_APP_INFO,
    now: () => new Date(FIXED_NOW),
    ...overrides,
  });
}

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [absolutePath] : [];
  });
}

test('browser adapter preserves current app identity and reports only integrated host capabilities', () => {
  const runtime = createAdapter();

  assert.deepEqual(runtime.getAppInfo(), TEST_APP_INFO);
  const snapshot = runtime.getCapabilitySnapshot();
  assert.equal(PlatformRuntimeCapabilitySnapshotDtoSchema.safeParse(snapshot).success, true);
  assert.equal(snapshot.runtimeKind, 'browser');
  assert.equal(snapshot.operatingSystem, 'browser');
  assert.equal(snapshot.appVersion, TEST_APP_INFO.version);
  assert.equal(snapshot.releaseChannel, 'development');
  assert.equal(snapshot.observedAt, FIXED_NOW);
  assert.deepEqual(snapshot.capabilities, [{ capability: 'app-info', availability: 'supported' }]);
});

test('browser adapter returns typed app info and structured unsupported operation results', async () => {
  const runtime = createAdapter();

  assert.deepEqual(await runtime.execute('get-app-info'), {
    schemaVersion: 1,
    operation: 'get-app-info',
    status: 'success',
    value: TEST_APP_INFO,
  });
  assert.deepEqual(await runtime.execute('install-update'), {
    schemaVersion: 1,
    operation: 'install-update',
    status: 'unsupported',
    reasonCode: 'desktop_only',
    recoveryActions: ['open_documentation'],
  });
  assert.deepEqual(await runtime.execute('open-file'), {
    schemaVersion: 1,
    operation: 'open-file',
    status: 'unsupported',
    reasonCode: 'capability_unavailable',
    recoveryActions: [],
  });
  assert.deepEqual(await runtime.execute('store-credential-reference'), {
    schemaVersion: 1,
    operation: 'store-credential-reference',
    status: 'unsupported',
    reasonCode: 'browser_restricted',
    recoveryActions: ['open_documentation'],
  });

  const allOperations: PlatformRuntimeOperation[] = [
    'get-app-info',
    'request-window-action',
    'open-file',
    'save-file',
    'import-workspace',
    'export-workspace',
    'handoff-deep-link',
    'check-update',
    'install-update',
    'get-local-runner-health',
    'pair-runtime',
    'show-notification',
    'store-credential-reference',
  ];
  const operationResults = await Promise.all(allOperations.map((operation) => runtime.execute(operation)));
  assert.equal(operationResults.every((result) => result.status === 'success' || result.status === 'unsupported'), true);
});

test('composition root injects the browser runtime and one version surface consumes the port', () => {
  const mainSource = readSource('apps/web/src/main.tsx');
  const landingSource = readSource('apps/web/src/landing/LandingCTA.tsx');

  assert.match(mainSource, /new BrowserPlatformRuntimeAdapter\(\)/);
  assert.match(mainSource, /<PlatformRuntimeProvider runtime=\{browserPlatformRuntime\}>/);
  assert.match(landingSource, /usePlatformRuntime\(\)/);
  assert.match(landingSource, /getAppInfo\(\)\.displayVersion/);
  assert.doesNotMatch(landingSource, /APP_DISPLAY_VERSION/);
});

test('platform port owns no canvas, job, run, agent, or tool execution truth', () => {
  const portSource = readSource('apps/web/src/platform/runtime/PlatformRuntimePort.ts');
  const adapterSource = readSource('apps/web/src/platform/runtime/BrowserPlatformRuntimeAdapter.ts');
  const combinedSource = `${portSource}\n${adapterSource}`;

  for (const authorityName of [
    'CanvasRuntimeState',
    'DurableGenerationQueue',
    'AgentRunStore',
    'ToolRegistry',
  ]) {
    assert.doesNotMatch(combinedSource, new RegExp(authorityName));
  }
});

test('business code cannot bypass the platform port with Tauri globals, invoke calls, or Rust command strings', () => {
  const sourceRoot = workspacePath('apps/web/src');
  const platformRuntimeRoot = `${path.sep}platform${path.sep}runtime${path.sep}`;
  const businessSources = listSourceFiles(sourceRoot)
    .filter((filePath) => !filePath.includes(platformRuntimeRoot));
  const bypassPattern = /__TAURI(?:_INTERNALS)?__|@tauri-apps\/api|\binvoke\s*\(|tauri::command|invoke_handler/;
  const rustCommandPattern = /['"`](?:get_app_info|request_window_action|open_file|save_file|import_workspace|export_workspace|handoff_deep_link|check_update|install_update|get_local_runner_health|pair_runtime|show_notification|store_credential_reference)['"`]/;

  for (const filePath of businessSources) {
    const source = fs.readFileSync(filePath, 'utf8');
    assert.doesNotMatch(source, bypassPattern, path.relative(sourceRoot, filePath));
    assert.doesNotMatch(source, rustCommandPattern, path.relative(sourceRoot, filePath));
  }
});
