import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIntent } from '../../apps/web/src/features/ai-takeover/core/intentGate.ts';

test('意图匹配单元测试：优化提示词不会触发生成图片', () => {
  const result = analyzeIntent('帮我优化提示词：二次元少女，带一只白猫');
  assert.equal(result.intent, 'optimize_prompt');
  assert.equal(result.needsConfirmation, false);
});

test('意图匹配单元测试：明确画图需求会触发强确认的生成图片意图', () => {
  const result = analyzeIntent('帮我生成 3 张可爱的猫咪图');
  assert.equal(result.intent, 'generate_images');
  assert.equal(result.needsConfirmation, true);
  assert.equal(result.extracted.count, 3);
});

test('意图匹配单元测试：针对文件夹的操作会匹配到文件夹批量生成意图并触发强确认', () => {
  const result = analyzeIntent('这个图片文件夹下的所有图片，每张都生成机甲风');
  assert.equal(result.intent, 'batch_generate_from_folder');
  assert.equal(result.needsConfirmation, true);
});

test('意图匹配单元测试：API 密钥配置意图识别且不生图', () => {
  const result = analyzeIntent('我想配置 API key');
  assert.equal(result.intent, 'configure_api');
  assert.equal(result.needsConfirmation, false);
});
