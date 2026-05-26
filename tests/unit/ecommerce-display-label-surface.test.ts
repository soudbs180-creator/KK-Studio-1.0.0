import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce business display labels propagate to desktop and mobile result surfaces', () => {
  const postBuildSyncSource = readSource('src/app/useEcommercePostBuildSyncRuntime.ts');
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');
  const mobileSelectorSource = readSource('src/components/mobile/mobileFeedSelectors.ts');
  const mobileFeedSource = readSource('src/components/mobile/MobileResultFeed.tsx');
  const mobileTileSource = readSource('src/components/mobile/MobileResultTile.tsx');
  const mobileDetailSource = readSource('src/components/mobile/MobileResultDetailScreen.tsx');

  assert.match(postBuildSyncSource, /displayLabel:\s*renderTask\.displayLabel/);
  assert.match(promptNodeSource, /getPromptBusinessDisplayLabel/);
  assert.match(mobileSelectorSource, /displayLabel:\s*resolveDisplayLabel\(imageNode,\s*promptNode\)/);
  assert.match(mobileFeedSource, /<MobileResultTile/);
  assert.match(mobileFeedSource, /entry=\{entry\}/);
  assert.match(mobileTileSource, /entry\.displayLabel\s*\|\|/);
  assert.match(mobileDetailSource, /displayLabel/);
});

test('ecommerce framework header exposes an editable remark name with up to five adjacent tags', () => {
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');
  const thumbnailBranch = promptNodeSource.slice(
    promptNodeSource.indexOf("if (detailLevel === 'thumbnail-shell')"),
    promptNodeSource.indexOf('{shellReferenceImages.length > 0 &&')
  );

  assert.match(promptNodeSource, /isEcommerceFrameworkCard/);
  assert.match(promptNodeSource, /handleFrameworkRemarkCommit/);
  assert.match(promptNodeSource, /data-testid="ecommerce-framework-remark-input"/);
  assert.match(promptNodeSource, /data-testid="ecommerce-framework-header-tags"/);
  assert.match(promptNodeSource, /node\.tags\?\.slice\(0,\s*5\)/);
  assert.match(promptNodeSource, /onUpdateNode\?\.\(\{[\s\S]*ecommerce:[\s\S]*displayLabel:/);
  assert.match(thumbnailBranch, /isEcommerceFrameworkCard \? \(/);
  assert.match(thumbnailBranch, /renderEcommerceFrameworkHeaderContent\(true\)/);
});
