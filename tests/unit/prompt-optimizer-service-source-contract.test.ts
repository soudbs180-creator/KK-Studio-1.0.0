import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt optimizer service relies on autoroute helpers and neutral route naming instead of legacy template fields', () => {
  const serviceSource = readSource('src/services/llm/promptOptimizerService.ts');

  assert.doesNotMatch(serviceSource, /const DEFAULT_TABS:/);
  assert.doesNotMatch(serviceSource, /tabs: DEFAULT_TABS,/);
  assert.match(serviceSource, /tabs: HUMAN_DEFAULT_TABS,/);

  assert.match(serviceSource, /buildAutomaticOptimizationInstruction/);
  assert.match(serviceSource, /resolveAutomaticOptimizationRoute/);
  assert.match(serviceSource, /route_id/);
  assert.match(serviceSource, /route_title/);
  assert.match(serviceSource, /Automatic route:/);
  assert.doesNotMatch(serviceSource, /getPromptOptimizerTemplate/);
  assert.doesNotMatch(serviceSource, /getDefaultPromptOptimizerTemplateId/);
  assert.doesNotMatch(serviceSource, /template instructions/);
  assert.doesNotMatch(serviceSource, /template_id/);
  assert.doesNotMatch(serviceSource, /template_title/);
  assert.doesNotMatch(serviceSource, /optimizationPrompt/);
  assert.doesNotMatch(serviceSource, /optimizationTemplateId/);
  assert.doesNotMatch(serviceSource, /optimizationMode/);
});

test('legacy prompt optimizer config fields and prompt library artifacts are removed from the active flow', () => {
  const typesSource = readSource('src/types.ts');

  assert.doesNotMatch(typesSource, /promptOptimizationMode\?:/);
  assert.doesNotMatch(typesSource, /promptOptimizationTemplateId\?:/);
  assert.doesNotMatch(typesSource, /promptOptimizationCustomPrompt\?:/);
  assert.doesNotMatch(typesSource, /type PromptOptimizationMode/);

  assert.equal(existsSync(path.join(ROOT_DIR, 'src/config/promptLibrary.ts')), false);
  assert.equal(existsSync(path.join(ROOT_DIR, 'src/utils/promptFeatureHealth.ts')), false);
  assert.equal(existsSync(path.join(ROOT_DIR, 'src/config/promptOptimizerTemplates.ts')), false);
});

test('prompt optimizer service prioritizes autoroute-specific missing hints ahead of generic hints', () => {
  const serviceSource = readSource('src/services/llm/promptOptimizerService.ts');

  assert.match(
    serviceSource,
    /const prioritizedMissingInputs = \[\s*\.\.\.route\.missingInputHints,\s*\.\.\.genericMissingInputs,\s*\];/,
  );
  assert.doesNotMatch(serviceSource, /const detectMissingInputs =/);
});

test('app prompt optimization branch no longer checks ecommerce after the dedicated submit-guard early return', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /if \(await handleEcommerceSubmitGuard\(submitGuard\)\) \{/);
  assert.doesNotMatch(appSource, /if \(submitGuard\.isEcommerce\) \{/);
  assert.doesNotMatch(appSource, /await handleAnalyzeEcommerceRequirement\(\);/);
  assert.doesNotMatch(appSource, /await handleConfirmEcommerceAnalysis\(\);/);
  assert.doesNotMatch(
    appSource,
    /\(config\.mode === GenerationMode\.IMAGE \|\| config\.mode === GenerationMode\.PPT \|\| config\.mode === GenerationMode\.ECOMMERCE\) && config\.enablePromptOptimization && rawPrompt/,
  );
});

test('prompt optimizer service keeps human-readable Chinese fallback copy', () => {
  const serviceSource = readSource('src/services/llm/promptOptimizerService.ts');

  assert.match(serviceSource, /label_zh: '未优化'/);
  assert.match(serviceSource, /label_zh: '已优化'/);
  assert.match(serviceSource, /核心主体或关键对象/);
  assert.match(serviceSource, /风格或表现方式/);
  assert.match(serviceSource, /光线或场景环境/);
  assert.match(serviceSource, /已按支持思考的模型优化为/);
});

test('prompt optimizer cache does not persist raw prompt or reference image content', () => {
  const serviceSource = readSource('src/services/llm/promptOptimizerService.ts');

  assert.match(serviceSource, /const buildOptimizerCacheFingerprint = /);
  assert.match(serviceSource, /const redactOptimizerCacheResult = /);
  assert.match(serviceSource, /const cacheSafeResult = redactOptimizerCacheResult\(result\);/);
  assert.match(serviceSource, /cache\[cacheKey\] = \{ result: cacheSafeResult, createdAt: Date\.now\(\) \};/);
  assert.doesNotMatch(serviceSource, /input\.trim\(\),/);
  assert.doesNotMatch(serviceSource, /cleanText\(ref\.data\)\.slice\(0,\s*32\)/);
  assert.match(serviceSource, /raw_prompt_original: '<omitted:prompt>'/);
  assert.match(serviceSource, /subject: '<omitted:prompt>'/);
});

test('prompt optimizer failure logging uses redacted error summaries', () => {
  const serviceSource = readSource('src/services/llm/promptOptimizerService.ts');
  const generationRuntimeSource = readSource('src/app/useGenerationRuntime.ts');
  const ecommerceRuntimeSource = readSource('src/app/useEcommerceNodeGenerationRuntime.ts');

  assert.match(serviceSource, /const summarizePromptOptimizerError = /);
  assert.match(serviceSource, /console\.warn\('\[Optimizer\] Falling back to heuristic optimization\.', summarizePromptOptimizerError\(error\)\);/);
  assert.match(generationRuntimeSource, /import \{ optimizeGenerationPrompt, summarizePromptOptimizationError \} from '\.\/optimizeGenerationPrompt';/);
  assert.match(generationRuntimeSource, /console\.warn\('\[handleGenerate\] Prompt optimization failed, fallback to raw prompt:', summarizePromptOptimizationError\(error\)\);/);
  assert.match(ecommerceRuntimeSource, /import \{ optimizeGenerationPrompt, summarizePromptOptimizationError \} from '\.\/optimizeGenerationPrompt\.ts';/);
  assert.match(ecommerceRuntimeSource, /console\.warn\('\[runEcommerceNodeGeneration\] Prompt optimization failed, fallback to render task prompt\.', summarizePromptOptimizationError\(error\)\);/);
  assert.doesNotMatch(serviceSource, /console\.warn\('\[Optimizer\] Falling back to heuristic optimization\.', error\);/);
  assert.doesNotMatch(generationRuntimeSource, /console\.warn\('\[handleGenerate\] Prompt optimization failed, fallback to raw prompt:', error\);/);
  assert.doesNotMatch(ecommerceRuntimeSource, /console\.warn\('\[runEcommerceNodeGeneration\] Prompt optimization failed, fallback to render task prompt\.', error\);/);
});

test('prompt node optimizer display reads neutral route metadata while keeping Chinese labels', () => {
  const componentSource = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(componentSource, /route_title/);
  assert.match(componentSource, /自动策略 ·/);
  assert.match(componentSource, /自动策略说明/);
  assert.doesNotMatch(componentSource, /template_title/);
});
