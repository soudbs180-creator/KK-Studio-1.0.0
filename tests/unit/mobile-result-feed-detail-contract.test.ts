import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('mobile result feed stays card-focused and defers full result actions to a dedicated detail screen', () => {
  const feedSource = readSource('src/components/mobile/MobileResultFeed.tsx');
  const detailSource = readSource('src/components/mobile/MobileResultDetailScreen.tsx');

  assert.doesNotMatch(feedSource, /PartialRedrawModal/);
  assert.doesNotMatch(feedSource, /activeDetailResult/);
  assert.match(feedSource, /onEntryOpen/);

  assert.match(detailSource, /data-testid="mobile-result-detail-screen"/);
  assert.match(detailSource, /fullPrompt/);
  assert.match(detailSource, /referenceImages/);
  assert.match(detailSource, /onPreviewOriginal/);
  assert.match(detailSource, /onUseAsSource/);
  assert.match(detailSource, /onPartialRedraw/);
  assert.match(detailSource, /onDownload/);
  assert.match(detailSource, /onDelete/);
  assert.match(detailSource, /onPrevious/);
  assert.match(detailSource, /onNext/);
});
