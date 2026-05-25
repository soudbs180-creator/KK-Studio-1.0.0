import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
//
import { test } from 'node:test';

test('tutorial overlay keeps onboarding copy readable on mobile and desktop', () => {
  const source = readSource('src/components/common/TutorialOverlay.tsx');

  assert.match(source, /TUTORIAL_MOBILE_CARD_MAX_WIDTH\s*=\s*460/);
  assert.match(source, /TUTORIAL_DESKTOP_CARD_MAX_WIDTH\s*=\s*560/);
  assert.match(source, /splitTutorialDescription/);
  assert.match(source, /descriptionParts\.bullets\.map/);
  assert.match(source, /data-testid="tutorial-overlay-card"/);
  assert.match(source, /data-testid="tutorial-overlay-description"/);

  assert.doesNotMatch(source, /width:\s*`min\(360px, calc\(100vw - \$\{viewportMargin \* 2\}px\)\)`/);
  assert.doesNotMatch(source, /max-w-\[min\(360px,calc\(100vw-20px\)\)\]/);
  assert.doesNotMatch(source, /<p className="mb-8 text-\[14px\] leading-relaxed text-\[var\(--text-secondary\)\]">\s*\{step\.description\}\s*<\/p>/);
});
