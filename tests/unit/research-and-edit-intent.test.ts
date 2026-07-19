import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock global objects
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

// Mock window and navigator for safe imports
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
} as any;
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  configurable: true,
  writable: true,
});

// Stub fetch since it is used in KnowledgeStore
globalThis.fetch = async () => ({ ok: true }) as any;

import { shouldTreatAsGeneration, analyzeIntent } from '../../apps/web/src/features/ai-takeover/core/intentGate.ts';
import { LocalAssistantBrain } from '../../apps/web/src/features/ai-takeover/core/localBrain.ts';
import { knowledgeStore } from '../../apps/web/src/features/ai-assistant-runtime/knowledge/KnowledgeStore.ts';

describe('P1-P2 Intent and LocalBrain Recovery Tests', () => {
  before(() => {
    mockLocalStorage.clear();
    knowledgeStore.clearProjection();
  });

  it('P1: shouldTreatAsGeneration should match creative Chinese thoughts', () => {
    assert.equal(shouldTreatAsGeneration('做一个小红书封面'), true);
    assert.equal(shouldTreatAsGeneration('画一只可爱的布偶猫'), true);
    assert.equal(shouldTreatAsGeneration('背景换成雪山'), true);
    assert.equal(shouldTreatAsGeneration('优化提示词：二次元'), false);
  });

  it('P1: analyzeIntent should infer aspect ratio correctly', () => {
    const ctx: any = { canvas: { promptNodes: [], imageNodes: [], selectedNodeIds: [] } };
    
    const res1 = analyzeIntent('设计一个小红书封面', ctx);
    assert.equal(res1.intent, 'generate_images');
    assert.equal(res1.extracted.aspectRatio, '4:5');
    assert.equal(res1.extracted.count, 4);

    const res2 = analyzeIntent('做一个手机壁纸，关于星空', ctx);
    assert.equal(res2.intent, 'generate_images');
    assert.equal(res2.extracted.aspectRatio, '9:16');

    // 细分比例测试
    const res3 = analyzeIntent('做一个单反相机复古照片', ctx);
    assert.equal(res3.extracted.aspectRatio, '3:2');

    const res4 = analyzeIntent('设计带鱼屏超宽屏幕壁纸', ctx);
    assert.equal(res4.extracted.aspectRatio, '21:9');

    const res5 = analyzeIntent('制作一个办公本桌面壁纸', ctx);
    assert.equal(res5.extracted.aspectRatio, '16:10');

    const res6 = analyzeIntent('制作平板iPad适用的壁纸', ctx);
    assert.equal(res6.extracted.aspectRatio, '4:3');
  });

  it('P1: analyzeIntent should route edit request properly with reference image selection', () => {
    // 选中 1 张图口头修改
    const ctxWithImg: any = {
      canvas: {
        selectedNodeIds: ['img_node_1'],
        promptNodes: [],
        imageNodes: [
          { id: 'img_node_1', name: 'Original', hasOriginalUrl: true, timestamp: 100 }
        ]
      }
    };

    const res = analyzeIntent('背景换成雪山', ctxWithImg);
    assert.equal(res.intent, 'generate_images');
    assert.equal(res.extracted.referenceImageNodeId, 'img_node_1');
    assert.equal(res.extracted.count, 1); // 口头修改默认 1 张

    // 没选图时使用最近生成的图
    const ctxWithRecent: any = {
      canvas: {
        selectedNodeIds: [],
        promptNodes: [],
        imageNodes: [
          { id: 'img_node_old', timestamp: 100 },
          { id: 'img_node_recent', timestamp: 500 }
        ]
      }
    };
    const resRecent = analyzeIntent('背景换成雪山', ctxWithRecent);
    assert.equal(resRecent.intent, 'generate_images');
    assert.equal(resRecent.extracted.referenceImageNodeId, 'img_node_recent');

    // 没有任何参考图时，优雅拦截
    const ctxEmpty: any = { canvas: { selectedNodeIds: [], promptNodes: [], imageNodes: [] } };
    const resEmpty = analyzeIntent('背景换成雪山', ctxEmpty);
    assert.equal(resEmpty.intent, 'image_edit_missing_selection');

    // 细粒度视频测试
    const resVideo = analyzeIntent('生成一段5秒的环绕运镜视频', ctxWithImg);
    assert.equal(resVideo.intent, 'image_to_video');
    assert.equal(resVideo.extracted.duration, 5);
    assert.equal(resVideo.extracted.motion, 'orbit');
  });

  it('P1: analyzeIntent should route multi-image ecommerce redraw to batch transform', () => {
    const ctxMulti: any = {
      canvas: {
        selectedNodeIds: ['img_1', 'img_2'],
        promptNodes: [],
        imageNodes: [
          { id: 'img_1', timestamp: 100 },
          { id: 'img_2', timestamp: 200 }
        ]
      }
    };
    const res = analyzeIntent('做成电商主图，这是几双运动鞋的背景重绘', ctxMulti);
    assert.equal(res.intent, 'batch_generate_from_folder');
    assert.equal(res.extracted.taskDomain, 'ecommerce');
    assert.deepEqual(res.extracted.fileIds, ['img_1', 'img_2']);
    assert.equal(res.extracted.productCategory, 'footwear');

    const resCosmetics = analyzeIntent('把这些化妆品口红做成电商主图', ctxMulti);
    assert.equal(resCosmetics.extracted.productCategory, 'cosmetics');
  });

  it('P2: analyzeIntent should route brand research to research_to_canvas', () => {
    const ctx: any = { canvas: { selectedNodeIds: [], promptNodes: [], imageNodes: [] } };
    const res = analyzeIntent('研究极简咖啡品牌风格，并生成 6 张海报', ctx);
    assert.equal(res.intent, 'research_to_canvas');
    assert.equal(res.extracted.count, 6);
  });

  it('P1-P2: LocalAssistantBrain should plan correct actions for edit and research', async () => {
    const brain = new LocalAssistantBrain();
    const ctxWithImg: any = {
      canvas: {
        selectedNodeIds: ['img_node_1'],
        promptNodes: [],
        imageNodes: [{ id: 'img_node_1', position: { x: 50, y: 50 } }]
      },
      settings: { apiKeyStatus: 'configured_masked' }
    };

    // 1. 口头修改
    const planEdit = await brain.plan('背景换成雪山', ctxWithImg);
    assert.equal(planEdit.intent, 'generate_images');
    assert.equal(planEdit.actions.length, 1);
    assert.equal(planEdit.actions[0].type, 'generation.createBatchJob');
    assert.equal((planEdit.actions[0] as any).payload.prompts[0].referenceImageNodeId, 'img_node_1');
    assert.equal((planEdit.actions[0] as any).payload.prompts.length, 1);
    assert.equal((planEdit.actions[0] as any).payload.options.countPerPrompt, 1);

    // 2. 缺少选区
    const ctxEmpty: any = { canvas: { selectedNodeIds: [], promptNodes: [], imageNodes: [] }, settings: {} };
    const planEmpty = await brain.plan('背景换成雪山', ctxEmpty);
    assert.equal(planEmpty.intent, 'image_edit_missing_selection');
    assert.match(planEmpty.reply, /请选择一张图/);

    // 3. 品牌研究
    const knowledgeCountBeforePlanning = knowledgeStore.searchProject('咖啡').length;
    const planResearch = await brain.plan('研究极简咖啡品牌风格，并生成 6 张海报', ctxEmpty);
    assert.equal(planResearch.intent, 'research_to_canvas');
    assert.equal(planResearch.actions.length, 2);
    const generationAction = planResearch.actions.find((action) => action.type === 'generation.createBatchJob');
    assert.ok(generationAction);
    assert.ok(planResearch.actions.some((action) => action.type === 'knowledge.recordChange'));
    
    const payload = (generationAction as any).payload;
    assert.equal(payload.options.aspectRatio, '3:4');
    assert.match(payload.options.researchBrief, /极简咖啡品牌/);
    
    assert.equal(knowledgeStore.searchProject('咖啡').length, knowledgeCountBeforePlanning);
  });

  it('P2: analyzeIntent and LocalBrain should handle audio generation properly', async () => {
    const ctx: any = { canvas: { promptNodes: [], imageNodes: [], selectedNodeIds: [] }, settings: {} };
    const res = analyzeIntent('生成一段30秒的爵士风格背景音乐', ctx);
    assert.equal(res.intent, 'generate_audio');
    assert.equal(res.extracted.duration, 30);
    assert.equal(res.extracted.genre, 'jazz');

    const brain = new LocalAssistantBrain();
    const plan = await brain.plan('生成一段30秒的爵士风格背景音乐', ctx);
    assert.equal(plan.intent, 'generate_audio');
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].type, 'generation.createAudioJob');
    assert.equal((plan.actions[0] as any).payload.durationSeconds, 30);
    assert.equal((plan.actions[0] as any).payload.genre, 'jazz');
  });
});
