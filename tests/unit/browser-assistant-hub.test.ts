import { test } from 'node:test';
import assert from 'node:assert';
import { siteRegistry } from '../../apps/web/src/features/browser-assistant/siteRegistry.ts';
import { browserTaskPlanner } from '../../apps/web/src/features/browser-assistant/browserTaskPlanner.ts';

test('Browser Assistant Hub - Site Registry Matcher', () => {
  const googleAdapter = siteRegistry.matchAdapter('https://www.google.com/search?q=test');
  assert.strictEqual(googleAdapter.siteId, 'google');

  const xhsAdapter = siteRegistry.matchAdapter('https://www.xiaohongshu.com/explore');
  assert.strictEqual(xhsAdapter.siteId, 'xiaohongshu');

  const genericAdapter = siteRegistry.matchAdapter('https://example-unknown-site.org');
  assert.strictEqual(genericAdapter.siteId, 'generic_web');
});

test('Browser Assistant Hub - NLP Task Planner', () => {
  const intent = browserTaskPlanner.plan('在谷歌上搜索关于 KK Studio 的信息');
  assert.strictEqual(intent.targetSite, 'google');
  assert.strictEqual(intent.actionType, 'search');
  assert.strictEqual(intent.outputTarget, 'canvas');

  const intentXhs = browserTaskPlanner.plan('从小红书提取笔记大纲 https://www.xiaohongshu.com/note/123');
  assert.strictEqual(intentXhs.targetSite, 'xiaohongshu');
  assert.strictEqual(intentXhs.actionType, 'extract');
  assert.strictEqual(intentXhs.targetUrl, 'https://www.xiaohongshu.com/note/123');
});
