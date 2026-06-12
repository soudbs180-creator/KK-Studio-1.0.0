import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('mobile result feed stays card-focused and defers full result actions to a dedicated detail screen', () => {
  const feedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const tileSource = readSource('apps/web/src/components/mobile/MobileResultTile.tsx');
  const detailSource = readSource('apps/web/src/components/mobile/MobileResultDetailScreen.tsx');

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
  assert.match(tileSource, /const \[isImageLoaded, setIsImageLoaded\] = React\.useState\(false\);/);
  assert.match(tileSource, /data-testid="mobile-result-image-skeleton"/);
  assert.match(tileSource, /style=\{\{ aspectRatio: imageAspectRatio, minHeight: '120px' \}\}/);
  assert.match(tileSource, /onLoad=\{\(\) => setIsImageLoaded\(true\)\}/);
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
  assert.match(detailSource, /const stopMobileActionPropagation = \(event: React\.SyntheticEvent\) => \{/);
  assert.match(detailSource, /onPointerDown=\{stopMobileActionPropagation\}/);
  assert.match(detailSource, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*onClick\(\);/);
  assert.match(detailSource, /data-testid="mobile-result-detail-image-skeleton"/);
  assert.match(detailSource, /sticky bottom-0 z-30 pointer-events-auto touch-manipulation/);
});

test('mobile result feed localizes chrome copy instead of hard-coding English in Chinese workspace', () => {
  const feedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const detailSource = readSource('apps/web/src/components/mobile/MobileResultDetailScreen.tsx');

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
  const shellSource = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');
  const feedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const responsiveSurfaceSource = readSource('apps/web/src/utils/responsiveSurface.ts');

  assert.match(responsiveSurfaceSource, /export const TABLET_MAX_WIDTH = 1023;/);
  assert.match(shellSource, /className="[^"]*\blg:hidden\b/);

  assert.match(feedSource, /const \[measuredWidth, setMeasuredWidth\] = React\.useState/);
  assert.match(feedSource, /window\.addEventListener\('resize', syncMeasuredWidth\);/);
  assert.match(feedSource, /window\.removeEventListener\('resize', syncMeasuredWidth\);/);
  assert.match(feedSource, /getFallbackWidth\(surface\)/);
});

test('mobile result feed handles isLoading state and displays customized empty state with default Chinese copy', () => {
  const feedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');

  // 1. 验证新增的 isLoading 参数存在于 Props 接口中
  assert.match(feedSource, /isLoading\?: boolean;/);

  // 2. 验证空状态组件 MobileResultFeedEmptyState 存在
  assert.match(feedSource, /const MobileResultFeedEmptyState: React.FC/);

  // 3. 验证默认中文 “我们从哪里开始？” 及其英文 “Where should we start?” 兜底
  assert.match(feedSource, /pick\('我们从哪里开始？', 'Where should we start\?'\)/);

  // 4. 验证在没有数据时，若 isLoading 开启则显示骨架屏，否则显示空状态
  assert.match(feedSource, /isLoading \?/);
  assert.match(feedSource, /<MobileResultFeedEmptyState \/>/);
  assert.match(feedSource, /data-testid="mobile-result-empty-state"/);
});

test('mobile result bottom controls stop touch and pointer events before they reach the feed', () => {
  const feedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const detailSource = readSource('apps/web/src/components/mobile/MobileResultDetailScreen.tsx');

  assert.match(feedSource, /const stopMobileResultControlEvent = \(event: React\.SyntheticEvent\) => \{/);
  assert.match(feedSource, /onPointerDown=\{stopMobileResultControlEvent\}/);
  assert.match(feedSource, /kk-result-bottom-bar/);
  assert.match(feedSource, /className="w-full flex touch-manipulation items-center justify-between gap-3 pointer-events-auto py-1"/);
  assert.match(feedSource, /kk-result-control kk-result-danger-control flex touch-manipulation items-center gap-1 rounded-full/);
  assert.match(feedSource, /handleBatchDelete\(\);/);

  assert.match(detailSource, /onTouchStart=\{stopMobileActionPropagation\}/);
  assert.match(detailSource, /onTouchMove=\{stopMobileActionPropagation\}/);
  assert.match(detailSource, /onTouchEnd=\{stopMobileActionPropagation\}/);
});

