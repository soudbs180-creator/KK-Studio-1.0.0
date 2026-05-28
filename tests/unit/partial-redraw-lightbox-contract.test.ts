import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('lightbox uses the unified RedrawWorkspace and no longer wires the legacy inpaint contract', () => {
  const lightboxSource = readSource('src/components/image/GlobalLightbox.tsx');

  assert.match(lightboxSource, /import \{ RedrawWorkspace \} from '\.\/RedrawWorkspace';/);
  assert.match(lightboxSource, /onPartialRedraw\?: \(image: GeneratedImage, request: RedrawRequest\) => void;/);
  assert.match(lightboxSource, /setRedrawWorkspaceMode\('fresh'\)/);
  assert.match(lightboxSource, /setRedrawWorkspaceMode\('regenerate'\)/);
  assert.match(lightboxSource, /<RedrawWorkspace/);
  assert.match(lightboxSource, /initialRegions=\{redrawWorkspaceMode === 'regenerate'/);
  assert.doesNotMatch(lightboxSource, /InpaintModal/);
  assert.doesNotMatch(lightboxSource, /onInpaint/);
  assert.doesNotMatch(lightboxSource, /PartialRedrawModal/);
});
