import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIntent } from '../../apps/web/src/features/ai-takeover/core/intentGate.ts';
import { readSource } from '../support/workspacePaths.js';

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

test('意图匹配单元测试：文件夹图片修改成紧凑电商排版会提取比例和布局', () => {
  const result = analyzeIntent('帮我把这个文件夹里面的图片全部修改成紧凑的排版布局，比例改成4:5');

  assert.equal(result.intent, 'batch_generate_from_folder');
  assert.equal(result.needsConfirmation, true);
  assert.equal(result.extracted.taskDomain, 'ecommerce');
  assert.equal(result.extracted.aspectRatio, '4:5');
  assert.equal(result.extracted.layoutPreset, 'compact-grid');
  assert.equal(result.extracted.outputGroup?.color, '#ffffff');
  assert.equal(result.extracted.outputGroup?.includePromptNodes, true);
});

test('意图匹配单元测试：API 密钥配置意图识别且不生图', () => {
  const result = analyzeIntent('我想配置 API key');
  assert.equal(result.intent, 'configure_api');
  assert.equal(result.needsConfirmation, false);
});

test('意图匹配单元测试：打开日志是安全 UI 操作，不要求配置模型', () => {
  const result = analyzeIntent('帮我打开日志');
  assert.equal(result.intent, 'open_logs');
  assert.equal(result.needsConfirmation, false);
});

test('意图匹配单元测试：帮我打开个人中心直接路由到设置页个人中心', () => {
  const result = analyzeIntent('帮我打开个人中心');

  assert.equal(result.intent, 'open_settings_view');
  assert.equal(result.extracted.settingsView, 'user-profile');
  assert.equal(result.needsConfirmation, false);
});

test('意图匹配单元测试：帮我打开 API 直接路由到 API 工作台', () => {
  const result = analyzeIntent('帮我打开API');

  assert.equal(result.intent, 'open_settings_view');
  assert.equal(result.extracted.settingsView, 'api-management');
  assert.equal(result.needsConfirmation, false);
});

test('意图匹配单元测试：简单生成复用画布输入框并直接发送', () => {
  const result = analyzeIntent('帮我生成一个赛博猫头像');

  assert.equal(result.intent, 'submit_composer');
  assert.equal(result.extracted.prompt, '赛博猫头像');
  assert.equal(result.needsConfirmation, false);
});

test('本地脑源码契约：快速设置页跳转只调用底层 openSettings 工具', () => {
  const source = readSource('apps/web/src/features/ai-takeover/core/localBrain.ts');

  assert.match(source, /case 'open_settings_view'/);
  assert.match(source, /type: 'openSettings'/);
  assert.match(source, /payload: \{ tab: settingsView \}/);
});

test('本地脑源码契约：简单生成先填充输入框再提交 composer', () => {
  const source = readSource('apps/web/src/features/ai-takeover/core/localBrain.ts');

  assert.match(source, /type: 'fillInputPrompt'/);
  assert.match(source, /type: 'submitPromptComposer'/);
  assert.match(source, /复用当前已设置的模型、比例、参考图和生成参数直接发送/);
});

test('本地脑源码契约：批量电商计划携带比例、紧凑布局和输出分组', () => {
  const source = readSource('apps/web/src/features/ai-takeover/core/localBrain.ts');

  assert.match(source, /taskDomain/);
  assert.match(source, /aspectRatio/);
  assert.match(source, /layoutPreset/);
  assert.match(source, /outputGroup/);
  assert.match(source, /color: extractedOutputGroup\?\.color \|\| '#ffffff'/);
  assert.match(source, /`batch:\$\{batchPlanId\}`/);
});

test('AgentRuntime 源码契约：本地可处理的意图即使已有模型也不调用云端 Planner', () => {
  const source = readSource('apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');

  assert.match(source, /const localPlan = await localBrain\.plan\(text, context\)/);
  assert.match(source, /localPlan\.intent === 'unknown'/);
  assert.match(source, /plan = localPlan/);
});
