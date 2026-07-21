import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test, beforeEach } from 'node:test';

const require = createRequire(import.meta.url);

const dataCollection = require('../../services/api/lib/data-collection/index.js');
const { registerPresetTools } = require('../../services/api/lib/data-collection/presetTools.js');

beforeEach(() => {
  dataCollection.clearTools();
});

test('registerTool stores and returns a validated tool definition', () => {
  dataCollection.registerTool({
    toolId: 'test_tool',
    description: 'A test tool',
    descriptionForModel: 'A test tool for unit tests',
    inputParameters: [{ name: 'q', type: 'string', description: 'query', required: true }],
    outputSchema: { type: 'object' },
    supportedChannels: ['api', 'browser-automation', 'hybrid-auto'],
    defaultChannel: 'hybrid-auto',
  });

  const tool = dataCollection.getTool('test_tool');
  assert.ok(tool);
  assert.equal(tool?.toolId, 'test_tool');
  assert.equal(tool?.defaultChannel, 'hybrid-auto');
});

test('preset tools include e-commerce research tools', () => {
  registerPresetTools();

  const amazon = dataCollection.getTool('search_amazon_product');
  assert.ok(amazon);
  assert.deepEqual(amazon?.supportedChannels, ['api', 'browser-automation', 'hybrid-auto']);

  const xhs = dataCollection.getTool('search_xiaohongshu_product');
  assert.ok(xhs);
  assert.equal(xhs?.defaultChannel, 'browser-automation');

  const analyzer = dataCollection.getTool('analyze_product_selling_points');
  assert.ok(analyzer);
  assert.deepEqual(analyzer?.supportedChannels, ['api']);
});

test('selectChannel honors explicit channel preference', () => {
  dataCollection.registerTool({
    toolId: 'explicit_test',
    description: 'test',
    descriptionForModel: 'test',
    supportedChannels: ['api', 'browser-automation'],
    defaultChannel: 'hybrid-auto',
  });

  const tool = dataCollection.getTool('explicit_test')!;
  assert.equal(dataCollection.selectChannel({ tool, preferredChannel: 'browser-automation' }), 'browser-automation');
  assert.equal(dataCollection.selectChannel({ tool, preferredChannel: 'api' }), 'api');
  assert.throws(
    () => dataCollection.selectChannel({ tool, preferredChannel: 'api', apiRateLimited: true }),
    (err: any) => err.code === 'CHANNEL_UNAVAILABLE',
  );

  assert.throws(
    () => dataCollection.selectChannel({ tool, preferredChannel: 'api', apiAvailable: false, browserAvailable: false }),
    (err: any) => err.code === 'CHANNEL_UNAVAILABLE',
  );
});

test('selectChannel auto-prefers api then falls back to browser', () => {
  dataCollection.registerTool({
    toolId: 'auto_test',
    description: 'test',
    descriptionForModel: 'test',
    supportedChannels: ['api', 'browser-automation', 'hybrid-auto'],
    defaultChannel: 'hybrid-auto',
  });

  const tool = dataCollection.getTool('auto_test')!;
  assert.equal(dataCollection.selectChannel({ tool }), 'api');
  assert.equal(dataCollection.selectChannel({ tool, apiAvailable: false }), 'browser-automation');
});

test('canFallbackToBrowser allows fallback from api rate limits', () => {
  dataCollection.registerTool({
    toolId: 'fallback_test',
    description: 'test',
    descriptionForModel: 'test',
    supportedChannels: ['api', 'browser-automation'],
    defaultChannel: 'hybrid-auto',
  });

  const tool = dataCollection.getTool('fallback_test')!;
  assert.equal(dataCollection.canFallbackToBrowser({ tool, failedChannel: 'api', errorCode: 'RATE_LIMITED' }), true);
  assert.equal(dataCollection.canFallbackToBrowser({ tool, failedChannel: 'browser-automation', errorCode: 'RATE_LIMITED' }), false);
  assert.equal(dataCollection.canFallbackToBrowser({ tool, failedChannel: 'api', errorCode: 'NOT_FOUND' }), false);
});
