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
    },
    billing: {
      canEstimateCost: true
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

test('generation.resumeJob confirmation exposes provider cost and unfinished-item impact', () => {
  const result = confirmationPolicy.evaluate({
    id: 'plan_resume_job',
    reply: 'resume',
    intent: 'resume_generation_job',
    confidence: 1,
    actions: [{ type: 'generation.resumeJob', payload: { jobId: 'job_resume_1' } }],
    requiresConfirmation: false,
  } as any, {
    settings: { apiKeyStatus: 'configured_masked' },
    canvas: { selectedNodeIds: [] },
    assets: { images: [] },
    billing: { canEstimateCost: true },
  } as any);

  assert.equal(result.required, true);
  assert.match(result.title, /恢复生成任务/);
  assert.match(result.summary, /未完成的队列项/);
  assert.match(result.summary, /Provider.*配额/);
  assert.equal(result.metadata?.source, 'DurableGenerationQueue 任务 job_resume_1');
});

test('generation.retryJob confirmation exposes the frozen job and failed-item count', () => {
  const result = confirmationPolicy.evaluate({
    id: 'plan_retry_job',
    reply: 'retry',
    intent: 'retry_generation_job',
    confidence: 1,
    actions: [{
      type: 'generation.retryJob',
      payload: {
        jobId: 'job_retry_1',
        expectedUpdatedAt: 123,
        expectedRetryablePromptIds: ['prompt-a', 'prompt-b'],
      },
    }],
    requiresConfirmation: false,
  } as any, {
    settings: { apiKeyStatus: 'missing' },
    canvas: { selectedNodeIds: [] },
    assets: { images: [] },
    billing: { canEstimateCost: false },
  } as any);

  assert.equal(result.required, true);
  assert.match(result.summary, /job_retry_1/);
  assert.match(result.summary, /2 个失败项/);
  assert.equal(result.metadata?.expectedOutputs, 2);
});

test('browser confirmation shows the frozen public target without query parameters', () => {
  const result = confirmationPolicy.evaluate({
    id: 'plan_browser_target',
    reply: 'inspect',
    intent: 'extract_page_content',
    confidence: 1,
    actions: [{
      type: 'browser.inspectPage',
      payload: { target: 'https://example.com/catalog/item?token=private-query' },
    }],
    requiresConfirmation: false,
  } as any, {
    settings: { apiKeyStatus: 'configured_masked' },
    canvas: { selectedNodeIds: [] },
    assets: { images: [] },
    billing: { canEstimateCost: false },
  } as any);

  assert.match(result.summary, /https:\/\/example\.com\/catalog\/item/);
  assert.doesNotMatch(result.summary, /private-query|token=/);
  assert.match(result.metadata?.source || '', /https:\/\/example\.com\/catalog\/item/);
});
