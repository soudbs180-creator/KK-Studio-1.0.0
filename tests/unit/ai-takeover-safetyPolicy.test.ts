import test from 'node:test';
import assert from 'node:assert/strict';
import { safetyPolicy } from '../../apps/web/src/features/ai-takeover/core/safetyPolicy.ts';

test('安全拦截单元测试：拦截带有 sk- 疑似密钥特征串的提示词填充', () => {
  const action = {
    type: 'fillPrompt',
    payload: {
      prompt: '绘制一只猫, key: sk-FjDk98dJskd98fJskd8sJsdf'
    }
  } as any;

  const result = safetyPolicy.evaluate(action);
  assert.equal(result.allowed, false);
  assert.match(result.reason || '', /禁止向提示词中注入或填写 API 密钥/);
});

test('安全拦截单元测试：拦截 fillApiKey 敏感操纵工具调用', () => {
  const action = {
    type: 'fillApiKey',
    payload: {
      apiKey: 'sk-xxxxxx'
    }
  } as any;

  const result = safetyPolicy.evaluate(action);
  assert.equal(result.allowed, false);
  assert.match(result.reason || '', /检测到受限的敏感工具调用/);
});

test('安全拦截单元测试：放行无敏感威胁的正常 fillPrompt 指令', () => {
  const action = {
    type: 'fillPrompt',
    payload: {
      prompt: 'a cinematic shot of a cute cat'
    }
  } as any;

  const result = safetyPolicy.evaluate(action);
  assert.equal(result.allowed, true);
});
