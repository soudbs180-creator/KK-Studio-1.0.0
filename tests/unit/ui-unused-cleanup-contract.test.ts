import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PromptBar does not retain source-proven unused UI code', () => {
  const source = readSource('src/components/layout/PromptBar.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/ui-unused-cleanup-contract\.test\.ts/);
  assert.doesNotMatch(source, /const getRatioDimensions = /);
  assert.doesNotMatch(source, /const getRatioIcon = /);
  assert.doesNotMatch(source, /const textColorStyle = /);
  assert.doesNotMatch(source, /const \[flyingImage/);
  assert.doesNotMatch(source, /flyToTarget/);
  assert.doesNotMatch(source, /isInputAreaHovered/);
  assert.doesNotMatch(source, /hoverTimerRef/);
  assert.doesNotMatch(source, /const estimatedCredits = /);
  assert.doesNotMatch(source, /const data = matches\[2\];/);
  assert.doesNotMatch(source, /const currentModelUsesLightSurface = /);
  assert.doesNotMatch(source, /wrapperTouchStartY/);
  assert.doesNotMatch(source, /const handleContainerTouchStart = /);
  assert.doesNotMatch(source, /const handleContainerTouchEnd = /);
  assert.doesNotMatch(source, /const handleTouchStart = /);
  assert.doesNotMatch(source, /const handleTouchEnd = /);
  assert.doesNotMatch(source, /onTouchStart=\{handleTouchStart\}/);
  assert.doesNotMatch(source, /onTouchEnd=\{handleTouchEnd\}/);
  assert.doesNotMatch(source, /const topControlsNode = /);
  assert.doesNotMatch(source, /const ecommercePanelNode = /);
  assert.doesNotMatch(source, /const inputAreaNode = /);
  assert.doesNotMatch(source, /const badgeInfo = getModelBadgeInfo\(\{ id: currentModel\?\.id/);
  assert.match(source, /saveModelCustomization\(\s*modelSettingsModal\.modelId,\s*modelSettingsModal\.alias,\s*modelSettingsModal\.description\s*\);/);
});

test('ImageCard2 does not retain source-proven unused lightbox remnants', () => {
  const source = readSource('src/components/image/ImageCard2.tsx');

  assert.doesNotMatch(source, /import ReactDOM from 'react-dom';/);
  assert.doesNotMatch(source, /import \{ AspectRatio,/);
  assert.doesNotMatch(source, /useLazyImage/);
  assert.doesNotMatch(source, /showLightbox/);
  assert.doesNotMatch(source, /lightboxZoom/);
  assert.doesNotMatch(source, /lightboxPan/);
  assert.doesNotMatch(source, /isPanning/);
  assert.doesNotMatch(source, /panStartRef/);
  assert.doesNotMatch(source, /panStartPosRef/);
  assert.doesNotMatch(source, /lightboxRef/);
  assert.doesNotMatch(source, /openTimeRef/);
  assert.doesNotMatch(source, /wheelCleanupRef/);
  assert.doesNotMatch(source, /adaptiveSubBorderWidth/);
});

test('legacy DashboardView does not retain unused icon imports', () => {
  const source = readSource('src/components/settings/views/DashboardView.tsx');
  const localizedSource = readSource('src/components/settings/views/DashboardView.localized.tsx');

  assert.doesNotMatch(source, /\bAlertTriangle,/);
  assert.doesNotMatch(source, /\bShieldCheck,/);
  assert.doesNotMatch(source, /\bWallet,/);
  assert.match(localizedSource, /\bWallet,/);
});
