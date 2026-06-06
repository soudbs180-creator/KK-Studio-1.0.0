import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('useImageGeneration does not retain compiler-proven unused locals', () => {
  const source = readSource('apps/web/src/hooks/useImageGeneration.ts');

  assert.match(source, /import \{ saveOriginalImage, getImage, normalizePersistableMediaSource \} from '\.\.\/services\/storage\/imageStorage';/);
  assert.doesNotMatch(source, /import \{ llmService \} from '\.\.\/services\/llm\/LLMService';/);
  assert.doesNotMatch(source, /import \{ generateImage, cancelGeneration \} from '\.\.\/services\/llm\/geminiService';/);
  assert.doesNotMatch(source, /from '\.\.\/services\/image\/partialRedraw';/);
  assert.doesNotMatch(source, /from '\.\.\/services\/model\/secureModelProxy';/);
  assert.match(source, /await import\('\.\.\/services\/llm\/LLMService'\)/);
  assert.match(source, /await import\('\.\.\/services\/llm\/geminiService'\)/);
  assert.match(source, /await import\('\.\.\/services\/image\/partialRedraw'\)/);
  assert.doesNotMatch(source, /\bsaveImage\b/);
  assert.doesNotMatch(source, /\bisCreditBasedModel\b/);
  assert.doesNotMatch(source, /\bGENERATE_TIMEOUT_MS\b/);
  assert.doesNotMatch(source, /\bdeleteImageNode\b/);
  assert.doesNotMatch(source, /\bupdateImageNode\b/);
  assert.doesNotMatch(source, /\bupdateImageNodePosition\b/);
  assert.doesNotMatch(source, /uniqueRecoveredUrls\.map\(\(url, index\)/);
  assert.match(source, /uniqueRecoveredUrls\.map\(\(url\) => \(\{/);
  assert.doesNotMatch(source, /const pendingTaskIds = getPendingTaskIds\(latestNode\);/);
  assert.match(source, /const \{ nextPendingTaskIds, nextJobId, nextGenerationMetadata \} = resolvePendingTaskState\(latestNode, targetTaskId\);/);
});
