import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import type { GeneratedImage, PromptNode } from '../../src/types.ts';
import { selectMobileFeedResults } from '../../src/components/mobile/mobileFeedSelectors.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function createPromptNode(overrides: Partial<PromptNode> = {}): PromptNode {
  return {
    id: 'prompt-default',
    prompt: 'Default prompt',
    originalPrompt: 'Default prompt',
    childImageIds: [],
    referenceImages: [],
    timestamp: 0,
    modelLabel: 'Default model',
    ...overrides,
  } as PromptNode;
}

function createImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: 'image-default',
    url: 'https://example.com/default.png',
    prompt: 'Default image prompt',
    timestamp: 0,
    parentPromptId: 'prompt-default',
    model: 'default-model',
    modelLabel: 'Default model',
    aspectRatio: '1:1' as GeneratedImage['aspectRatio'],
    imageSize: '1K' as GeneratedImage['imageSize'],
    ...overrides,
  } as GeneratedImage;
}

describe('mobile home three-zone contract', () => {
  test('mobile shell uses a three-zone grid instead of sticky header/composer stacking', () => {
    const shellSource = readSource('src/components/mobile/MobileAppShell.tsx');
    const surfaceSource = readSource('src/components/mobile/MobileWorkspaceSurface.tsx');

    assert.match(
      shellSource,
      /gridTemplateRows:\s*'minmax\(0, var\(--mobile-home-header-share, 10fr\)\) minmax\(0, var\(--mobile-home-feed-share, 60fr\)\) minmax\(0, var\(--mobile-home-composer-share, 30fr\)\)'/,
    );
    assert.doesNotMatch(shellSource, /sticky top-0/);
    assert.doesNotMatch(shellSource, /sticky bottom-0/);
    assert.match(surfaceSource, /data-mobile-home-shell="three-zone"/);
    assert.doesNotMatch(surfaceSource, /grid-cols-\[minmax\(0,1fr\)_56px\]/);
  });

  test('mobile feed selector computes adaptive tile metadata from exact dimensions and aspect ratio', () => {
    const prompt = createPromptNode({ id: 'prompt-home' });
    const entries = selectMobileFeedResults(
      [prompt],
      [
        createImage({
          id: 'wide-hero',
          parentPromptId: 'prompt-home',
          exactDimensions: { width: 2400, height: 1200 },
          aspectRatio: '16:9' as GeneratedImage['aspectRatio'],
        }),
        createImage({
          id: 'square-compact',
          parentPromptId: 'prompt-home',
          aspectRatio: '1:1' as GeneratedImage['aspectRatio'],
        }),
        createImage({
          id: 'portrait-standard',
          parentPromptId: 'prompt-home',
          aspectRatio: '3:4' as GeneratedImage['aspectRatio'],
        }),
      ],
    );

    const wide = entries.find((entry) => entry.id === 'wide-hero');
    const square = entries.find((entry) => entry.id === 'square-compact');
    const portrait = entries.find((entry) => entry.id === 'portrait-standard');

    assert.equal(wide?.mobileTileSpan, 6);
    assert.equal(wide?.mobileTileEmphasis, 'hero');
    assert.equal(square?.mobileTileSpan, 2);
    assert.equal(square?.mobileTileEmphasis, 'compact');
    assert.equal(portrait?.mobileTileSpan, 3);
    assert.equal(portrait?.mobileTileEmphasis, 'standard');
  });

  test('embedded mobile composer exposes dedicated mode, input, and advanced-drawer sections', () => {
    const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

    assert.match(promptBarSource, /const isEmbeddedMobileComposer = isMobile && mobileShellMode === 'embedded';/);
    assert.match(promptBarSource, /data-mobile-composer-section="mode-strip"/);
    assert.match(promptBarSource, /data-mobile-composer-section="primary-input"/);
    assert.match(promptBarSource, /data-mobile-composer-section="advanced-drawer"/);
    assert.match(promptBarSource, /!isEmbeddedMobileComposer && \(/);
    assert.match(promptBarSource, /<DesktopComposerPromptTools/);
  });
});
