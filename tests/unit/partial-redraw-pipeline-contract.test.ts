import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('App creates REDRAW prompt nodes and generation pipeline composites redraw outputs', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const globalModalsSource = readSource('apps/web/src/app/AppGlobalModals.tsx');
  const mobileWorkspaceSource = readSource('apps/web/src/app/AppMobileWorkspace.tsx');
  const generationSource = readSource('apps/web/src/hooks/useImageGeneration.ts');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const mobileTabBarSource = readSource('apps/web/src/components/mobile/MobileTabBar.tsx');

  assert.match(appSource, /onPartialRedraw:\s*handleRedrawRequest,/);
  assert.match(appSource, /onPartialRedraw=\{handleMobileResultRedraw\}/);
  assert.match(globalModalsSource, /onPartialRedraw=\{lightbox\.onPartialRedraw\}/);
  assert.match(mobileWorkspaceSource, /onPartialRedraw=\{onPartialRedraw\}/);
  assert.match(appSource, /mode:\s*GenerationMode\.REDRAW/);
  assert.match(appSource, /redraw:\s*nodeRedrawMetadata/);
  assert.match(appSource, /sourceImageId:\s*sourceImage\.id/);
  assert.match(appSource, /compositionBaseImageId:\s*cropPlan \? currentCompositeBaseImageId : undefined/);
  assert.match(appSource, /buildRedrawReferenceImage\(/);
  assert.match(appSource, /referenceImages:\s*\[\s*sourceReference,\s*\.\.\.extraReferenceImages,?\s*\]/);
  assert.match(appSource, /await executeGeneration\(redrawNode\);/);
  assert.match(appSource, /const generatedRedrawResultIds: string\[\] = \[\];/);
  assert.match(appSource, /generatedRedrawResultIds\.slice\(0, -1\)\.forEach\(\(imageId\) => \{/);
  assert.match(appSource, /createdNodes\.slice\(0, -1\)\.forEach\(\(redrawNode\) => \{/);
  assert.match(appSource, /handleOpenPreview\(latestRedrawResultId\);/);
  assert.doesNotMatch(appSource, /maskUrl:\s*maskBase64/);

  assert.match(generationSource, /executionNode\.mode === GenerationMode\.REDRAW/);
  assert.match(generationSource, /await compositeRedrawCropResult\(/);
  assert.match(generationSource, /redraw:\s*executionNode\.redraw/);
  assert.match(generationSource, /executionNode\.redraw\?\.compositionBaseImageId/);

  assert.match(generationSource, /executionNode\.mode === GenerationMode\.REDRAW/);
  assert.match(generationSource, /await compositeRedrawCropResult\(/);
  assert.match(generationSource, /redraw:\s*executionNode\.redraw/);
  assert.match(generationSource, /executionNode\.redraw\?\.compositionBaseImageId/);

  assert.doesNotMatch(promptBarSource, /import \{ InpaintModal \} from '\.\.\/image\/InpaintModal';/);
  assert.doesNotMatch(promptBarSource, /config\.maskUrl/);
  assert.doesNotMatch(promptBarSource, /editMode:\s*'inpaint'/);
  assert.doesNotMatch(promptBarSource, /inpaintImage/);

  assert.match(mobileTabBarSource, /\[GenerationMode\.REDRAW\]:\s*(?:pick\('重绘',\s*'Redraw'\)|'重绘')/);
  assert.match(appSource, /pn\.mode === GenerationMode\.REDRAW \|\| pn\.mode === GenerationMode\.INPAINT/);
});
