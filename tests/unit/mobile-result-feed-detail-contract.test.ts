import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



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

  assert.match(detailSource, /onPrevious/);
  assert.match(detailSource, /onNext/);
});

test('mobile result feed localizes chrome copy instead of hard-coding English in Chinese workspace', () => {
  const feedSource = readSource('src/components/mobile/MobileResultFeed.tsx');
  const detailSource = readSource('src/components/mobile/MobileResultDetailScreen.tsx');

  assert.match(feedSource, /import \{ useLocale \} from '\.\.\/\.\.\/context\/LocaleContext';/);
  assert.match(feedSource, /const \{ pick \} = useLocale\(\);/);
  assert.match(feedSource, /const counterLabel = totalResults === 0 \? pick\([^)]*'Waiting'\)/);
  assert.match(feedSource, /const selectedSourceLabel = pick\([^)]*'source selected'\);/);
  assert.doesNotMatch(feedSource, />\s*Results\s*</);
  assert.doesNotMatch(feedSource, /totalResults === 0 \? 'Waiting'/);
  assert.doesNotMatch(feedSource, /\/ source selected/);

  assert.match(detailSource, /import \{ useLocale \} from '\.\.\/\.\.\/context\/LocaleContext';/);
  assert.match(detailSource, /const \{ pick \} = useLocale\(\);/);
  assert.match(detailSource, /pick\('[^']+', 'Framework Queue'\)/);
  assert.match(detailSource, /pick\('[^']+', 'Paused'\)/);
  assert.match(detailSource, /pick\('[^']+', 'Queued'\)/);
  assert.doesNotMatch(detailSource, />\s*Framework Queue\s*</);
  assert.doesNotMatch(detailSource, />Queued \{frameworkStatus\.queued\}/);
});

test('mobile shell breakpoint and result grid width stay reactive across tablet boundaries', () => {
  const shellSource = readSource('src/components/mobile/MobileAppShell.tsx');
  const feedSource = readSource('src/components/mobile/MobileResultFeed.tsx');
  const responsiveSurfaceSource = readSource('src/utils/responsiveSurface.ts');

  assert.match(responsiveSurfaceSource, /export const TABLET_MAX_WIDTH = 1023;/);
  assert.match(shellSource, /className="[^"]*\blg:hidden\b/);

  assert.match(feedSource, /const \[measuredWidth, setMeasuredWidth\] = React\.useState/);
  assert.match(feedSource, /window\.addEventListener\('resize', syncMeasuredWidth\);/);
  assert.match(feedSource, /window\.removeEventListener\('resize', syncMeasuredWidth\);/);
  assert.match(feedSource, /getFallbackWidth\(surface\)/);
});
