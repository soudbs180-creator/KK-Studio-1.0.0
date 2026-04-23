import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce structured task flow is wired through analysis, generation, display labels, and redraw inheritance', () => {
  const appSource = readSource('src/App.tsx');
  const typesSource = readSource('src/types.ts');
  const editorPanelSource = readSource('src/components/ecommerce/EcommerceTaskEditorPanel.tsx');
  const reviewPanelSource = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const cardActionsSource = readSource('src/components/ecommerce/EcommerceCardActions.tsx');
  const promptBarSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const imageCardSource = readSource('src/components/image/ImageCard2.tsx');
  const optimizerSource = readSource('src/services/llm/promptOptimizerService.ts');
  const generationHookSource = readSource('src/hooks/useImageGeneration.ts');

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
  assert.match(cardActionsSource, /转 .*手机端|生成 .*手机端/);

  assert.match(promptBarSource, /activeTaskState/);
  assert.match(promptBarSource, /taskStates/);
  assert.match(promptBarSource, /onTaskStateChange/);

  assert.match(appSource, /optimizePromptForImage\(nextPrompt,\s*\{/);
  assert.match(appSource, /mode:\s*GenerationMode\.ECOMMERCE/);
  assert.match(appSource, /ecommerceContext:/);
  assert.match(appSource, /displayLabel:\s*renderTask\.displayLabel/);
  assert.match(appSource, /inheritedDisplayLabel/);
  assert.match(appSource, /editableTask:\s*renderTask\.taskState/);

  assert.match(imageCardSource, /image\.displayLabel \|\| /);
  assert.match(optimizerSource, /ecommerceContext\?:/);
  assert.match(optimizerSource, /Structured ecommerce context:/);
  assert.match(generationHookSource, /ecommerceDeliveryKind:/);
  assert.match(generationHookSource, /activeDeliveryKind/);
  assert.match(generationHookSource, /inheritedDeliveryKind/);
});
