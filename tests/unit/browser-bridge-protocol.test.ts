import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createBrowserBridgeCommand,
  getBrowserBridgeOwnerStorageKey,
  redactBrowserBridgePayload,
  sanitizeBrowserBridgeUrl,
} from '../../apps/web/src/features/ai-assistant-runtime/browser/browserBridge.ts';

const bridgeSource = readFileSync(
  new URL('../../apps/web/src/features/ai-assistant-runtime/browser/browserBridge.ts', import.meta.url),
  'utf8',
);
const browserAssistantSource = readFileSync(
  new URL('../../apps/web/src/components/settings/views/BrowserAssistantView.tsx', import.meta.url),
  'utf8',
);

test('Browser Bridge URL sanitizer accepts ordinary http and https URLs', () => {
  assert.equal(
    sanitizeBrowserBridgeUrl('https://detail.tmall.com/item.htm?id=6582930281'),
    'https://detail.tmall.com/item.htm?id=6582930281'
  );
  assert.equal(
    sanitizeBrowserBridgeUrl('http://example.com/product?q=1'),
    'http://example.com/product?q=1'
  );
});

test('Browser Bridge URL sanitizer blocks local files, browser internals, data URLs, localhost, and private networks', () => {
  const blockedUrls = [
    'file:///C:/Users/Administrator/secrets.txt',
    'chrome://settings/passwords',
    'data:text/html;base64,PHNjcmlwdD4=',
    'http://localhost:9099/status',
    'http://127.0.0.1:8080/admin',
    'http://10.0.0.2/internal',
    'http://172.16.0.5/internal',
    'http://192.168.1.12/router',
    'http://[::1]/admin',
    'http://[fc00::1]/internal',
    'http://[fe80::1]/internal'
  ];

  for (const url of blockedUrls) {
    assert.throws(() => sanitizeBrowserBridgeUrl(url), /Browser Bridge/);
  }
});

test('Browser Bridge command factory creates auditable user-gesture commands', () => {
  const command = createBrowserBridgeCommand({
    kind: 'extract_product',
    target: 'https://example.com/item/1',
    payload: { targets: ['price', 'title'] },
    requiresUserGesture: true
  });

  assert.match(command.id, /^browser_cmd_/);
  assert.equal(command.kind, 'extract_product');
  assert.equal(command.target, 'https://example.com/item/1');
  assert.equal(command.requiresUserGesture, true);
  assert.equal(typeof command.createdAt, 'number');
});

test('Browser Bridge command factory keeps active_tab only for direct user bridge commands', () => {
  const command = createBrowserBridgeCommand({
    kind: 'inspect_page',
    target: 'active_tab',
    payload: { source: 'direct-user-click' },
    requiresUserGesture: true,
  });
  assert.equal(command.target, 'active_tab');
});

test('Browser Bridge storage keys are owner-qualified', () => {
  assert.equal(
    getBrowserBridgeOwnerStorageKey('sessions', 'owner/a'),
    'kk_browser_owner:owner%2Fa:sessions',
  );
  assert.notEqual(
    getBrowserBridgeOwnerStorageKey('sessions', 'owner-a'),
    getBrowserBridgeOwnerStorageKey('sessions', 'owner-b'),
  );
});

test('Browser Bridge does not broadcast or log raw native messages', () => {
  assert.doesNotMatch(bridgeSource, /Global Native WS Message/);
  assert.doesNotMatch(bridgeSource, /browser-bridge-message/);
  assert.match(bridgeSource, /subscribeBrowserBridgeCommand/);
});

test('Browser Assistant persists sessions through owner-qualified storage keys', () => {
  assert.match(browserAssistantSource, /getBrowserBridgeOwnerStorageKey\('sessions', browserOwnerId\)/);
  assert.match(browserAssistantSource, /getBrowserBridgeOwnerStorageKey\('selected_sessions', browserOwnerId\)/);
  assert.doesNotMatch(browserAssistantSource, /localStorage\.setItem\('kk_browser_sessions'/);
  assert.doesNotMatch(browserAssistantSource, /localStorage\.setItem\('kk_browser_selected_sessions'/);
});

test('Browser Assistant invalidates async work and clears owner-derived state on account changes', () => {
  assert.match(browserAssistantSource, /browserOwnerEpochRef\.current \+= 1/);
  assert.match(browserAssistantSource, /workerRef\.current\?\.terminate\(\)/);
  assert.match(browserAssistantSource, /isBrowserOwnerScopeCurrent\(ownerScope\)/);
  assert.match(browserAssistantSource, /setTargetUrl\(''\)/);
  assert.match(browserAssistantSource, /setExtractedData\(null\)/);
  assert.match(browserAssistantSource, /setPipelineLogs\(\[\]\)/);
  assert.match(browserAssistantSource, /setEditedTitle\(''\)/);
  assert.match(browserAssistantSource, /setEditedPrice\(''\)/);
  assert.match(browserAssistantSource, /setZippedFileLoc\(null\)/);
  assert.match(browserAssistantSource, /setPlatforms\(DEFAULT_BROWSER_PLATFORMS\.map/);
  assert.match(browserAssistantSource, /workerRef\.current\.onmessage = \(e\) => \{\s*if \(!isBrowserOwnerScopeCurrent\(ownerScope\)\) return;/);
});

test('Browser Bridge command factory derives a stable command id and payload key from idempotency', () => {
  const first = createBrowserBridgeCommand({
    kind: 'generate_external',
    payload: { prompt: 'same request' },
    idempotencyKey: 'run-browser:generate-external:1',
    requiresUserGesture: true,
  });
  const second = createBrowserBridgeCommand({
    kind: 'generate_external',
    payload: { prompt: 'same request' },
    idempotencyKey: 'run-browser:generate-external:1',
    requiresUserGesture: true,
  });

  assert.equal(first.id, second.id);
  assert.equal(first.idempotencyKey, 'run-browser:generate-external:1');
  assert.equal(first.payload.idempotencyKey, 'run-browser:generate-external:1');
});

test('Browser Bridge command keeps execution payload and stores a redacted audit payload', () => {
  const longPrompt = 'Create a realistic ecommerce poster with soft daylight, a clear product label, and a clean offer badge.';
  const command = createBrowserBridgeCommand({
    kind: 'generate_external',
    payload: {
      prompt: longPrompt,
      apiKey: 'sk-1234567890abcdef'
    },
    requiresUserGesture: true
  });

  assert.equal(command.payload.prompt, longPrompt);
  assert.equal(command.payload.apiKey, 'sk-1234567890abcdef');
  assert.equal(command.auditPayload?.prompt, '[redacted]');
  assert.equal(command.auditPayload?.apiKey, '[redacted]');
});

test('Browser Bridge payload redaction strips credentials and long opaque strings', () => {
  const redacted = redactBrowserBridgePayload({
    authorization: 'Bearer abcdefghijklmnopqrstuvwxyz0123456789.secret',
    apiKey: 'sk-1234567890abcdef',
    cookie: 'session=abcdef',
    safe: 'product title',
    hugeToken: 'a'.repeat(80)
  });

  assert.equal(redacted.authorization, '[redacted]');
  assert.equal(redacted.apiKey, '[redacted]');
  assert.equal(redacted.cookie, '[redacted]');
  assert.equal(redacted.safe, 'product title');
  assert.equal(redacted.hugeToken, '[redacted]');
});
