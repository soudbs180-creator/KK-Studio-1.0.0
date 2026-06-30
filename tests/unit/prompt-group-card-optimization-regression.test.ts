import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('prompt-group renderer uses a shared main-card credit display contract for subcards', () => {
  const creditSource = readSource('apps/web/src/utils/creditBilling.ts');
  const rendererSource = readSource('apps/web/src/core/canvas/renderers/ImageGenerationGroupRenderer.tsx');
  const imageCardSource = readSource('apps/web/src/components/image/ImageCard2.tsx');

  assert.match(creditSource, /export const resolvePromptGroupCreditDisplay = \(/);
  assert.match(creditSource, /DEFAULT_PROMPT_GROUP_CREDIT_COST = 10/);
  assert.match(creditSource, /target\.billingMode === 'currency'/);
  assert.match(rendererSource, /const promptGroupCreditDisplay = resolvePromptGroupCreditDisplay\(node\);/);
  assert.match(rendererSource, /isCreditModelOverride=\{promptGroupCreditDisplay\.isCreditModel\}/);
  assert.match(rendererSource, /creditCostOverride=\{promptGroupCreditDisplay\.creditCost\}/);
  assert.match(imageCardSource, /creditCostOverride\?: number;/);
  assert.match(imageCardSource, /const overrideCreditCost = typeof creditCostOverride === 'number'/);
});

test('visible canvas items expands prompt cohorts through a prompt-child index instead of repeated full image scans', () => {
  const source = readSource('apps/web/src/app/useVisibleCanvasItems.ts');

  assert.match(source, /const childImageIdsByPromptId = new Map<string, string\[]>\(\);/);
  assert.match(source, /childImageIdsByPromptId\.get\(prompt\.id\)\?\./);
  assert.doesNotMatch(source, /Array\.from\(imageNodeById\.values\(\)\)\s*\.filter\(\(img\) => img\.parentPromptId === prompt/);
});

test('global arrange callback tracks sub-card layout mode changes', () => {
  const source = readSource('apps/web/src/context/CanvasContext.tsx');
  const arrangeStart = source.indexOf("const arrangeAllNodes = useCallback((mode: ArrangeMode = 'grid') => {");
  const arrangeEnd = source.indexOf('// --- File System Implementation ---', arrangeStart);

  assert.notEqual(arrangeStart, -1);
  assert.notEqual(arrangeEnd, -1);

  const arrangeSource = source.slice(arrangeStart, arrangeEnd);

  assert.match(arrangeSource, /state\.subCardLayoutMode/);
  assert.match(arrangeSource, /\[pushToHistory, state\.canvases, state\.activeCanvasId, state\.selectedNodeIds, state\.subCardLayoutMode\]/);
});
