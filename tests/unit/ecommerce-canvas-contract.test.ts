import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('prompt nodes expose ecommerce state and the generation flow handles ecommerce as an image-like mode', () => {
  const typesSource = readSource('apps/web/src/types.ts');
  const generationHookSource = readSource('apps/web/src/hooks/useImageGeneration.ts');
  const promptNodeSource = readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const appSource = readSource('apps/web/src/App.tsx');
  const groupExportRuntimeSource = readSource('apps/web/src/app/useEcommerceGroupExportRuntime.ts');

  assert.match(typesSource, /ecommerce\?:\s*EcommercePromptState/);
  assert.match(typesSource, /export interface EcommercePromptState/);
  assert.match(typesSource, /selectedForGeneration\?: boolean/);
  assert.match(typesSource, /desktopStage\?: 'not_applicable' \| 'pending' \| 'generating' \| 'generated' \| 'confirmed' \| 'failed'/);
  assert.match(typesSource, /mobileStage\?: 'not_applicable' \| 'locked' \| 'pending' \| 'generating' \| 'generated' \| 'failed'/);
  assert.match(typesSource, /inputSummary\?: string\[\];/);
  assert.match(generationHookSource, /const isEcommerce = mode === GenerationMode\.ECOMMERCE/);
  assert.match(generationHookSource, /const actualCount = isPpt \? Math\.min\(20, requestedCount\) : requestedCount;/);
  assert.match(generationHookSource, /const taskPrompt = isPpt \? buildPptPagePrompt\(promptToUse, index, actualCount\) : \(isEcommerce \? promptToUse : promptToUse\);/);
  assert.match(promptNodeSource, /node\.ecommerce/);
  assert.match(promptNodeSource, /onRetryEcommerceModule/);
  assert.match(appSource, /handleRetryEcommerceModule/);
  assert.match(groupExportRuntimeSource, /selectedForGeneration !== false/);
});
