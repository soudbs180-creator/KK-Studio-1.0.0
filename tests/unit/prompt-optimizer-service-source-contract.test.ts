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

test('app prompt optimization branch no longer checks ecommerce after the dedicated early return', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /if \(config\.mode === GenerationMode\.ECOMMERCE\) \{/);
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

test('prompt node optimizer display reads neutral route metadata while keeping Chinese labels', () => {
  const componentSource = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.match(componentSource, /route_title/);
  assert.match(componentSource, /自动策略 ·/);
  assert.match(componentSource, /自动策略说明/);
  assert.doesNotMatch(componentSource, /template_title/);
});
