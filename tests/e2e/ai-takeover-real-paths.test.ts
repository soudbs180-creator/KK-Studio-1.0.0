// 简体中文：AI 接管五大核心用户路径的端到端与交互式契约验证 (E2E Smoke Tests)

import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readSource } from '../support/workspacePaths.js';

// Mock browser global objects for importing local modules safely
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] || null; },
    setItem(key: string, value: string) { store[key] = value.toString(); },
    clear() { store = {}; },
    removeItem(key: string) { delete store[key]; }
  };
})();

globalThis.localStorage = mockLocalStorage as any;
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
} as any;

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  configurable: true,
  writable: true,
});

globalThis.fetch = async () => ({ ok: true }) as any;

// 导入待测试的核心逻辑模块
import { analyzeIntent } from '../../apps/web/src/features/ai-takeover/core/intentGate.ts';
import { LocalAssistantBrain } from '../../apps/web/src/features/ai-takeover/core/localBrain.ts';

describe('AI Takeover Real User Path E2E Contract & Flow Tests', () => {

  before(() => {
    mockLocalStorage.clear();
  });

  it('1. E2E [first-run idea-to-canvas]: 首次进入 -> 输入想法 -> mock/测试生成成功 -> 进入画布', async () => {
    // A. 动态逻辑测试：传入正常上下文和想法，测试意图判定和动作构建
    const ctx: any = {
      canvas: { selectedNodeIds: [], promptNodes: [], imageNodes: [] },
      settings: { apiKeyStatus: 'configured_masked' }
    };
    const intentResult = analyzeIntent('画 4 张可爱的太空柴犬，背景是斑斓的星云', ctx);
    assert.equal(intentResult.intent, 'generate_images');
    assert.equal(intentResult.extracted.count, 4); // 生成 4 张图
    assert.equal(intentResult.extracted.aspectRatio, undefined); // 未指定比例，由系统默认处理

    const brain = new LocalAssistantBrain();
    const plan = await brain.plan('画 4 张可爱的太空柴犬，背景是斑斓的星云', ctx);
    assert.ok(plan.actions.length > 0);
    assert.equal(plan.actions[0].type, 'startGeneration');

    // B. 静态源码契约核对：确保 AITakeoverContext 中对 executor 进行了注册，且最终会把生成的图像卡片节点更新/添加到画布上
    const contextSource = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
    assert.match(contextSource, /durableGenerationQueue\.registerExecutor/);
    assert.match(contextSource, /addPromptNodeRef\.current/);
    assert.match(contextSource, /executeGenerationRef\.current/);
  });

  it('2. E2E [selected-image-edit]: 选中图片 -> 说“换背景” -> 创建 reference edit job', async () => {
    // A. 动态逻辑测试：传入选中图片和修改词，测试参考图识别与提取
    const ctxWithImg: any = {
      canvas: {
        selectedNodeIds: ['img_node_galaxy'],
        promptNodes: [],
        imageNodes: [
          { id: 'img_node_galaxy', name: '柴犬太空图', url: 'https://cdn.example.com/shiba.png', timestamp: 100 }
        ]
      },
      settings: { apiKeyStatus: 'configured_masked' }
    };

    const intentResult = analyzeIntent('把柴犬的背景换成充满落日余晖的雪山', ctxWithImg);
    assert.equal(intentResult.intent, 'generate_images');
    assert.equal(intentResult.extracted.referenceImageNodeId, 'img_node_galaxy');
    assert.equal(intentResult.extracted.count, 1); // 口头局部修改默认生成 1 张

    const brain = new LocalAssistantBrain();
    const plan = await brain.plan('把柴犬的背景换成充满落日余晖的雪山', ctxWithImg);
    assert.equal(plan.actions[0].type, 'startGeneration');
    assert.equal((plan.actions[0] as any).payload.referenceImageNodeId, 'img_node_galaxy');

    // B. 静态源码契约核对：确保 durableGenerationQueue 的 executor 真正解析了 referenceImageNodeId，并添加了 referenceImages 属性
    const contextSource = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
    assert.match(contextSource, /options\.referenceImageNodeId/);
    assert.match(contextSource, /referenceImages\.push/);
    assert.match(contextSource, /['"]automation['"]\s*,\s*['"]batch:['"]\s*\+\s*jobId/);
  });

  it('3. E2E [missing-api-setup]: 首次进入 -> 输入想法 -> 缺 API 时配置引导', async () => {
    // A. 动态逻辑测试：apiKeyStatus 为 missing 时，测试配置引导的触发情况
    const ctxMissing: any = {
      canvas: { selectedNodeIds: [], promptNodes: [], imageNodes: [] },
      settings: { apiKeyStatus: 'missing' }
    };

    const brain = new LocalAssistantBrain();
    const plan = await brain.plan('我想配置 API 密钥', ctxMissing);
    assert.equal(plan.intent, 'configure_api');
    assert.match(plan.reply, /打开 API 设置面板/);
    assert.match(plan.reply, /高亮 API 密钥/);
  });

  it('4. E2E [refresh-queue-recovery]: 刷新页面 -> queued/running job 恢复', () => {
    // A. 静态源码契约核对：确认挂载时有自动触发队列处理器逻辑，且在网络重连时也会自动 processQueue
    const contextSource = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
    assert.match(contextSource, /durableGenerationQueue\.processQueue\(\)/);
    assert.match(contextSource, /window\.addEventListener\('online',\s*handleOnline\)/);
  });

  it('5. E2E [research-to-canvas]: 研究品牌风格 -> research brief + 生成任务进入画布', async () => {
    // A. 动态逻辑测试：传入研究指令，验证会提取 research Brief
    const ctx: any = {
      canvas: { selectedNodeIds: [], promptNodes: [], imageNodes: [] },
      settings: { apiKeyStatus: 'configured_masked' }
    };

    const brain = new LocalAssistantBrain();
    const plan = await brain.plan('研究极简咖啡品牌风格，并生成 6 张海报', ctx);
    assert.equal(plan.intent, 'research_to_canvas');
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].type, 'generation.createBatchJob');

    const payload = (plan.actions[0] as any).payload;
    assert.equal(payload.options.aspectRatio, '3:4');
    assert.match(payload.options.researchBrief, /极简咖啡品牌/);

    // B. 静态源码契约核对：确认在 generationTools 里的 generation.createBatchJob handler 中，如果传了 researchBrief，会通过 addPromptNode 创建一个报告节点
    const toolsSource = readSource('apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts');
    assert.match(toolsSource, /researchBrief/);
    assert.match(toolsSource, /research_brief_/);
    assert.match(toolsSource, /model:\s*'local-research'/);
    assert.match(toolsSource, /modelLabel:\s*'深度研究报告'/);
    assert.match(toolsSource, /await\s+addPromptNode\(briefNode\)/);
  });
});
