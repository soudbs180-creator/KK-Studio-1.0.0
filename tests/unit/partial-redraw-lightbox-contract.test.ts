import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('lightbox uses PartialRedrawModal and no longer wires the legacy inpaint contract', () => {
  const lightboxSource = readSource('src/components/image/GlobalLightbox.tsx');

  assert.match(lightboxSource, /import \{ PartialRedrawModal \} from '\.\/PartialRedrawModal';/);
  assert.match(lightboxSource, /onPartialRedraw\?: \(image: GeneratedImage, request: PartialRedrawRequest\) => void;/);
  assert.match(lightboxSource, /setShowPartialRedraw\(true\)/);
  assert.match(lightboxSource, /<PartialRedrawModal/);
  assert.doesNotMatch(lightboxSource, /InpaintModal/);
  assert.doesNotMatch(lightboxSource, /onInpaint/);
});
