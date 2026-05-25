import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildAutomaticOptimizationInstruction,
  inferPromptOptimizationArchetype,
  resolveAutomaticOptimizationRoute,
} from '../../apps/web/src/services/llm/promptOptimizerAutoroute.ts';

test('short product prompts auto-route to the product archetype', () => {
  assert.equal(
    inferPromptOptimizationArchetype('白底耳机产品图', 'image'),
    'product-hero',
  );
});

test('ppt prompts auto-route to the slide-safe archetype', () => {
  assert.equal(
    inferPromptOptimizationArchetype('AI 安全培训汇报封面', 'ppt'),
    'ppt-narrative',
  );
});

test('automatic optimization instruction carries matched layout guidance and context', () => {
  const instruction = buildAutomaticOptimizationInstruction('AI 数据看板 UI', {
    mode: 'image',
    aspectRatio: '16:9',
    referenceImageCount: 2,
  });

  assert.match(instruction, /grid|hierarchy|layout/i);
  assert.match(instruction, /16:9/);
  assert.match(instruction, /reference image/i);
});

test('automatic route exposes strategy naming and slot hints instead of legacy template naming', () => {
  const route = resolveAutomaticOptimizationRoute('白底耳机产品图', {
    mode: 'image',
  });

  assert.equal(route.strategyId, 'product-hero');
  assert.equal(route.strategyTitle, '电商主图');
  assert.equal(route.taskType, 'ecommerce_hero');
  assert.deepEqual(route.missingInputHints, ['产品主体', '卖点焦点', '拍摄角度', '背景与材质']);
});

test('ui prompts expose ui-specific missing slot hints', () => {
  const route = resolveAutomaticOptimizationRoute('B2B SaaS 数据看板', {
    mode: 'image',
  });

  assert.equal(route.taskType, 'ui');
  assert.deepEqual(route.missingInputHints, ['界面类型', '信息层级', '配色风格', '展示场景']);
});
