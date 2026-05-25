import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('App creates REDRAW prompt nodes and generation pipeline composites redraw outputs', () => {
  const appSource = readSource('src/App.tsx');
  const globalModalsSource = readSource('src/app/AppGlobalModals.tsx');
  const mobileWorkspaceSource = readSource('src/app/AppMobileWorkspace.tsx');
  const generationSource = readSource('src/hooks/useImageGeneration.ts');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const mobileTabBarSource = readSource('src/components/mobile/MobileTabBar.tsx');

  assert.match(appSource, /onPartialRedraw:\s*handlePartialRedrawRequest,/);
  assert.match(appSource, /onPartialRedraw=\{handleMobileResultPartialRedraw\}/);
  assert.match(globalModalsSource, /onPartialRedraw=\{lightbox\.onPartialRedraw\}/);
  assert.match(mobileWorkspaceSource, /onPartialRedraw=\{onPartialRedraw\}/);
  assert.match(appSource, /mode:\s*GenerationMode\.REDRAW/);
  assert.match(appSource, /partialRedraw:\s*\{/);
  assert.match(appSource, /sourceImageId:\s*sourceImage\.id/);
  assert.match(appSource, /buildPartialRedrawReferenceImage\(/);
  assert.match(appSource, /referenceImages:\s*\[\s*croppedSourceReference,\s*\.\.\.request\.referenceImages\s*\]/);
  assert.match(appSource, /await executeGeneration\(redrawNode\);/);
  assert.match(appSource, /handleOpenPreview\(latestRedrawResultId\);/);
  assert.doesNotMatch(appSource, /maskUrl:\s*maskBase64/);

  assert.match(generationSource, /executionNode\.mode === GenerationMode\.REDRAW/);
  assert.match(generationSource, /await compositePartialRedrawResult\(/);
  assert.match(generationSource, /partialRedraw:\s*executionNode\.partialRedraw/);

  assert.doesNotMatch(promptBarSource, /import \{ InpaintModal \} from '\.\.\/image\/InpaintModal';/);
  assert.doesNotMatch(promptBarSource, /config\.maskUrl/);
  assert.doesNotMatch(promptBarSource, /editMode:\s*'inpaint'/);
  assert.doesNotMatch(promptBarSource, /inpaintImage/);

  assert.match(mobileTabBarSource, /\[GenerationMode\.REDRAW\]: '重绘'/);
  assert.match(appSource, /pn\.mode === GenerationMode\.REDRAW \|\| pn\.mode === GenerationMode\.INPAINT/);
});
