import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce structured task flow is wired through analysis, generation, display labels, and redraw inheritance', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const typesSource = readSource('apps/web/src/types.ts');
  const editorPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceTaskEditorPanel.tsx');
  const reviewPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const cardActionsSource = readSource('apps/web/src/components/ecommerce/EcommerceCardActions.tsx');
  const promptBarSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const imageCardSource = readSource('apps/web/src/components/image/ImageCard2.tsx');
  const nodeGenerationHookSource = readSource('apps/web/src/app/useEcommerceNodeGenerationRuntime.ts');
  const optimizePromptSource = readSource('apps/web/src/app/optimizeGenerationPrompt.ts');
  const postBuildSyncSource = readSource('apps/web/src/app/useEcommercePostBuildSyncRuntime.ts');
  const optimizerSource = readSource('apps/web/src/services/llm/promptOptimizerService.ts');
  const optimizerRulebookSource = readSource('apps/web/src/services/llm/promptOptimizerRulebook.ts');
  const generationHookSource = readSource('apps/web/src/hooks/useImageGeneration.ts');

  assert.match(typesSource, /export interface EcommerceEditableTaskState/);
  assert.match(typesSource, /export interface EcommerceSeriesTemplate/);
  assert.match(typesSource, /editableTask\?: EcommerceEditableTaskState/);
  assert.match(typesSource, /displayLabel\?: string/);
  assert.match(typesSource, /sizeTier\?: EcommerceAPlusSizeTier/);
  assert.match(typesSource, /ecommerceDeliveryKind\?: EcommerceSlotDeliveryKind/);

  assert.match(editorPanelSource, /taskState:\s*EcommerceEditableTaskState/);
  assert.match(editorPanelSource, /onTaskStateChange:\s*\(\s*taskId:\s*string,\s*updater:/);
  assert.match(editorPanelSource, /taskState\.copy\.headline/);
  assert.match(editorPanelSource, /taskState\.style\.effect/);
  assert.match(editorPanelSource, /taskState\.layout\.productSize/);
  assert.match(editorPanelSource, /keepSeriesStyle/);

  assert.match(reviewPanelSource, /taskStates\?:/);
  assert.match(reviewPanelSource, /activeTaskState\?:/);
  assert.match(reviewPanelSource, /onTaskStateChange\?:/);
  assert.match(reviewPanelSource, /<EcommerceTaskEditorPanel/);
  assert.match(reviewPanelSource, /sizeTier/);

  assert.match(cardActionsSource, /taskState\?: EcommerceEditableTaskState/);
  assert.match(cardActionsSource, /onTaskStateChange\?:/);
  assert.match(cardActionsSource, /activeTaskState\?: EcommerceEditableTaskState \| null/);
  assert.match(cardActionsSource, /600.*450/);
  assert.match(cardActionsSource, /const mobileActionLabel = effectiveSizeTier === '1464x600'/);
  assert.match(cardActionsSource, /'Generate mobile'/);
  assert.match(cardActionsSource, /'Regenerate mobile'/);

  assert.match(promptBarSource, /activeTaskState/);
  assert.match(promptBarSource, /taskStates/);
  assert.match(promptBarSource, /onTaskStateChange/);

  assert.match(nodeGenerationHookSource, /optimizeGenerationPrompt\(\{/);
  assert.match(nodeGenerationHookSource, /mode:\s*GenerationMode\.ECOMMERCE/);
  assert.match(nodeGenerationHookSource, /ecommerceContext:/);
  assert.match(postBuildSyncSource, /displayLabel:\s*renderTask\.displayLabel/);
  assert.match(appSource, /inheritedDisplayLabel/);
  assert.match(postBuildSyncSource, /editableTask:\s*renderTask\.taskState/);

  assert.match(imageCardSource, /image\.displayLabel \|\| /);
  assert.match(optimizePromptSource, /const optimized = await optimizePromptForImage\(rawPrompt,\s*\{/);
  assert.match(optimizerRulebookSource, /ecommerceContext\?:/);
  assert.match(optimizerRulebookSource, /Structured ecommerce context to preserve:/);
  assert.match(generationHookSource, /ecommerceDeliveryKind:/);
  assert.match(generationHookSource, /activeDeliveryKind/);
  assert.match(generationHookSource, /inheritedDeliveryKind/);
});
