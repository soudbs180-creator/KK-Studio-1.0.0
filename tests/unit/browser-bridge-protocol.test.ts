import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBrowserBridgeCommand,
  redactBrowserBridgePayload,
  sanitizeBrowserBridgeUrl,
} from '../../apps/web/src/features/ai-assistant-runtime/browser/browserBridge.ts';

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
