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
  const tileSource = readSource('src/components/mobile/MobileResultTile.tsx');
  const detailSource = readSource('src/components/mobile/MobileResultDetailScreen.tsx');

  assert.doesNotMatch(feedSource, /PartialRedrawModal/);
  assert.doesNotMatch(feedSource, /activeDetailResult/);
  assert.match(feedSource, /onEntryOpen/);
  assert.match(feedSource, /viewMode:\s*ResultViewMode;/);
  assert.match(feedSource, /onViewModeChange:\s*\(viewMode: ResultViewMode\) => void;/);
  assert.match(feedSource, /surface:\s*ResponsiveSurface;/);
  assert.match(feedSource, /getAdaptiveResultColumnCount/);
  assert.match(feedSource, /getAdaptiveResultTileGridMetrics/);
  assert.match(feedSource, /gridAutoRows/);
  assert.doesNotMatch(feedSource, /columnCount,\s*columnGap/);
  assert.match(feedSource, /viewMode === 'detail'\s*\?/);
  assert.match(feedSource, /data-testid="mobile-result-empty-standard-skeleton"/);
  assert.match(feedSource, /data-testid="mobile-result-empty-detail-skeleton"/);
  assert.match(feedSource, /import MobileResultTile from '\.\/MobileResultTile';/);
  assert.match(feedSource, /<MobileResultTile/);
  assert.match(tileSource, /interface MobileResultTileProps/);
  assert.match(tileSource, /onEntryOpen: \(entryId: string\) => void;/);
  assert.match(tileSource, /onUseAsSource: \(imageId: string\) => void;/);
  assert.match(tileSource, /viewMode:\s*ResultViewMode;/);
  assert.match(tileSource, /gridMetrics/);
  assert.match(tileSource, /gridColumnEnd/);
  assert.match(tileSource, /gridRowEnd/);
  assert.match(tileSource, /mobileLayout/);
  assert.doesNotMatch(tileSource, /mobileTileSpan/);

  assert.match(detailSource, /data-testid="mobile-result-detail-screen"/);
  assert.match(detailSource, /fullPrompt/);
  assert.match(detailSource, /referenceImages/);
  assert.match(detailSource, /onPreviewOriginal/);
  assert.match(detailSource, /onUseAsSource/);
  assert.match(detailSource, /onPartialRedraw/);
  assert.match(detailSource, /onDownload/);
  assert.match(detailSource, /onDelete/);
  assert.match(detailSource, /data-testid="mobile-result-secondary-actions"/);
  assert.match(detailSource, /showSecondaryActions/);
  assert.match(detailSource, /onPrevious/);
  assert.match(detailSource, /onNext/);
});
