import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationPolicy } from '../../apps/web/src/features/ai-takeover/core/confirmationPolicy.ts';

test('确认策略评估单元测试：带有 startGeneration 动作时强制弹窗确认', () => {
  const plan = {
    id: 'plan_test_1',
    reply: '已为您定制好画一只可爱小狗的方案',
    intent: 'generate_images',
    confidence: 0.9,
    actions: [
      {
        type: 'startGeneration',
        payload: {
          prompt: 'a cute puppy running in the park',
          count: 1
        }
      }
    ],
    requiresConfirmation: false
  } as any;

  const context = {
    settings: {
      apiKeyStatus: 'missing'
    },
    canvas: {
      selectedNodeIds: []
    },
    assets: {
      images: []
    }
  } as any;

  const result = confirmationPolicy.evaluate(plan, context);
  assert.equal(result.required, true);
  assert.equal(result.title, '确认生成图片？');
  assert.match(result.summary, /预计输出：1 张图片/);
});

test('确认策略评估单元测试：无敏感/扣费操作的单纯提示词优化不需确认', () => {
  const plan = {
    id: 'plan_test_2',
    reply: '已将优化后提示词填充完毕。',
    intent: 'optimize_prompt',
    confidence: 0.9,
    actions: [
      {
        type: 'fillPrompt',
        payload: {
          prompt: 'a masterfully optimized prompt content'
        }
      }
    ],
    requiresConfirmation: false
  } as any;

  const context = {
    settings: {
      apiKeyStatus: 'configured_masked'
    },
    canvas: {
      selectedNodeIds: []
    },
    assets: {
      images: []
    }
  } as any;

  const result = confirmationPolicy.evaluate(plan, context);
  assert.equal(result.required, false);
});
